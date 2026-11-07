import graphene
from django.db.models import Count, Sum
from graphql import GraphQLError
from accounts.models import Organization, User
from accounts.permissions import ctx, staff_only
from core.audit import audit
from . import services
from .models import Plan, Subscription


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


class Query(graphene.ObjectType):
    plans = graphene.List(PlanType, description="Public plans a customer can choose")
    subscription = graphene.Field(SubscriptionType, description="Current active subscription")
    pending_subscription = graphene.Field(SubscriptionType)

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


class Mutation(graphene.ObjectType):
    subscribe = Subscribe.Field()
    upsert_plan = UpsertPlan.Field()
    set_subscription = SetSubscription.Field()
    update_organization = UpdateOrganization.Field()
