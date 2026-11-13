import re
import graphene
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from graphql import GraphQLError
from accounts.models import Organization, User
from accounts.permissions import ctx, staff_only
from core.audit import audit
from core.system_mail import send_localized
from . import demo, services
from .models import DemoAllowance, DemoCreditEntry, Plan, SenderIdRequest, SmsActivationConfig, Subscription


class PlanType(graphene.ObjectType):
    id = graphene.ID()
    name = graphene.String()
    description = graphene.String()
    price = graphene.Float()
    currency = graphene.String()
    period_days = graphene.Int()
    sms_quota = graphene.Int()
    email_quota = graphene.Int()
    rate_limit_per_minute = graphene.Int()
    max_api_keys = graphene.Int()
    is_active = graphene.Boolean()
    is_default = graphene.Boolean()
    sort_order = graphene.Int()

    def resolve_price(self, info):
        return float(self.price)


class SubscriptionType(graphene.ObjectType):
    id = graphene.ID()
    plan = graphene.Field(PlanType)
    status = graphene.String()
    starts_at = graphene.DateTime()
    ends_at = graphene.DateTime()
    sms_used = graphene.Int()
    email_used = graphene.Int()
    organization_name = graphene.String()

    def resolve_organization_name(self, info):
        return self.organization.name


class DemoEntryType(graphene.ObjectType):
    id = graphene.ID()
    kind = graphene.String()
    units = graphene.Int()
    recipient = graphene.String()
    created_at = graphene.DateTime()

    def resolve_recipient(self, info):
        return self.message.recipient if self.message_id else None


class DemoCreditsType(graphene.ObjectType):
    granted = graphene.Int()
    used = graphene.Int()
    remaining = graphene.Int()
    active = graphene.Boolean(description="True while SMS are charged to the demo allowance (no approved Sender ID yet)")
    ineligible_reason = graphene.String()
    requires_verified_email = graphene.Boolean()
    email_verified = graphene.Boolean()
    sender_name = graphene.String()
    history = graphene.List(DemoEntryType)


class ActivationConfigType(graphene.ObjectType):
    sender_id_fee = graphene.Float()
    currency = graphene.String()
    processing_days = graphene.Int()
    payment_instructions = graphene.String()
    demo_credits = graphene.Int()
    demo_sender_name = graphene.String()

    def resolve_sender_id_fee(self, info):
        return float(self.sender_id_fee)

    def resolve_demo_credits(self, info):
        return settings.DEMO_SMS_CREDITS

    def resolve_demo_sender_name(self, info):
        return settings.DEMO_SMS_SENDER_ID


class SenderIdRequestType(graphene.ObjectType):
    id = graphene.ID()
    sender_id = graphene.String()
    business_name = graphene.String()
    registration_number = graphene.String()
    contact_phone = graphene.String()
    use_case = graphene.String()
    sample_message = graphene.String()
    status = graphene.String()
    fee_amount = graphene.Float()
    fee_currency = graphene.String()
    fee_paid_at = graphene.DateTime()
    admin_note = graphene.String()
    created_at = graphene.DateTime()
    reviewed_at = graphene.DateTime()
    organization_id = graphene.ID()
    organization_name = graphene.String()
    requested_by_email = graphene.String()

    def resolve_fee_amount(self, info):
        return float(self.fee_amount)

    def resolve_organization_name(self, info):
        return self.organization.name

    def resolve_requested_by_email(self, info):
        return self.requested_by.email if self.requested_by_id else ""


def demo_credits_for(org):
    a = DemoAllowance.objects.filter(organization=org).first()
    history = DemoCreditEntry.objects.filter(organization=org).select_related("message")[:50]
    return DemoCreditsType(granted=a.granted if a else 0, used=a.used if a else 0, remaining=a.remaining if a else 0,
                           active=demo.in_demo(org), ineligible_reason=(a.ineligible_reason if a else "not_offered"),
                           requires_verified_email=settings.DEMO_REQUIRE_VERIFIED_EMAIL,
                           email_verified=demo.owner_verified(org), sender_name=settings.DEMO_SMS_SENDER_ID,
                           history=history)


class Query(graphene.ObjectType):
    plans = graphene.List(PlanType, description="Public plans a customer can choose")
    subscription = graphene.Field(SubscriptionType, description="Current active subscription")
    pending_subscription = graphene.Field(SubscriptionType)
    demo_credits = graphene.Field(DemoCreditsType, description="Free demo SMS balance and usage history")
    sms_activation_config = graphene.Field(ActivationConfigType, description="Public Sender ID fee and terms")
    sender_id_requests = graphene.List(SenderIdRequestType)

    def resolve_demo_credits(self, info):
        return demo_credits_for(ctx(info)[1])

    def resolve_sms_activation_config(self, info):
        return SmsActivationConfig.get()

    def resolve_sender_id_requests(self, info):
        return ctx(info)[1].sender_id_requests.select_related("organization", "requested_by")[:20]

    def resolve_plans(self, info):
        return Plan.objects.filter(is_active=True)

    def resolve_subscription(self, info):
        _, org, _ = ctx(info)
        return services.current_subscription(org)

    def resolve_pending_subscription(self, info):
        _, org, _ = ctx(info)
        return org.subscriptions.filter(status=Subscription.PENDING).select_related("plan").first()


class Subscribe(graphene.Mutation):
    class Arguments:
        plan_id = graphene.ID(required=True)

    subscription = graphene.Field(SubscriptionType)

    def mutate(self, info, plan_id):
        user, org, _ = ctx(info, "billing")
        plan = Plan.objects.filter(pk=plan_id, is_active=True).first()
        if not plan:
            raise GraphQLError("That plan is not available.")
        org.subscriptions.filter(status=Subscription.PENDING).update(status=Subscription.CANCELLED)
        sub = services.start_subscription(org, plan)
        audit(org, user, "subscribe_requested", f"{plan.name} -> {sub.status}")
        return Subscribe(subscription=sub)


SENDER_RE = re.compile(r"^(?=.*[A-Za-z])[A-Za-z0-9 .&-]{3,11}$")


class RequestSenderId(graphene.Mutation):
    """Customer asks for Bulk SMS activation with their own Sender ID (step 1 of the activation workflow)."""
    class Arguments:
        sender_id = graphene.String(required=True)
        business_name = graphene.String(required=True)
        registration_number = graphene.String(required=True)
        contact_phone = graphene.String(required=True)
        use_case = graphene.String(required=True)
        sample_message = graphene.String(required=True)

    request = graphene.Field(SenderIdRequestType)

    def mutate(self, info, sender_id, business_name, registration_number, contact_phone, use_case, sample_message):
        from messaging.services import normalize_phone
        user, org, _ = ctx(info, "billing")
        sender_id = " ".join(sender_id.split())
        fields = [business_name, registration_number, use_case, sample_message]
        if not all(f.strip() for f in fields):
            raise GraphQLError("Please fill in all required fields.")
        if not SENDER_RE.match(sender_id):
            raise GraphQLError("Sender ID must be 3 to 11 letters or numbers and include at least one letter.")
        if sender_id.upper() == settings.DEMO_SMS_SENDER_ID.upper():
            raise GraphQLError("That Sender ID is reserved. Choose a name that represents your business.")
        if Organization.objects.filter(sms_sender_id__iexact=sender_id).exclude(pk=org.pk).exists():
            raise GraphQLError("That Sender ID is already registered to another business.")
        phone = normalize_phone(contact_phone)
        if not phone:
            raise GraphQLError("Enter a valid contact phone number.")
        cfg = SmsActivationConfig.get()
        try:
            with transaction.atomic():
                req = SenderIdRequest.objects.create(
                    organization=org, requested_by=user, sender_id=sender_id, business_name=business_name.strip()[:150],
                    registration_number=registration_number.strip()[:60], contact_phone=phone,
                    use_case=use_case.strip()[:500], sample_message=sample_message.strip()[:320],
                    fee_amount=cfg.sender_id_fee, fee_currency=cfg.currency)
        except IntegrityError:
            raise GraphQLError("You already have a Sender ID request in progress.")
        audit(org, user, "sender_id_requested", sender_id)
        return RequestSenderId(request=req)


class CancelSenderIdRequest(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, id):
        user, org, _ = ctx(info, "billing")
        req = org.sender_id_requests.filter(pk=id).first()
        if not req:
            raise GraphQLError("Request not found.")
        if req.status != SenderIdRequest.SUBMITTED:
            raise GraphQLError("This request can no longer be changed.")
        req.status = SenderIdRequest.CANCELLED
        req.save(update_fields=["status", "updated_at"])
        audit(org, user, "sender_id_cancelled", req.sender_id)
        return CancelSenderIdRequest(ok=True)


# ---------------- Platform admin ----------------
class AdminOrgType(graphene.ObjectType):
    id = graphene.ID()
    name = graphene.String()
    sms_enabled = graphene.Boolean()
    email_enabled = graphene.Boolean()
    is_suspended = graphene.Boolean()
    created_at = graphene.DateTime()
    owner_email = graphene.String()
    plan_name = graphene.String()
    subscription_status = graphene.String()
    messages_sent = graphene.Int()
    sms_activated = graphene.Boolean()
    sms_sender_id = graphene.String()
    demo_used = graphene.Int()
    demo_granted = graphene.Int()

    def resolve_demo_used(self, info):
        a = DemoAllowance.objects.filter(organization=self).first()
        return a.used if a else 0

    def resolve_demo_granted(self, info):
        a = DemoAllowance.objects.filter(organization=self).first()
        return a.granted if a else 0

    def resolve_owner_email(self, info):
        m = self.memberships.filter(role="owner").select_related("user").first()
        return m.user.email if m else ""

    def resolve_plan_name(self, info):
        s = self.subscriptions.filter(status__in=["active", "pending"]).order_by("status").select_related("plan").first()
        return s.plan.name if s else ""

    def resolve_subscription_status(self, info):
        s = self.subscriptions.filter(status__in=["active", "pending"]).order_by("status").first()
        return s.status if s else "none"

    def resolve_messages_sent(self, info):
        return self.messages.filter(status="sent").count()


class AdminStats(graphene.ObjectType):
    organizations = graphene.Int()
    users = graphene.Int()
    messages_sent = graphene.Int()
    pending_subscriptions = graphene.Int()


class AdminQuery(graphene.ObjectType):
    admin_plans = graphene.List(PlanType)
    admin_organizations = graphene.List(AdminOrgType)
    admin_subscriptions = graphene.List(SubscriptionType, status=graphene.String())
    admin_stats = graphene.Field(AdminStats)
    admin_sender_id_requests = graphene.List(SenderIdRequestType, status=graphene.String())

    def resolve_admin_sender_id_requests(self, info, status=None):
        staff_only(info)
        qs = SenderIdRequest.objects.select_related("organization", "requested_by")
        return qs.filter(status=status) if status else qs[:200]

    def resolve_admin_plans(self, info):
        staff_only(info)
        return Plan.objects.all()

    def resolve_admin_organizations(self, info):
        staff_only(info)
        return Organization.objects.all().order_by("-created_at")

    def resolve_admin_subscriptions(self, info, status=None):
        staff_only(info)
        qs = Subscription.objects.select_related("plan", "organization")
        return qs.filter(status=status) if status else qs[:200]

    def resolve_admin_stats(self, info):
        staff_only(info)
        from messaging.models import Message
        return AdminStats(organizations=Organization.objects.count(), users=User.objects.count(),
                          messages_sent=Message.objects.filter(status="sent").count(),
                          pending_subscriptions=Subscription.objects.filter(status="pending").count())


class PlanInput(graphene.InputObjectType):
    id = graphene.ID()
    name = graphene.String(required=True)
    description = graphene.String()
    price = graphene.Float(required=True)
    currency = graphene.String()
    period_days = graphene.Int(required=True)
    sms_quota = graphene.Int(required=True)
    email_quota = graphene.Int(required=True)
    rate_limit_per_minute = graphene.Int(required=True)
    max_api_keys = graphene.Int(required=True)
    is_active = graphene.Boolean()
    is_default = graphene.Boolean()
    sort_order = graphene.Int()


class UpsertPlan(graphene.Mutation):
    class Arguments:
        input = PlanInput(required=True)

    plan = graphene.Field(PlanType)

    def mutate(self, info, input):
        user = staff_only(info)
        data = {k: v for k, v in input.items() if k != "id"}
        if input.get("id"):
            plan = Plan.objects.filter(pk=input["id"]).first()
            if not plan:
                raise GraphQLError("Plan not found.")
            for k, v in data.items():
                setattr(plan, k, v)
            plan.save()
        else:
            plan = Plan.objects.create(**data)
        audit(None, user, "plan_saved", plan.name)
        return UpsertPlan(plan=plan)


class SetSubscription(graphene.Mutation):
    """Platform admin activates a pending subscription (after payment) or assigns any plan to an organisation."""
    class Arguments:
        organization_id = graphene.ID(required=True)
        plan_id = graphene.ID(required=True)
        days = graphene.Int()

    subscription = graphene.Field(SubscriptionType)

    def mutate(self, info, organization_id, plan_id, days=None):
        user = staff_only(info)
        org = Organization.objects.filter(pk=organization_id).first()
        plan = Plan.objects.filter(pk=plan_id).first()
        if not org or not plan:
            raise GraphQLError("Organisation or plan not found.")
        Subscription.objects.filter(organization=org, status__in=["active", "pending"]).update(status=Subscription.CANCELLED)
        sub = Subscription.objects.create(organization=org, plan=plan)
        sub.activate(days)
        audit(org, user, "subscription_set", f"{plan.name} for {days or plan.period_days} days")
        return SetSubscription(subscription=sub)


class UpdateOrganization(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        sms_enabled = graphene.Boolean()
        email_enabled = graphene.Boolean()
        is_suspended = graphene.Boolean()

    ok = graphene.Boolean()

    def mutate(self, info, id, **kw):
        user = staff_only(info)
        org = Organization.objects.filter(pk=id).first()
        if not org:
            raise GraphQLError("Organisation not found.")
        for k, v in kw.items():
            setattr(org, k, v)
        org.save()
        audit(org, user, "organization_updated", str(kw))
        return UpdateOrganization(ok=True)


class ReviewSenderIdRequest(graphene.Mutation):
    """Platform admin moves a Sender ID request along: confirm_payment -> approve, or reject (with a reason)."""
    class Arguments:
        id = graphene.ID(required=True)
        action = graphene.String(required=True)
        note = graphene.String()

    request = graphene.Field(SenderIdRequestType)

    @transaction.atomic
    def mutate(self, info, id, action, note=""):
        admin = staff_only(info)
        req = SenderIdRequest.objects.select_for_update(of=("self",)).select_related("organization", "requested_by").filter(pk=id).first()
        if not req:
            raise GraphQLError("Request not found.")
        if req.status not in SenderIdRequest.OPEN:
            raise GraphQLError("This request can no longer be changed.")
        org, now = req.organization, timezone.now()
        if action == "confirm_payment":
            req.status, req.fee_paid_at = SenderIdRequest.UNDER_REVIEW, now
        elif action == "approve":
            if Organization.objects.filter(sms_sender_id__iexact=req.sender_id).exclude(pk=org.pk).exists():
                raise GraphQLError("That Sender ID is already registered to another business.")
            req.status = SenderIdRequest.APPROVED
            req.fee_paid_at = req.fee_paid_at or now
            org.sms_activated, org.sms_sender_id = True, req.sender_id
            org.save(update_fields=["sms_activated", "sms_sender_id"])
        elif action == "reject":
            if not (note or "").strip():
                raise GraphQLError("Give a reason so the customer knows what to fix.")
            req.status = SenderIdRequest.REJECTED
        else:
            raise GraphQLError("Unknown action.")
        req.admin_note = (note or "").strip()[:300] or req.admin_note
        req.reviewed_by, req.reviewed_at = admin, now
        req.save()
        audit(org, admin, f"sender_id_{action}", req.sender_id)
        if action in ("approve", "reject") and req.requested_by_id:
            u = req.requested_by
            kind = "sender_approved" if action == "approve" else "sender_rejected"
            path = "/plans" if action == "approve" else "/sms-activation"
            transaction.on_commit(lambda: send_localized(u.email, kind, u.language, f"{settings.FRONTEND_URL}{path}",
                                                         sender=req.sender_id, note=req.admin_note))
        return ReviewSenderIdRequest(request=req)


class UpdateSmsActivationConfig(graphene.Mutation):
    class Arguments:
        sender_id_fee = graphene.Float(required=True)
        currency = graphene.String()
        processing_days = graphene.Int(required=True)
        payment_instructions = graphene.String()

    config = graphene.Field(ActivationConfigType)

    def mutate(self, info, sender_id_fee, processing_days, currency=None, payment_instructions=None):
        admin = staff_only(info)
        cfg = SmsActivationConfig.get()
        cfg.sender_id_fee, cfg.processing_days = max(0, sender_id_fee), max(1, processing_days)
        if currency:
            cfg.currency = currency.strip().upper()[:5]
        if payment_instructions is not None:
            cfg.payment_instructions = payment_instructions.strip()
        cfg.save()
        audit(None, admin, "sms_activation_config_saved", f"fee {cfg.sender_id_fee} {cfg.currency}")
        return UpdateSmsActivationConfig(config=cfg)


class Mutation(graphene.ObjectType):
    request_sender_id = RequestSenderId.Field()
    cancel_sender_id_request = CancelSenderIdRequest.Field()
    review_sender_id_request = ReviewSenderIdRequest.Field()
    update_sms_activation_config = UpdateSmsActivationConfig.Field()
    subscribe = Subscribe.Field()
    upsert_plan = UpsertPlan.Field()
    set_subscription = SetSubscription.Field()
    update_organization = UpdateOrganization.Field()
