from django.contrib.auth.models import AnonymousUser
from django.utils.deprecation import MiddlewareMixin
from .tokens import read_jwt


class JWTAuthMiddleware(MiddlewareMixin):
    """Reads `Authorization: Bearer <jwt>` and sets request.user (used by GraphQL)."""

    def process_request(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if header.startswith("Bearer "):
            from .models import User
            uid = read_jwt(header[7:])
            user = User.objects.filter(id=uid, is_active=True).first() if uid else None
            if user:
                request.user = user
                return
        if not getattr(request, "user", None) or not request.user.is_authenticated:
            request.user = AnonymousUser()
