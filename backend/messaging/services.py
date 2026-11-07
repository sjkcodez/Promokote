import math, re, threading, time
from django.core import signing
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from accounts.models import Organization
from billing import services as billing
from core import upstream
from core.models import OptOut
from .models import Campaign, Message

GSM7 = set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")
GSM7_EXT = set("^{}\\[~]|€\f")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SendError(Exception):
    def __init__(self, message, code="invalid_request", status=400):
        super().__init__(message)
        self.code, self.status = code, status


def normalize_phone(raw):
    """Normalise to E.164. Tanzanian defaults: 0712345678 / 255712345678 -> +255712345678."""
    p = re.sub(r"[\s\-().]", "", str(raw or ""))
    if p.startswith("00"):
        p = "+" + p[2:]
    if p.startswith("0"):
        p = "+255" + p[1:]
    elif p and not p.startswith("+"):
        p = "+" + p
    return p if re.fullmatch(r"\+\d{9,15}", p) else None


def sms_info(text):
    """(encoding, length, segments) following GSM-7 / UCS-2 rules."""
    if all(c in GSM7 or c in GSM7_EXT for c in text):
        length = sum(2 if c in GSM7_EXT else 1 for c in text)
        return "GSM-7", length, 1 if length <= 160 else math.ceil(length / 153)
    length = len(text)
    return "Unicode", length, 1 if length <= 70 else math.ceil(length / 67)


def render(template, contact):
    data = {"name": contact.name, "phone": contact.phone, "email": contact.email, **(contact.fields or {})}
    return re.sub(r"\{\{\s*(\w+)\s*\}\}", lambda m: str(data.get(m.group(1), "")), template)


def unsubscribe_token(org_id, address):
    return signing.dumps({"o": str(org_id), "a": address}, salt="promokote.unsub")


def is_opted_out(org, channel, address):
    return OptOut.objects.filter(organization=org, channel=channel, address=address).exists()


def check_entitlement(org, channel):
    if org.is_suspended:
        raise SendError("This organisation is suspended. Contact support.", "suspended", 403)
    if not (org.sms_enabled if channel == "sms" else org.email_enabled):
        raise SendError(f"{channel.upper()} is not enabled for your organisation.", "service_disabled", 403)


def submit_message(org, channel, recipient, body, subject="", source="api", api_key=None, user=None,
                   campaign=None, idempotency_key=None, dispatch=True):
    """Validate, check opt-out, reserve quota, persist (queued) and optionally dispatch immediately."""
    check_entitlement(org, channel)
    if idempotency_key:
        existing = Message.objects.filter(organization=org, idempotency_key=idempotency_key).first()
        if existing:
            return existing
    if channel == "sms":
        address = normalize_phone(recipient)
        if not address:
            raise SendError(f"'{recipient}' is not a valid phone number. Use e.g. +255712345678 or 0712345678.")
        if not body.strip():
            raise SendError("Message text is required.")
        segments = sms_info(body)[2]
    else:
        address = str(recipient or "").strip().lower()
        if not EMAIL_RE.match(address):
            raise SendError(f"'{recipient}' is not a valid email address.")
        if not subject.strip() or not body.strip():
            raise SendError("Email subject and body are required.")
        segments = 1
    base = dict(organization=org, channel=channel, source=source, api_key=api_key, created_by=user, campaign=campaign,
                recipient=address, subject=subject, body=body, segments=segments, idempotency_key=idempotency_key)
    if is_opted_out(org, channel, address):
        return Message.objects.create(status=Message.BLOCKED, error="Recipient has opted out.", **base)
    try:
        billing.consume(org, channel, segments)
    except billing.QuotaError as exc:
        raise SendError(str(exc), exc.code, 402)
    try:
        with transaction.atomic():
            msg = Message.objects.create(status=Message.QUEUED, **base)
    except IntegrityError:   # concurrent duplicate idempotency key
        billing.refund(org, channel, segments)
        return Message.objects.get(organization=org, idempotency_key=idempotency_key)
    return dispatch_message(msg) if dispatch else msg


def dispatch_message(msg):
    """Send one queued message through the upstream platform. Safe to call twice (claims the row first)."""
    if not Message.objects.filter(pk=msg.pk, status=Message.QUEUED).update(status=Message.SENDING):
        msg.refresh_from_db()
        return msg
    try:
        if msg.channel == "sms":
            data = upstream.send_sms(msg.recipient, msg.body)
        else:
            html = msg.body
            if msg.source == "campaign":
                link = f"{settings.PUBLIC_BASE_URL}/u/{unsubscribe_token(msg.organization_id, msg.recipient)}/"
                html += (f'<hr><p style="font-size:12px;color:#6b7280">Sent by {msg.organization.name}. '
                         f'<a href="{link}">Unsubscribe</a></p>')
            data = upstream.send_email(msg.recipient, msg.subject, html)
        msg.status, msg.sent_at, msg.provider_id = Message.SENT, timezone.now(), upstream.provider_id(data)
    except upstream.UpstreamError as exc:
        msg.status, msg.error = Message.FAILED, str(exc)[:300]
        billing.refund(msg.organization, msg.channel, msg.segments)
    msg.save()
    if msg.campaign_id:
        refresh_campaign(msg.campaign)
    return msg


# ---------- campaigns ----------
def campaign_recipients(campaign):
    from .models import Contact
    ids = Contact.objects.filter(lists__in=campaign.lists.all()).values_list("id", flat=True).distinct()
    contacts = Contact.objects.filter(id__in=list(ids))
    return [c for c in contacts if (c.phone if campaign.channel == "sms" else c.email)]


def launch_campaign(campaign, user=None):
    """Create queued messages for every recipient (quota checked up front), then hand over to the worker."""
    org = campaign.organization
    check_entitlement(org, campaign.channel)
    contacts = campaign_recipients(campaign)
    if not contacts:
        raise SendError("The selected lists have no contacts with a valid " + ("phone number." if campaign.channel == "sms" else "email address."))
    sub = billing.current_subscription(org)
    if not sub:
        raise SendError("No active subscription. Choose a plan to start sending.", "no_subscription", 402)
    need = sum(sms_info(render(campaign.body, c))[2] for c in contacts) if campaign.channel == "sms" else len(contacts)
    if billing.remaining(sub, campaign.channel) < need:
        raise SendError(f"This campaign needs {need} {campaign.channel.upper()} credits but your plan has "
                        f"{billing.remaining(sub, campaign.channel)} left.", "quota_exceeded", 402)
    for c in contacts:
        try:
            submit_message(org, campaign.channel, c.phone if campaign.channel == "sms" else c.email,
                           render(campaign.body, c), render(campaign.subject, c), source="campaign",
                           user=user, campaign=campaign, dispatch=False)
        except SendError:
            continue   # invalid contact: skipped
    campaign.status = Campaign.RUNNING
    campaign.save(update_fields=["status"])
    refresh_campaign(campaign)
    return campaign


def start_campaign_thread(campaign_id):
    if not settings.CAMPAIGN_BACKGROUND_THREAD:   # off in tests; `manage.py run_worker` picks queued messages up too
        return
    threading.Thread(target=dispatch_campaign, args=(campaign_id,), daemon=True).start()


def dispatch_campaign(campaign_id):
    for msg in Message.objects.filter(campaign_id=campaign_id, status=Message.QUEUED).select_related("organization", "campaign"):
        if Campaign.objects.filter(pk=campaign_id, status=Campaign.CANCELLED).exists():
            return
        dispatch_message(msg)
        time.sleep(0.05)   # gentle throttle toward upstream


def refresh_campaign(campaign):
    campaign.refresh_from_db()
    if campaign.status == Campaign.RUNNING and not campaign.messages.filter(status__in=[Message.QUEUED, Message.SENDING]).exists():
        campaign.status = Campaign.COMPLETED
        campaign.save(update_fields=["status"])


def cancel_campaign(campaign):
    campaign.status = Campaign.CANCELLED
    campaign.save(update_fields=["status"])
    for m in campaign.messages.filter(status=Message.QUEUED):   # release quota for unsent messages
        m.status, m.error = Message.FAILED, "Campaign cancelled."
        m.save(update_fields=["status", "error"])
        billing.refund(campaign.organization, m.channel, m.segments)


def run_due_campaigns():
    for c in Campaign.objects.filter(status=Campaign.SCHEDULED, scheduled_at__lte=timezone.now()):
        try:
            launch_campaign(c, c.created_by)
        except SendError:
            c.status = Campaign.CANCELLED
            c.save(update_fields=["status"])
    for c in Campaign.objects.filter(status=Campaign.RUNNING):
        dispatch_campaign(c.id)
