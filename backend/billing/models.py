import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone


class Plan(models.Model):
    """Subscription plan - fully configurable by Platform Admins (web console or Django admin)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=300, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=5, default="TZS")
    period_days = models.PositiveIntegerField(default=30)
    sms_quota = models.PositiveIntegerField(default=0, help_text="SMS segments included per period")
    email_quota = models.PositiveIntegerField(default=0, help_text="Emails included per period")
    rate_limit_per_minute = models.PositiveIntegerField(default=60, help_text="API requests per minute per key")
    max_api_keys = models.PositiveIntegerField(default=3)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, help_text="Assigned automatically to new organisations")
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "price"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            Plan.objects.exclude(pk=self.pk).update(is_default=False)


class Subscription(models.Model):
    PENDING, ACTIVE, EXPIRED, CANCELLED = "pending", "active", "expired", "cancelled"
    STATUSES = [(PENDING, "Pending"), (ACTIVE, "Active"), (EXPIRED, "Expired"), (CANCELLED, "Cancelled")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="subscriptions")
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=12, choices=STATUSES, default=PENDING)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    sms_used = models.PositiveIntegerField(default=0)
    email_used = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_current(self):
        return self.status == self.ACTIVE and self.ends_at and self.ends_at > timezone.now()

    def activate(self, days=None):
        now = timezone.now()
        self.status, self.starts_at = self.ACTIVE, now
        self.ends_at = now + timedelta(days=days or self.plan.period_days)
        self.sms_used = self.email_used = 0
        self.save()
