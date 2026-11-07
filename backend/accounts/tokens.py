"""JWT for the web console + signed one-time tokens for email verification / password reset."""
from datetime import datetime, timezone
import jwt
from django.conf import settings
from django.core import signing


def make_jwt(user):
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user.id), "iat": now, "exp": now + settings.JWT_LIFETIME},
                      settings.SECRET_KEY, algorithm="HS256")


def read_jwt(token):
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])["sub"]
    except Exception:
        return None


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
