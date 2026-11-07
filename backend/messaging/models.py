import uuid
from django.conf import settings
from django.db import models


class Contact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)   # E.164
    email = models.EmailField(blank=True)
    fields = models.JSONField(default=dict, blank=True)    # custom merge fields
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ContactList(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="contact_lists")
    name = models.CharField(max_length=120)
    contacts = models.ManyToManyField(Contact, related_name="lists", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Campaign(models.Model):
    DRAFT, SCHEDULED, RUNNING, COMPLETED, CANCELLED = "draft", "scheduled", "running", "completed", "cancelled"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="campaigns")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=150)
    channel = models.CharField(max_length=10)             # sms | email
    subject = models.CharField(max_length=200, blank=True)
    body = models.TextField()                              # supports {{name}}, {{phone}}, {{email}}, custom fields
    lists = models.ManyToManyField(ContactList, related_name="campaigns")
    status = models.CharField(max_length=12, default=DRAFT)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Message(models.Model):
    QUEUED, SENDING, SENT, FAILED, BLOCKED = "queued", "sending", "sent", "failed", "blocked"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="messages")
    channel = models.CharField(max_length=10)
    source = models.CharField(max_length=10, default="api")   # api | console | campaign
    api_key = models.ForeignKey("apikeys.ApiKey", null=True, blank=True, on_delete=models.SET_NULL)
    campaign = models.ForeignKey(Campaign, null=True, blank=True, on_delete=models.SET_NULL, related_name="messages")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    recipient = models.CharField(max_length=254)
    subject = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    segments = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=10, default=QUEUED, db_index=True)
    error = models.CharField(max_length=300, blank=True)
    provider_id = models.CharField(max_length=100, blank=True)
    idempotency_key = models.CharField(max_length=120, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "-created_at"])]
        constraints = [models.UniqueConstraint(fields=["organization", "idempotency_key"],
                                               condition=models.Q(idempotency_key__isnull=False),
                                               name="uniq_idempotency_per_org")]
