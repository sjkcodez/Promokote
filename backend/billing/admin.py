from django.contrib import admin
from .models import DemoAllowance, DemoClaim, DemoCreditEntry, Plan, SenderIdRequest, SmsActivationConfig, Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "currency", "period_days", "sms_quota", "email_quota", "is_active", "is_default")
    list_editable = ("is_active", "is_default")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("organization", "plan", "status", "starts_at", "ends_at", "sms_used", "email_used")
    list_filter = ("status", "plan")


@admin.register(DemoAllowance)
class DemoAllowanceAdmin(admin.ModelAdmin):
    list_display = ("organization", "granted", "used", "ineligible_reason", "created_at")
    search_fields = ("organization__name",)


@admin.register(DemoCreditEntry)
class DemoCreditEntryAdmin(admin.ModelAdmin):
    list_display = ("organization", "kind", "units", "message", "created_at")
    list_filter = ("kind",)

    def has_change_permission(self, request, obj=None):   # ledger is append-only
        return False


@admin.register(DemoClaim)
class DemoClaimAdmin(admin.ModelAdmin):
    list_display = ("identity", "organization", "ip", "created_at")


@admin.register(SenderIdRequest)
class SenderIdRequestAdmin(admin.ModelAdmin):
    list_display = ("sender_id", "organization", "status", "fee_amount", "fee_paid_at", "created_at")
    list_filter = ("status",)
    search_fields = ("sender_id", "organization__name", "business_name")


@admin.register(SmsActivationConfig)
class SmsActivationConfigAdmin(admin.ModelAdmin):
    list_display = ("sender_id_fee", "currency", "processing_days", "updated_at")
