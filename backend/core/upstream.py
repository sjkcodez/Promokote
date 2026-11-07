"""
Client for the upstream platform Promokote is built on top of.

    POST {UPSTREAM_BASE_URL}/send-email/  {recipient, subject, html_body}
    POST {UPSTREAM_BASE_URL}/send-sms/    {to, text}

Auth: X-API-KEY / X-API-SECRET headers (Promokote's own credentials on the upstream; customers never see them).
When UPSTREAM_FAKE is on (default when no credentials are configured) nothing is sent - useful for local development.
"""
import uuid
import requests
from django.conf import settings

TIMEOUT = 20


class UpstreamError(Exception):
    pass


def _headers():
    return {"Content-Type": "application/json", "X-API-KEY": settings.UPSTREAM_API_KEY,
            "X-API-SECRET": settings.UPSTREAM_API_SECRET}


def _post(path, payload):
    if settings.UPSTREAM_FAKE:
        return {"id": f"fake-{uuid.uuid4().hex[:12]}", "fake": True}
    try:
        r = requests.post(f"{settings.UPSTREAM_BASE_URL}/{path}/", json=payload, headers=_headers(), timeout=TIMEOUT)
    except requests.RequestException as exc:
        raise UpstreamError(f"Upstream unreachable: {exc}") from exc
    try:
        data = r.json()
    except ValueError:
        data = {"raw": r.text[:300]}
    if r.status_code >= 400:
        msg = data.get("detail") or data.get("error") or data.get("message") or r.text[:200]
        raise UpstreamError(f"Upstream {r.status_code}: {msg}")
    return data if isinstance(data, dict) else {"data": data}


def provider_id(data):
    for k in ("id", "message_id", "messageId", "uuid"):
        if data.get(k):
            return str(data[k])[:100]
    return ""


def send_email(recipient, subject, html_body):
    return _post("send-email", {"recipient": recipient, "subject": subject, "html_body": html_body})


def send_sms(to, text):
    return _post("send-sms", {"to": to, "text": text})
