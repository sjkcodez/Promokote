from graphql import GraphQLError
from .models import Membership

M = Membership
PERMS = {
    "manage_keys": {M.OWNER, M.ADMIN, M.DEVELOPER},
    "send": {M.OWNER, M.ADMIN, M.MARKETER, M.DEVELOPER},
    "campaigns": {M.OWNER, M.ADMIN, M.MARKETER},
    "contacts": {M.OWNER, M.ADMIN, M.MARKETER},
    "billing": {M.OWNER, M.ADMIN},
    "team": {M.OWNER, M.ADMIN},
    "audit": {M.OWNER, M.ADMIN},
}


def get_membership(user):
    return user.memberships.select_related("organization").order_by("created_at").first()


def ctx(info, perm=None):
    """Return (user, organization, membership) for the request, enforcing login, suspension and role permission."""
    user = info.context.user
    if not user.is_authenticated:
        raise GraphQLError("Please sign in to continue.")
    m = get_membership(user)
    if not m:
        raise GraphQLError("Your account has no organisation.")
    if perm and m.role not in PERMS[perm]:
        raise GraphQLError("Your role does not allow this action.")
    return user, m.organization, m


def staff_only(info):
    user = info.context.user
    if not user.is_authenticated or not user.is_staff:
        raise GraphQLError("Platform admin access required.")
    return user
