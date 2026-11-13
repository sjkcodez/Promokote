import uuid
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("email_verified", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    LANGUAGES = [("sw", "Kiswahili"), ("en", "English")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Platform Admin (Promokote staff)
    language = models.CharField(max_length=5, choices=LANGUAGES, default="sw")  # UI + system-email language
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    sms_enabled = models.BooleanField(default=True)      # product entitlements (FR-ID-09)
    email_enabled = models.BooleanField(default=True)
    is_suspended = models.BooleanField(default=False)
    # Bulk SMS activation: until a Sender ID is approved, SMS go out on the free demo allowance with a generic sender.
    sms_activated = models.BooleanField(default=False)
    sms_sender_id = models.CharField(max_length=11, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Membership(models.Model):
    OWNER, ADMIN, MARKETER, DEVELOPER, VIEWER = "owner", "admin", "marketer", "developer", "viewer"
    ROLES = [(OWNER, "Owner"), (ADMIN, "Admin"), (MARKETER, "Marketer"), (DEVELOPER, "Developer"), (VIEWER, "Viewer")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=20, choices=ROLES, default=VIEWER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "organization")
