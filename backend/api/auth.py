from django.core.cache import cache
from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication
from apikeys.models import ApiKey
from billing.services import current_subscription


class ApiPrincipal:
    is_authenticated = True

    def __init__(self, key):
        self.key, self.organization = key, key.organization


class ApiKeyAuthentication(BaseAuthentication):
    """Authenticates with `X-API-KEY` + `X-API-SECRET` headers (same convention as the upstream platform)."""

    def authenticate_header(self, request):
        return "ApiKey"   # makes DRF answer 401 (not 403) for bad credentials

    def authenticate(self, request):
        key_id = request.headers.get("X-API-KEY")
        secret = request.headers.get("X-API-SECRET")
        if not key_id or not secret:
            raise exceptions.AuthenticationFailed("Missing X-API-KEY or X-API-SECRET header.")
        key = ApiKey.objects.select_related("organization").filter(key=key_id, revoked_at__isnull=True).first()
        if not key or not key.check_secret(secret):
            raise exceptions.AuthenticationFailed("Invalid API credentials.")
        if key.organization.is_suspended:
            raise exceptions.PermissionDenied("This organisation is suspended.")
        # per-key rate limit (requests/minute) from the organisation's plan
        sub = current_subscription(key.organization)
        limit = sub.plan.rate_limit_per_minute if sub else 10
        bucket = f"rl:{key.id}:{int(timezone.now().timestamp() // 60)}"
        cache.add(bucket, 0, 70)
        if cache.incr(bucket) > limit:
            raise exceptions.Throttled(detail=f"Rate limit of {limit} requests/minute exceeded.")
        ApiKey.objects.filter(pk=key.pk).update(last_used_at=timezone.now())
        return ApiPrincipal(key), key
