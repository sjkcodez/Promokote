from django.core.management.base import BaseCommand
from billing.models import Plan

PLANS = [
    dict(name="Free Trial", description="Try Promokote with a small allowance", price=0, sms_quota=20, email_quota=50,
         rate_limit_per_minute=30, max_api_keys=2, is_default=True, sort_order=0),
    dict(name="Starter", description="For small businesses getting going", price=25000, sms_quota=1000, email_quota=5000,
         rate_limit_per_minute=60, max_api_keys=3, sort_order=1),
    dict(name="Business", description="Growing teams with higher volume", price=90000, sms_quota=5000, email_quota=25000,
         rate_limit_per_minute=300, max_api_keys=10, sort_order=2),
    dict(name="Scale", description="High-volume senders", price=250000, sms_quota=20000, email_quota=100000,
         rate_limit_per_minute=1000, max_api_keys=50, sort_order=3),
]


class Command(BaseCommand):
    help = "Create starter subscription plans (admins can edit them afterwards)."

    def handle(self, *args, **opts):
        for p in PLANS:
            _, created = Plan.objects.get_or_create(name=p["name"], defaults=p)
            self.stdout.write(f"{'created' if created else 'exists '} {p['name']}")
