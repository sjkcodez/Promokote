import uuid
from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Append-only record of sensitive actions (FR-AUD-01)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", null=True, on_delete=models.SET_NULL, related_name="audit_logs")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=80)
    detail = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class OptOut(models.Model):
    """Per-organisation opt-out registry for SMS (phone) and email (address). Customers cannot remove entries (FR-CON-02)."""
    SMS, EMAIL = "sms", "email"
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="opt_outs")
    channel = models.CharField(max_length=10)
    address = models.CharField(max_length=254)
    reason = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("organization", "channel", "address")
        ordering = ["-created_at"]
