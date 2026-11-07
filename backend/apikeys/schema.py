import graphene
from graphql import GraphQLError
from accounts.permissions import ctx
from billing.services import current_subscription, default_plan
from core.audit import audit
from .models import ApiKey


class ApiKeyType(graphene.ObjectType):
    id = graphene.ID()
    name = graphene.String()
    service = graphene.String()
    key = graphene.String()
    secret_hint = graphene.String()
    last_used_at = graphene.DateTime()
    created_at = graphene.DateTime()
    is_active = graphene.Boolean()


def key_type(k):
    return ApiKeyType(id=k.id, name=k.name, service=k.service, key=k.key, secret_hint=k.secret_hint,
                      last_used_at=k.last_used_at, created_at=k.created_at, is_active=k.is_active)


class CreatedKey(graphene.ObjectType):
    api_key = graphene.Field(ApiKeyType)
    secret = graphene.String(description="Shown only once")


class CreateApiKey(graphene.Mutation):
    class Arguments:
        name = graphene.String(required=True)
        service = graphene.String(required=True)

    Output = CreatedKey

    def mutate(self, info, name, service):
        user, org, _ = ctx(info, "manage_keys")
        if service not in dict(ApiKey.SERVICES):
            raise GraphQLError("Service must be sms, email or all.")
        if not name.strip():
            raise GraphQLError("Give the key a name so you can recognise it later.")
        sub = current_subscription(org)
        limit = (sub.plan if sub else default_plan()).max_api_keys
        if org.api_keys.filter(revoked_at__isnull=True).count() >= limit:
            raise GraphQLError(f"Your plan allows up to {limit} active API keys. Revoke one or upgrade your plan.")
        key, secret = ApiKey.generate(org, user, name.strip(), service)
        audit(org, user, "api_key_created", f"{key.name} ({service})")
        return CreatedKey(api_key=key_type(key), secret=secret)


class RevokeApiKey(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, id):
        user, org, _ = ctx(info, "manage_keys")
        key = org.api_keys.filter(pk=id).first()
        if not key:
            raise GraphQLError("API key not found.")
        key.revoke()
        audit(org, user, "api_key_revoked", key.name)
        return RevokeApiKey(ok=True)


class Query(graphene.ObjectType):
    api_keys = graphene.List(ApiKeyType)

    def resolve_api_keys(self, info):
        _, org, _ = ctx(info, "manage_keys")
        return [key_type(k) for k in org.api_keys.all()]


class Mutation(graphene.ObjectType):
    create_api_key = CreateApiKey.Field()
    revoke_api_key = RevokeApiKey.Field()
