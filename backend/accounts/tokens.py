"""JWT for the web console + signed one-time tokens for email verification / password reset."""
from datetime import datetime, timezone
import jwt
from django.conf import settings
from django.core import signing


def make_jwt(user):
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user.id), "v": user.token_version, "iat": now, "exp": now + settings.JWT_LIFETIME},
                      settings.SECRET_KEY, algorithm="HS256")


def read_jwt(token):
    """(user id, token version) or (None, None). Tokens issued before versioning count as version 0."""
    try:
        data = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return data["sub"], int(data.get("v", 0))
    except Exception:
        return None, None


def revoke_sessions(user):
    """Invalidate every login token issued so far for `user`."""
    from django.db.models import F
    type(user).objects.filter(pk=user.pk).update(token_version=F("token_version") + 1)
    user.refresh_from_db(fields=["token_version"])


def make_signed(purpose, user):
    # password hash fragment makes reset tokens single-use
    return signing.dumps({"u": str(user.id), "h": user.password[-12:]}, salt=f"promokote.{purpose}")


def read_signed(purpose, token, max_age):
    from accounts.models import User
    try:
        data = signing.loads(token, salt=f"promokote.{purpose}", max_age=max_age)
        user = User.objects.get(id=data["u"])
    except Exception:
        return None
    if purpose == "reset" and user.password[-12:] != data["h"]:
        return None
    return user
