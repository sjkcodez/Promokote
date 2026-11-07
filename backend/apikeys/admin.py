from django.contrib import admin
from .models import ApiKey


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "service", "key", "last_used_at", "revoked_at")
    readonly_fields = ("key", "secret_hash", "secret_hint")
