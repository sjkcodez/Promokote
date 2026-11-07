from .models import AuditLog


def audit(org, user, action, detail=""):
    AuditLog.objects.create(organization=org, user=user if getattr(user, "is_authenticated", False) else None,
                            action=action, detail=detail[:300])
