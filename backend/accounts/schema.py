import graphene
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from graphql import GraphQLError
from billing import demo, services as billing
from core.audit import audit
from core.i18n import current_language, normalize
from core.system_mail import send_localized
from .models import Membership, Organization, User
from .permissions import ctx, get_membership
from .tokens import make_jwt, make_signed, read_signed


class OrgType(graphene.ObjectType):
    id = graphene.ID()
    name = graphene.String()
    role = graphene.String()
    sms_enabled = graphene.Boolean()
    email_enabled = graphene.Boolean()
    sms_activated = graphene.Boolean()
    sms_sender_id = graphene.String()


class UserType(graphene.ObjectType):
    id = graphene.ID()
    email = graphene.String()
    full_name = graphene.String()
    email_verified = graphene.Boolean()
    is_staff = graphene.Boolean()
    language = graphene.String()
    organization = graphene.Field(OrgType)


class MemberType(graphene.ObjectType):
    id = graphene.ID()
    email = graphene.String()
    full_name = graphene.String()
    role = graphene.String()


def user_type(u):
    m = get_membership(u)
    o = m.organization if m else None
    org = OrgType(id=o.id, name=o.name, role=m.role, sms_enabled=o.sms_enabled, email_enabled=o.email_enabled,
                  sms_activated=o.sms_activated, sms_sender_id=o.sms_sender_id) if m else None
    return UserType(id=u.id, email=u.email, full_name=u.full_name, email_verified=u.email_verified, is_staff=u.is_staff,
                    language=u.language, organization=org)


def check_password(pw, user=None):
    try:
        validate_password(pw, user)
    except ValidationError as e:
        raise GraphQLError(" ".join(e.messages))


def send_verification(user):
    link = f"{settings.FRONTEND_URL}/verify-email?token={make_signed('verify', user)}"
    send_localized(user.email, "verify", user.language, link)


class AuthPayload(graphene.ObjectType):
    token = graphene.String()
    user = graphene.Field(UserType)


class Register(graphene.Mutation):
    class Arguments:
        email = graphene.String(required=True)
        password = graphene.String(required=True)
        full_name = graphene.String(required=True)
        organization_name = graphene.String(required=True)
        language = graphene.String(description="sw (default) or en")

    Output = AuthPayload

    @transaction.atomic
    def mutate(self, info, email, password, full_name, organization_name, language=None):
        email = email.strip().lower()
        if User.objects.filter(email=email).exists():
            raise GraphQLError("An account with this email already exists.")
        check_password(password)
        if not organization_name.strip():
            raise GraphQLError("Organisation name is required.")
        lang = normalize(language) or current_language.get() or settings.APP_DEFAULT_LANGUAGE
        user = User.objects.create_user(email, password, full_name=full_name.strip(), language=lang)
        org = Organization.objects.create(name=organization_name.strip())
        Membership.objects.create(user=user, organization=org, role=Membership.OWNER)
        billing.start_subscription(org, billing.default_plan())
        demo.grant_on_signup(org, email, demo.client_ip(info.context))
        audit(org, user, "register", email)
        send_verification(user)
        return AuthPayload(token=make_jwt(user), user=user_type(user))


class Login(graphene.Mutation):
    class Arguments:
        email = graphene.String(required=True)
        password = graphene.String(required=True)

    Output = AuthPayload

    def mutate(self, info, email, password):
        user = authenticate(info.context, username=email.strip().lower(), password=password)
        if not user or not user.is_active:
            raise GraphQLError("Incorrect email or password.")
        m = get_membership(user)
        audit(m.organization if m else None, user, "login")
        return AuthPayload(token=make_jwt(user), user=user_type(user))


class VerifyEmail(graphene.Mutation):
    class Arguments:
        token = graphene.String(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, token):
        user = read_signed("verify", token, 60 * 60 * 24 * 3)
        if not user:
            raise GraphQLError("This verification link is invalid or has expired.")
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        return VerifyEmail(ok=True)


class ResendVerification(graphene.Mutation):
    ok = graphene.Boolean()

    def mutate(self, info):
        user = ctx(info)[0]
        if not user.email_verified:
            send_verification(user)
        return ResendVerification(ok=True)


class RequestPasswordReset(graphene.Mutation):
    class Arguments:
        email = graphene.String(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, email):
        user = User.objects.filter(email=email.strip().lower(), is_active=True).first()
        if user:
            link = f"{settings.FRONTEND_URL}/reset-password?token={make_signed('reset', user)}"
            send_localized(user.email, "reset", user.language, link)
        return RequestPasswordReset(ok=True)   # same answer whether or not the account exists


class ResetPassword(graphene.Mutation):
    class Arguments:
        token = graphene.String(required=True)
        password = graphene.String(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, token, password):
        user = read_signed("reset", token, 60 * 60 * 2)
        if not user:
            raise GraphQLError("This reset link is invalid or has expired.")
        check_password(password, user)
        user.set_password(password)
        user.email_verified = True
        user.save()
        return ResetPassword(ok=True)


class InviteMember(graphene.Mutation):
    class Arguments:
        email = graphene.String(required=True)
        full_name = graphene.String()
        role = graphene.String(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, email, role, full_name=""):
        user, org, _ = ctx(info, "team")
        if role not in dict(Membership.ROLES) or role == Membership.OWNER:
            raise GraphQLError("Choose Admin, Marketer, Developer or Viewer.")
        email = email.strip().lower()
        target = User.objects.filter(email=email).first()
        if target and Membership.objects.filter(user=target).exclude(organization=org).exists():
            raise GraphQLError("That person already belongs to another organisation.")
        if not target:
            target = User.objects.create_user(email, None, full_name=full_name, language=user.language)
            target.set_unusable_password()
            target.save()
        Membership.objects.get_or_create(user=target, organization=org, defaults={"role": role})
        link = f"{settings.FRONTEND_URL}/reset-password?token={make_signed('reset', target)}"
        send_localized(email, "invite", target.language, link, org=org.name, inviter=user.full_name or user.email, role=role)
        audit(org, user, "invite_member", f"{email} as {role}")
        return InviteMember(ok=True)


class SetLanguage(graphene.Mutation):
    """Save the signed-in user's interface language so it follows them across sessions and devices."""
    class Arguments:
        language = graphene.String(required=True)

    user = graphene.Field(UserType)

    def mutate(self, info, language):
        user = ctx(info)[0]
        lang = normalize(language)
        if not lang:
            raise GraphQLError("Language must be sw or en.")
        user.language = lang
        user.save(update_fields=["language"])
        return SetLanguage(user=user_type(user))


class Query(graphene.ObjectType):
    me = graphene.Field(UserType)
    members = graphene.List(MemberType)

    def resolve_me(self, info):
        u = info.context.user
        return user_type(u) if u.is_authenticated and get_membership(u) else None

    def resolve_members(self, info):
        _, org, _ = ctx(info)
        return [MemberType(id=m.user.id, email=m.user.email, full_name=m.user.full_name, role=m.role)
                for m in org.memberships.select_related("user")]


class Mutation(graphene.ObjectType):
    register = Register.Field()
    login = Login.Field()
    verify_email = VerifyEmail.Field()
    resend_verification = ResendVerification.Field()
    request_password_reset = RequestPasswordReset.Field()
    reset_password = ResetPassword.Field()
    invite_member = InviteMember.Field()
    set_language = SetLanguage.Field()
