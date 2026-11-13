import csv, io, re
import graphene
from django.utils import timezone
from graphql import GraphQLError
from accounts.permissions import ctx
from core.audit import audit
from core.models import AuditLog, OptOut
from . import services
from .models import Campaign, Contact, ContactList, Message
from .services import EMAIL_RE, SendError, normalize_phone


class MessageType(graphene.ObjectType):
    id = graphene.ID()
    channel = graphene.String()
    source = graphene.String()
    recipient = graphene.String()
    subject = graphene.String()
    body = graphene.String()
    segments = graphene.Int()
    status = graphene.String()
    error = graphene.String()
    created_at = graphene.DateTime()
    sent_at = graphene.DateTime()
    campaign_name = graphene.String()
    billing_source = graphene.String()
    sender_id = graphene.String()

    def resolve_error(self, info):
        from core.i18n import translate
        return translate(self.error)

    def resolve_campaign_name(self, info):
        return self.campaign.name if self.campaign_id else None


class ContactType(graphene.ObjectType):
    id = graphene.ID()
    name = graphene.String()
    phone = graphene.String()
    email = graphene.String()


class ContactListType(graphene.ObjectType):
    id = graphene.ID()
    name = graphene.String()
    created_at = graphene.DateTime()
    contact_count = graphene.Int()
    contacts = graphene.List(ContactType, limit=graphene.Int())

    def resolve_contact_count(self, info):
        return self.contacts.count()

    def resolve_contacts(self, info, limit=100):
        return self.contacts.all()[:limit]


class CampaignType(graphene.ObjectType):
    id = graphene.ID()
    name = graphene.String()
    channel = graphene.String()
    subject = graphene.String()
    body = graphene.String()
    status = graphene.String()
    scheduled_at = graphene.DateTime()
    created_at = graphene.DateTime()
    list_names = graphene.List(graphene.String)
    total = graphene.Int()
    sent = graphene.Int()
    failed = graphene.Int()
    blocked = graphene.Int()
    queued = graphene.Int()

    def resolve_list_names(self, info):
        return [l.name for l in self.lists.all()]

    def resolve_total(self, info): return self.messages.count()
    def resolve_sent(self, info): return self.messages.filter(status="sent").count()
    def resolve_failed(self, info): return self.messages.filter(status="failed").count()
    def resolve_blocked(self, info): return self.messages.filter(status="blocked").count()
    def resolve_queued(self, info): return self.messages.filter(status__in=["queued", "sending"]).count()


class OptOutType(graphene.ObjectType):
    id = graphene.ID()
    channel = graphene.String()
    address = graphene.String()
    reason = graphene.String()
    created_at = graphene.DateTime()


class AuditType(graphene.ObjectType):
    id = graphene.ID()
    action = graphene.String()
    detail = graphene.String()
    user_email = graphene.String()
    created_at = graphene.DateTime()

    def resolve_user_email(self, info):
        return self.user.email if self.user_id else ""


class Dashboard(graphene.ObjectType):
    sms_sent = graphene.Int()
    email_sent = graphene.Int()
    failed = graphene.Int()
    blocked = graphene.Int()
    contacts = graphene.Int()
    campaigns = graphene.Int()


class ImportResult(graphene.ObjectType):
    added = graphene.Int()
    duplicates = graphene.Int()
    invalid = graphene.Int()
    invalid_samples = graphene.List(graphene.String)


def parse_contacts(raw):
    rows = [r for r in csv.reader(io.StringIO(raw.strip())) if any(c.strip() for c in r)]
    if not rows:
        return []
    header = [c.strip().lower() for c in rows[0]]
    has_header = any(h in ("phone", "mobile", "email", "name", "number") for h in header)
    out = []
    for r in rows[1:] if has_header else rows:
        item = {"name": "", "phone": "", "email": "", "fields": {}, "raw": ",".join(r)}
        for i, cell in enumerate(r):
            cell = cell.strip()
            if not cell:
                continue
            col = header[i] if has_header and i < len(header) else None
            if col in ("phone", "mobile", "number") or (col is None and normalize_phone(cell) and not EMAIL_RE.match(cell)):
                item["phone"] = normalize_phone(cell) or "!" + cell
            elif col == "email" or (col is None and EMAIL_RE.match(cell)):
                item["email"] = cell.lower()
            elif col == "name" or (col is None and not item["name"]):
                item["name"] = cell
            elif col:
                item["fields"][re.sub(r"\W+", "_", col)] = cell
        out.append(item)
    return out


class Query(graphene.ObjectType):
    messages = graphene.List(MessageType, limit=graphene.Int(), channel=graphene.String(), status=graphene.String())
    contact_lists = graphene.List(ContactListType)
    campaigns = graphene.List(CampaignType)
    opt_outs = graphene.List(OptOutType)
    audit_logs = graphene.List(AuditType)
    dashboard = graphene.Field(Dashboard)

    def resolve_messages(self, info, limit=100, channel=None, status=None):
        _, org, _ = ctx(info)
        qs = org.messages.select_related("campaign")
        if channel: qs = qs.filter(channel=channel)
        if status: qs = qs.filter(status=status)
        return qs[:min(limit, 500)]

    def resolve_contact_lists(self, info):
        return ctx(info)[1].contact_lists.all()

    def resolve_campaigns(self, info):
        return ctx(info)[1].campaigns.prefetch_related("lists")

    def resolve_opt_outs(self, info):
        return ctx(info)[1].opt_outs.all()[:500]

    def resolve_audit_logs(self, info):
        return ctx(info, "audit")[1].audit_logs.select_related("user")[:200]

    def resolve_dashboard(self, info):
        _, org, _ = ctx(info)
        m = org.messages
        return Dashboard(sms_sent=m.filter(channel="sms", status="sent").count(),
                         email_sent=m.filter(channel="email", status="sent").count(),
                         failed=m.filter(status="failed").count(), blocked=m.filter(status="blocked").count(),
                         contacts=org.contacts.count(), campaigns=org.campaigns.count())


def wrap_send(fn):
    try:
        return fn()
    except SendError as exc:
        raise GraphQLError(str(exc))


class SendTest(graphene.Mutation):
    """Send a single message from the console (quick send / test message)."""
    class Arguments:
        channel = graphene.String(required=True)
        recipient = graphene.String(required=True)
        subject = graphene.String()
        body = graphene.String(required=True)

    message = graphene.Field(MessageType)

    def mutate(self, info, channel, recipient, body, subject=""):
        user, org, _ = ctx(info, "send")
        if channel not in ("sms", "email"):
            raise GraphQLError("Channel must be sms or email.")
        msg = wrap_send(lambda: services.submit_message(org, channel, recipient, body, subject, source="console", user=user))
        return SendTest(message=msg)


class CreateContactList(graphene.Mutation):
    class Arguments:
        name = graphene.String(required=True)

    list = graphene.Field(ContactListType)

    def mutate(self, info, name):
        _, org, _ = ctx(info, "contacts")
        if not name.strip():
            raise GraphQLError("List name is required.")
        return CreateContactList(list=ContactList.objects.create(organization=org, name=name.strip()))


class DeleteContactList(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, id):
        _, org, _ = ctx(info, "contacts")
        org.contact_lists.filter(pk=id).delete()
        return DeleteContactList(ok=True)


class AddContacts(graphene.Mutation):
    """Import contacts from pasted text / CSV into a list. Phones are normalised to E.164."""
    class Arguments:
        list_id = graphene.ID(required=True)
        raw = graphene.String(required=True)

    Output = ImportResult

    def mutate(self, info, list_id, raw):
        user, org, _ = ctx(info, "contacts")
        lst = org.contact_lists.filter(pk=list_id).first()
        if not lst:
            raise GraphQLError("List not found.")
        added = dups = bad = 0
        samples = []
        for row in parse_contacts(raw)[:100000]:
            if row["phone"].startswith("!") or not (row["phone"] or row["email"]):
                bad += 1
                samples.append(row["raw"][:60])
                continue
            q = org.contacts.filter(phone=row["phone"]) if row["phone"] else org.contacts.filter(email=row["email"])
            contact = q.first()
            if contact:
                dups += 1
            else:
                contact = Contact.objects.create(organization=org, name=row["name"], phone=row["phone"],
                                                 email=row["email"], fields=row["fields"])
                added += 1
            lst.contacts.add(contact)
        audit(org, user, "contacts_imported", f"{added} added to {lst.name}")
        return ImportResult(added=added, duplicates=dups, invalid=bad, invalid_samples=samples[:5])


class CreateCampaign(graphene.Mutation):
    class Arguments:
        name = graphene.String(required=True)
        channel = graphene.String(required=True)
        subject = graphene.String()
        body = graphene.String(required=True)
        list_ids = graphene.List(graphene.ID, required=True)
        scheduled_at = graphene.DateTime()
        send_now = graphene.Boolean()

    campaign = graphene.Field(CampaignType)

    def mutate(self, info, name, channel, body, list_ids, subject="", scheduled_at=None, send_now=False):
        user, org, _ = ctx(info, "campaigns")
        if channel not in ("sms", "email"):
            raise GraphQLError("Channel must be sms or email.")
        lists = list(org.contact_lists.filter(pk__in=list_ids))
        if not lists:
            raise GraphQLError("Choose at least one contact list.")
        if channel == "email" and not subject.strip():
            raise GraphQLError("Email campaigns need a subject.")
        c = Campaign.objects.create(organization=org, created_by=user, name=name.strip(), channel=channel,
                                    subject=subject, body=body, scheduled_at=scheduled_at)
        c.lists.set(lists)
        if scheduled_at and scheduled_at > timezone.now() and not send_now:
            c.status = Campaign.SCHEDULED
            c.save(update_fields=["status"])
        else:
            try:
                services.launch_campaign(c, user)
            except SendError as exc:
                c.delete()
                raise GraphQLError(str(exc))
            services.start_campaign_thread(c.id)
        audit(org, user, "campaign_created", f"{c.name} [{c.status}]")
        return CreateCampaign(campaign=c)


class CancelCampaign(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, id):
        user, org, _ = ctx(info, "campaigns")
        c = org.campaigns.filter(pk=id).first()
        if not c or c.status in (Campaign.COMPLETED, Campaign.CANCELLED):
            raise GraphQLError("This campaign cannot be cancelled.")
        services.cancel_campaign(c)
        audit(org, user, "campaign_cancelled", c.name)
        return CancelCampaign(ok=True)


class AddOptOut(graphene.Mutation):
    class Arguments:
        channel = graphene.String(required=True)
        address = graphene.String(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, channel, address):
        user, org, _ = ctx(info, "contacts")
        addr = normalize_phone(address) if channel == "sms" else address.strip().lower()
        if channel not in ("sms", "email") or not addr:
            raise GraphQLError("Enter a valid phone number or email address.")
        OptOut.objects.get_or_create(organization=org, channel=channel, address=addr, defaults={"reason": "added manually"})
        audit(org, user, "opt_out_added", addr)
        return AddOptOut(ok=True)


class Mutation(graphene.ObjectType):
    send_test = SendTest.Field()
    create_contact_list = CreateContactList.Field()
    delete_contact_list = DeleteContactList.Field()
    add_contacts = AddContacts.Field()
    create_campaign = CreateCampaign.Field()
    cancel_campaign = CancelCampaign.Field()
    add_opt_out = AddOptOut.Field()
