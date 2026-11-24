"""User management: your own profile and security, your team, and (for Platform Admins) every user on the platform."""
import graphene
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from graphql import GraphQLError
from core.audit import audit
from core.system_mail import send_localized
from .models import Membership, User
from .permissions import ctx, get_membership, staff_only
from .schema import AuthPayload, UserType, check_password, send_verification, user_type
from .tokens import make_jwt, make_signed, revoke_sessions
from .users import can_assign, can_manage, member_status

M = Membership


class TeamMemberType(graphene.ObjectType):
    id = graphene.ID()
    email = graphene.String()
    full_name = graphene.String()
    role = graphene.String()
    status = graphene.String()
    last_login = graphene.DateTime()
    joined_at = graphene.DateTime()
    is_you = graphene.Boolean()
    can_manage = graphene.Boolean()


class AdminUserType(graphene.ObjectType):
    id = graphene.ID()
    email = graphene.String()
    full_name = graphene.String()
    phone = graphene.String()
    organization_name = graphene.String()
    role = graphene.String()
    status = graphene.String()
    is_active = graphene.Boolean()
    is_staff = graphene.Boolean()
    is_superuser = graphene.Boolean()
    email_verified = graphene.Boolean()
    last_login = graphene.DateTime()
    created_at = graphene.DateTime()


def _team_member(m, me):
    u = m.user
    return TeamMemberType(id=u.id, email=u.email, full_name=u.full_name, role=m.role, status=member_status(u),
                          last_login=u.last_login, joined_at=m.created_at, is_you=u.pk == me.user_id,
                          can_manage=can_manage(me, m))


def _admin_user(u):
    m = get_membership(u)
    return AdminUserType(id=u.id, email=u.email, full_name=u.full_name, phone=u.phone,
                         organization_name=m.organization.name if m else "", role=m.role if m else "",
                         status=member_status(u), is_active=u.is_active, is_staff=u.is_staff,
                         is_superuser=u.is_superuser, email_verified=u.email_verified, last_login=u.last_login,
                         created_at=u.created_at)


def _target(org, me, user_id):
    target = org.memberships.select_related("user").filter(user_id=user_id).first()
    if not target:
        raise GraphQLError("Team member not found.")
    if not can_manage(me, target):
        raise GraphQLError("You cannot change this team member.")
    return target


def _confirm_password(user, password):
    if not user.check_password(password or ""):
        raise GraphQLError("Your current password is incorrect.")


class Query(graphene.ObjectType):
    team = graphene.List(TeamMemberType, description="Members of your organisation with what you may do to them")
    admin_users = graphene.List(AdminUserType, search=graphene.String(), status=graphene.String(), limit=graphene.Int())

    def resolve_team(self, info):
        _, org, me = ctx(info)
        return [_team_member(m, me) for m in org.memberships.select_related("user").order_by("created_at")]

    def resolve_admin_users(self, info, search="", status="", limit=100):
        staff_only(info)
        qs = User.objects.order_by("-created_at")
        if search.strip():
            s = search.strip()
            qs = qs.filter(Q(email__icontains=s) | Q(full_name__icontains=s) | Q(phone__icontains=s)
                           | Q(memberships__organization__name__icontains=s)).distinct()
        if status == "deactivated":
            qs = qs.filter(is_active=False)
        elif status == "staff":
            qs = qs.filter(is_staff=True)
        elif status == "unverified":
            qs = qs.filter(email_verified=False)
        return [_admin_user(u) for u in qs[:min(max(1, limit or 100), 500)]]


# ---------------- my account ----------------
class UpdateProfile(graphene.Mutation):
    class Arguments:
        full_name = graphene.String(required=True)
        phone = graphene.String()

    user = graphene.Field(UserType)

    def mutate(self, info, full_name, phone=""):
        from messaging.services import normalize_phone
        user, org, _ = ctx(info)
        if not full_name.strip():
            raise GraphQLError("Enter your name.")
        phone = (phone or "").strip()
        if phone:
            phone = normalize_phone(phone)
            if not phone:
                raise GraphQLError("Enter a valid phone number.")
        user.full_name, user.phone = full_name.strip()[:150], phone or ""
        user.save(update_fields=["full_name", "phone"])
        audit(org, user, "profile_updated")
        return UpdateProfile(user=user_type(user))


class ChangePassword(graphene.Mutation):
    """Changing the password signs out every other device; this session gets a fresh token."""
    class Arguments:
        current_password = graphene.String(required=True)
        new_password = graphene.String(required=True)

    Output = AuthPayload

    def mutate(self, info, current_password, new_password):
        user, org, _ = ctx(info)
        _confirm_password(user, current_password)
        check_password(new_password, user)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        revoke_sessions(user)
        audit(org, user, "password_changed")
        return AuthPayload(token=make_jwt(user), user=user_type(user))


class ChangeEmail(graphene.Mutation):
    class Arguments:
        new_email = graphene.String(required=True)
        password = graphene.String(required=True)

    user = graphene.Field(UserType)

    def mutate(self, info, new_email, password):
        user, org, _ = ctx(info)
        _confirm_password(user, password)
        email = new_email.strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            raise GraphQLError("Enter a valid email address.")
        if email == user.email:
            raise GraphQLError("That is already your email address.")
        if User.objects.filter(email=email).exists():
            raise GraphQLError("An account with this email already exists.")
        old = user.email
        user.email, user.email_verified = email, False
        user.save(update_fields=["email", "email_verified"])
        send_verification(user)
        send_localized(old, "email_changed", user.language, f"{settings.FRONTEND_URL}/forgot-password", new=email)
        audit(org, user, "email_changed", f"{old} -> {email}")
        return ChangeEmail(user=user_type(user))


class SignOutEverywhere(graphene.Mutation):
    """Ends every session on every device; this browser gets a fresh token so it stays signed in."""
    Output = AuthPayload

    def mutate(self, info):
        user, org, _ = ctx(info)
        revoke_sessions(user)
        audit(org, user, "signed_out_everywhere")
        return AuthPayload(token=make_jwt(user), user=user_type(user))


# ---------------- team ----------------
class UpdateMemberRole(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)
        role = graphene.String(required=True)

    member = graphene.Field(TeamMemberType)

    def mutate(self, info, user_id, role):
        user, org, me = ctx(info, "team")
        target = _target(org, me, user_id)
        if not can_assign(me, role):
            raise GraphQLError("You cannot give this role." if role in dict(M.ROLES) else "Choose Admin, Marketer, Developer or Viewer.")
        old = target.role
        target.role = role
        target.save(update_fields=["role"])
        audit(org, user, "member_role_changed", f"{target.user.email}: {old} -> {role}")
        return UpdateMemberRole(member=_team_member(target, me))


class RemoveMember(graphene.Mutation):
    """Removes the person from this organisation. Their access ends immediately."""
    class Arguments:
        user_id = graphene.ID(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, user_id):
        user, org, me = ctx(info, "team")
        target = _target(org, me, user_id)
        email = target.user.email
        target.delete()
        revoke_sessions(target.user)
        audit(org, user, "member_removed", email)
        return RemoveMember(ok=True)


class ResendInvite(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, user_id):
        user, org, me = ctx(info, "team")
        target = _target(org, me, user_id)
        if member_status(target.user) != "invited":
            raise GraphQLError("This person has already accepted the invitation.")
        link = f"{settings.FRONTEND_URL}/reset-password?token={make_signed('reset', target.user)}"
        send_localized(target.user.email, "invite", target.user.language, link, org=org.name,
                       inviter=user.full_name or user.email, role=target.role)
        audit(org, user, "invite_resent", target.user.email)
        return ResendInvite(ok=True)


class TransferOwnership(graphene.Mutation):
    """The owner hands the organisation to another member and becomes an Admin. Needs the owner's password."""
    class Arguments:
        user_id = graphene.ID(required=True)
        password = graphene.String(required=True)

    ok = graphene.Boolean()

    @transaction.atomic
    def mutate(self, info, user_id, password):
        user, org, me = ctx(info)
        if me.role != M.OWNER:
            raise GraphQLError("Only the owner can transfer ownership.")
        _confirm_password(user, password)
        target = org.memberships.select_related("user").filter(user_id=user_id).exclude(user=user).first()
        if not target:
            raise GraphQLError("Team member not found.")
        if member_status(target.user) != "active":
            raise GraphQLError("Ownership can only go to an active member who has signed in.")
        M.objects.filter(pk=me.pk).update(role=M.ADMIN)
        M.objects.filter(pk=target.pk).update(role=M.OWNER)
        audit(org, user, "ownership_transferred", f"to {target.user.email}")
        return TransferOwnership(ok=True)


# ---------------- platform admin ----------------
class AdminUpdateUser(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        is_active = graphene.Boolean()
        is_staff = graphene.Boolean()
        email_verified = graphene.Boolean()

    user = graphene.Field(AdminUserType)

    def mutate(self, info, id, is_active=None, is_staff=None, email_verified=None):
        admin = staff_only(info)
        target = User.objects.filter(pk=id).first()
        if not target:
            raise GraphQLError("User not found.")
        if target.pk == admin.pk and (is_active is False or is_staff is False):
            raise GraphQLError("You cannot deactivate or remove admin rights from your own account.")
        if target.is_superuser and not admin.is_superuser:
            raise GraphQLError("Only a superuser can change another superuser.")
        changes = []
        if is_active is not None and is_active != target.is_active:
            target.is_active = is_active
            changes.append("activated" if is_active else "deactivated")
        if is_staff is not None and is_staff != target.is_staff:
            target.is_staff = is_staff
            changes.append("staff granted" if is_staff else "staff removed")
        if email_verified is not None and email_verified != target.email_verified:
            target.email_verified = email_verified
            changes.append("email verified" if email_verified else "email unverified")
        target.save()
        if is_active is False or is_staff is False:
            revoke_sessions(target)
        m = get_membership(target)
        if changes:
            audit(m.organization if m else None, admin, "admin_user_updated", f"{target.email}: {', '.join(changes)}")
        return AdminUpdateUser(user=_admin_user(target))


class AdminSendPasswordReset(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, id):
        admin = staff_only(info)
        target = User.objects.filter(pk=id, is_active=True).first()
        if not target:
            raise GraphQLError("User not found.")
        link = f"{settings.FRONTEND_URL}/reset-password?token={make_signed('reset', target)}"
        send_localized(target.email, "reset", target.language, link)
        audit(None, admin, "admin_password_reset_sent", target.email)
        return AdminSendPasswordReset(ok=True)


class Mutation(graphene.ObjectType):
    update_profile = UpdateProfile.Field()
    change_password = ChangePassword.Field()
    change_email = ChangeEmail.Field()
    sign_out_everywhere = SignOutEverywhere.Field()
    update_member_role = UpdateMemberRole.Field()
    remove_member = RemoveMember.Field()
    resend_invite = ResendInvite.Field()
    transfer_ownership = TransferOwnership.Field()
    admin_update_user = AdminUpdateUser.Field()
    admin_send_password_reset = AdminSendPasswordReset.Field()
