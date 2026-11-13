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


# ---------------- Free demo SMS ----------------
class DemoAllowance(models.Model):
    """The one-off free demo SMS allowance of an organisation. `used` can never exceed `granted` (DB constraint)."""
    organization = models.OneToOneField("accounts.Organization", on_delete=models.CASCADE, primary_key=True,
                                        related_name="demo_allowance")
    granted = models.PositiveIntegerField(default=0)
    used = models.PositiveIntegerField(default=0)
    ineligible_reason = models.CharField(max_length=40, blank=True)   # already_claimed | ip_limit
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(check=models.Q(used__lte=models.F("granted")), name="demo_used_lte_granted")]

    @property
    def remaining(self):
        return max(0, self.granted - self.used)


class DemoCreditEntry(models.Model):
    """Append-only ledger of demo credit movements."""
    GRANT, DEBIT, REFUND = "grant", "debit", "refund"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="demo_entries")
    kind = models.CharField(max_length=10)
    units = models.PositiveIntegerField()
    message = models.ForeignKey("messaging.Message", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class DemoClaim(models.Model):
    """Registry of identities that already received demo credits. Survives account deletion, so re-registering
    (or using a `+alias` / dotted Gmail variant of the same mailbox) does not grant a second allowance."""
    identity = models.CharField(max_length=64, unique=True)   # sha256 of the normalised email
    organization = models.ForeignKey("accounts.Organization", null=True, blank=True, on_delete=models.SET_NULL)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


# ---------------- Bulk SMS activation / Sender ID ----------------
class SmsActivationConfig(models.Model):
    """Singleton with the Sender ID registration terms shown to customers. Editable by Platform Admins."""
    sender_id_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=5, default="TZS")
    processing_days = models.PositiveIntegerField(default=7, help_text="Typical approval time in working days")
    payment_instructions = models.TextField(blank=True, help_text="How customers pay the fee (e.g. mobile money number)")
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class SenderIdRequest(models.Model):
    SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CANCELLED = "submitted", "under_review", "approved", "rejected", "cancelled"
    OPEN = (SUBMITTED, UNDER_REVIEW)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="sender_id_requests")
    requested_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    sender_id = models.CharField(max_length=11)
    business_name = models.CharField(max_length=150)
    registration_number = models.CharField(max_length=60, help_text="BRELA registration or TIN number")
    contact_phone = models.CharField(max_length=20)
    use_case = models.CharField(max_length=500)
    sample_message = models.CharField(max_length=320)
    status = models.CharField(max_length=14, default=SUBMITTED, db_index=True)
    fee_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fee_currency = models.CharField(max_length=5, default="TZS")
    fee_paid_at = models.DateTimeField(null=True, blank=True)
    admin_note = models.CharField(max_length=300, blank=True)
    reviewed_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["organization"], condition=models.Q(status__in=["submitted", "under_review"]),
                                               name="one_open_sender_request_per_org")]
