from django.contrib import admin
from .models import AuditLog, OptOut


@admin.register(AuditLog)
class AuditAdmin(admin.ModelAdmin):
    list_display = ("created_at", "organization", "user", "action", "detail")
    def has_change_permission(self, *a, **k): return False
    def has_delete_permission(self, *a, **k): return False
    def has_add_permission(self, *a, **k): return False


admin.site.register(OptOut)
