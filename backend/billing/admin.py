from django.contrib import admin
from .models import Plan, Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "currency", "period_days", "sms_quota", "email_quota", "is_active", "is_default")
    list_editable = ("is_active", "is_default")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("organization", "plan", "status", "starts_at", "ends_at", "sms_used", "email_used")
    list_filter = ("status", "plan")
