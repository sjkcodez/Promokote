"""
Team role rules, shared by every user-management operation.

  * The owner manages everyone except themselves, and is the only one who can give the Admin role.
  * An admin manages marketers, developers and viewers (not the owner, other admins, or themselves).
  * Nobody can remove or demote the owner; ownership only moves with TransferOwnership, so every
    organisation always has exactly one owner.
"""
from .models import Membership

M = Membership
STAFF_ROLES = {M.MARKETER, M.DEVELOPER, M.VIEWER}


def can_manage(actor, target):
    if actor.pk == target.pk or actor.organization_id != target.organization_id:
        return False
    if actor.role == M.OWNER:
        return True
    return actor.role == M.ADMIN and target.role in STAFF_ROLES


def can_assign(actor, role):
    if role == M.OWNER or role not in dict(M.ROLES):
        return False
    if actor.role == M.OWNER:
        return True
    return actor.role == M.ADMIN and role in STAFF_ROLES


def member_status(user):
    if not user.is_active:
        return "deactivated"
    if not user.has_usable_password() and user.last_login is None:
        return "invited"
    return "active"
