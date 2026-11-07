import hashlib, hmac, secrets, uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


def hash_secret(secret):
    return hmac.new(settings.SECRET_KEY.encode(), secret.encode(), hashlib.sha256).hexdigest()


class ApiKey(models.Model):
    SMS, EMAIL, ALL = "sms", "email", "all"
    SERVICES = [(SMS, "SMS only"), (EMAIL, "Email only"), (ALL, "SMS and Email")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="api_keys")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=80)
    service = models.CharField(max_length=10, choices=SERVICES, default=ALL)
    key = models.CharField(max_length=60, unique=True, db_index=True)   # public identifier (like X-API-KEY)
    secret_hash = models.CharField(max_length=64)                        # the secret itself is never stored
    secret_hint = models.CharField(max_length=8, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_active(self):
        return self.revoked_at is None

    def allows(self, channel):
        return self.service in (self.ALL, channel)

    def check_secret(self, secret):
        return hmac.compare_digest(self.secret_hash, hash_secret(secret))

    def revoke(self):
        self.revoked_at = timezone.now()
        self.save(update_fields=["revoked_at"])

    @classmethod
    def generate(cls, organization, user, name, service):
        """Returns (ApiKey, plain_secret). The plain secret is shown once and cannot be recovered."""
        key = "pk_live_" + secrets.token_urlsafe(18)
        secret = "ps_" + secrets.token_urlsafe(32)
        obj = cls.objects.create(organization=organization, created_by=user, name=name, service=service,
                                 key=key, secret_hash=hash_secret(secret), secret_hint=secret[-4:])
        return obj, secret
