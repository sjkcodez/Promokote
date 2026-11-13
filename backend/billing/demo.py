"""
Free demo SMS allowance.

Every new organisation gets `DEMO_SMS_CREDITS` (10) SMS credits once, so it can try Bulk SMS before activating the
official service. Until the organisation's own Sender ID is approved (`Organization.sms_activated`), every SMS is
charged here (never against a subscription) and goes out with the generic `DEMO_SMS_SENDER_ID`.

Guarantees:
  * deduction is a single conditional UPDATE (`used + units <= granted`), so concurrent sends can never overdraw,
    and a DB check constraint backs it up;
  * every movement is written to the append-only `DemoCreditEntry` ledger in the same transaction;
  * a normalised-email registry (`DemoClaim`) plus a per-IP daily cap stop the allowance being claimed twice by
    re-registering; a per-recipient daily cap stops demo accounts being used to flood one phone number.
"""
import hashlib
from datetime import timedelta
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from .models import DemoAllowance, DemoClaim, DemoCreditEntry
from .services import QuotaError

GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}


def in_demo(org):
    return not org.sms_activated


def normalize_email(email):
    """Collapse mailbox aliases: drop `+tag` everywhere, and dots for Gmail (a.b+x@gmail.com == ab@gmail.com)."""
    local, _, domain = (email or "").strip().lower().partition("@")
    local = local.split("+", 1)[0]
    if domain in GMAIL_DOMAINS:
        local, domain = local.replace(".", ""), "gmail.com"
    return f"{local}@{domain}"


def identity(email):
    return hashlib.sha256(normalize_email(email).encode()).hexdigest()


def client_ip(request):
    if request is None:
        return None
    ip = ""
    if settings.TRUST_X_FORWARDED_FOR:
        ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
    return ip or request.META.get("REMOTE_ADDR") or None


def grant_on_signup(org, email, ip=None):
    """Create the organisation's allowance: full credits when eligible, zero (with a reason) otherwise."""
    reason = ""
    ident = identity(email)
    if DemoClaim.objects.filter(identity=ident).exists():
        reason = "already_claimed"
    elif ip and DemoClaim.objects.filter(ip=ip, created_at__gte=timezone.now() - timedelta(days=1)).count() \
            >= settings.DEMO_MAX_CLAIMS_PER_IP_PER_DAY:
        reason = "ip_limit"
    if not reason:
        try:
            with transaction.atomic():
                DemoClaim.objects.create(identity=ident, organization=org, ip=ip)
        except IntegrityError:   # the same mailbox registering twice at the same moment
            reason = "already_claimed"
    granted = 0 if reason else settings.DEMO_SMS_CREDITS
    allowance = DemoAllowance.objects.create(organization=org, granted=granted, ineligible_reason=reason)
    if granted:
        DemoCreditEntry.objects.create(organization=org, kind=DemoCreditEntry.GRANT, units=granted)
    return allowance


def get_allowance(org):
    return DemoAllowance.objects.filter(organization=org).first()


def remaining(org):
    a = get_allowance(org)
    return a.remaining if a else 0


def owner_verified(org):
    return org.memberships.filter(role="owner", user__email_verified=True).exists()


def ensure_usable(org):
    """Raise QuotaError when the organisation cannot use demo credits at all right now."""
    a = get_allowance(org)
    if not a or a.granted == 0:
        raise QuotaError("This account is not eligible for free demo SMS. Activate Bulk SMS to start sending.",
                         "demo_not_eligible")
    if settings.DEMO_REQUIRE_VERIFIED_EMAIL and not owner_verified(org):
        raise QuotaError("Verify your email address to use your free demo SMS.", "demo_email_unverified")
    if a.remaining <= 0:
        raise QuotaError("Your free demo SMS are used up. Activate Bulk SMS with your own Sender ID to keep sending.",
                         "demo_exhausted")
    return a


def consume(org, units, recipient):
    """Atomically deduct `units` demo credits. Must run inside the caller's transaction (see submit_message)."""
    ensure_usable(org)
    since = timezone.now() - timedelta(days=1)
    from messaging.models import Message
    sent_to_recipient = (Message.objects.filter(billing_source="demo", recipient=recipient, created_at__gte=since)
                         .exclude(status=Message.FAILED).count())
    if sent_to_recipient >= settings.DEMO_MAX_PER_RECIPIENT_PER_DAY:
        raise QuotaError("This number has received the maximum number of demo SMS for today. Try another number.",
                         "demo_recipient_limit")
    updated = (DemoAllowance.objects.filter(organization=org, used__lte=F("granted") - units)
               .update(used=F("used") + units))
    if not updated:
        raise QuotaError(f"Not enough free demo SMS left ({remaining(org)} left, {units} needed). "
                         "Activate Bulk SMS with your own Sender ID to keep sending.", "demo_exhausted")


def record(org, kind, units, message=None):
    DemoCreditEntry.objects.create(organization=org, kind=kind, units=units, message=message)


@transaction.atomic
def refund(org, units, message=None):
    if DemoAllowance.objects.filter(organization=org, used__gte=units).update(used=F("used") - units):
        record(org, DemoCreditEntry.REFUND, units, message)
