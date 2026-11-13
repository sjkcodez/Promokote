from django.db import transaction
from django.utils import timezone
from .models import Plan, Subscription


class QuotaError(Exception):
    def __init__(self, message, code="quota_exceeded"):
        super().__init__(message)
        self.code = code


def default_plan():
    plan = Plan.objects.filter(is_default=True, is_active=True).first()
    if not plan:
        plan, _ = Plan.objects.get_or_create(
            name="Free Trial", defaults=dict(description="Try Promokote for free", price=0, sms_quota=0,
                                             email_quota=50, rate_limit_per_minute=30, max_api_keys=2,
                                             is_default=True, sort_order=0))
    return plan


def current_subscription(org):
    now = timezone.now()
    Subscription.objects.filter(organization=org, status=Subscription.ACTIVE, ends_at__lte=now).update(status=Subscription.EXPIRED)
    return Subscription.objects.filter(organization=org, status=Subscription.ACTIVE).select_related("plan").first()


def start_subscription(org, plan, force_active=False):
    """Free plans activate immediately; paid plans wait for a Platform Admin to confirm payment."""
    sub = Subscription.objects.create(organization=org, plan=plan)
    if force_active or plan.price == 0:
        Subscription.objects.filter(organization=org, status=Subscription.ACTIVE).update(status=Subscription.CANCELLED)
        sub.activate()
    return sub


def remaining(sub, channel):
    return (sub.plan.sms_quota - sub.sms_used) if channel == "sms" else (sub.plan.email_quota - sub.email_used)


@transaction.atomic
def consume(org, channel, units):
    """Reserve `units` of quota atomically. Raises QuotaError when the org cannot send."""
    current_subscription(org)
    sub = (Subscription.objects.select_for_update().select_related("plan")
           .filter(organization=org, status=Subscription.ACTIVE).first())
    if not sub:
        raise QuotaError("No active subscription. Choose a plan to start sending.", "no_subscription")
    if remaining(sub, channel) < units:
        raise QuotaError(f"Your plan's {channel.upper()} quota is used up ({remaining(sub, channel)} left, {units} needed). "
                         "Upgrade your plan to continue.")
    field = "sms_used" if channel == "sms" else "email_used"
    setattr(sub, field, getattr(sub, field) + units)
    sub.save(update_fields=[field])
    return sub


@transaction.atomic
def refund(org, channel, units):
    sub = Subscription.objects.select_for_update().filter(organization=org, status=Subscription.ACTIVE).first()
    if sub:
        field = "sms_used" if channel == "sms" else "email_used"
        setattr(sub, field, max(0, getattr(sub, field) - units))
        sub.save(update_fields=[field])
