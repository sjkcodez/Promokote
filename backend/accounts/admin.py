from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Organization, Membership


@admin.register(User)
class PromoUserAdmin(UserAdmin):
    ordering = ("email",)
    list_display = ("email", "full_name", "email_verified", "is_staff")
    fieldsets = ((None, {"fields": ("email", "password")}), ("Profile", {"fields": ("full_name", "phone", "email_verified")}),
                 ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}))
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),)
    search_fields = ("email", "full_name")


admin.site.register(Organization)
admin.site.register(Membership)
