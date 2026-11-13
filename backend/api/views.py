from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import exceptions
from billing import demo
from billing.services import current_subscription, remaining
from messaging.models import Message
from messaging.services import SendError, submit_message
from .auth import ApiKeyAuthentication

MAX_SMS, MAX_EMAIL = 1000, 100


def as_list(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list) and all(isinstance(v, str) for v in value):
        return value
    raise exceptions.ValidationError("Recipients must be a string or a list of strings.")


def serialize(m):
    return {"id": str(m.id), "channel": m.channel, "recipient": m.recipient, "status": m.status, "segments": m.segments,
            "error": m.error or None, "provider_id": m.provider_id or None, "created_at": m.created_at.isoformat(),
            "sent_at": m.sent_at.isoformat() if m.sent_at else None}


class BaseApiView(APIView):
    authentication_classes = [ApiKeyAuthentication]
    permission_classes = []
    channel = None

    def initial(self, request, *a, **kw):
        super().initial(request, *a, **kw)
        if self.channel and not request.auth.allows(self.channel):
            raise exceptions.PermissionDenied(f"This API key is not allowed to use {self.channel.upper()}.")

    def send_many(self, request, channel, recipients, body, subject=""):
        key = request.auth
        idem = request.data.get("idempotency_key") or request.headers.get("Idempotency-Key")
        results, status_code = [], 200
        for i, r in enumerate(recipients):
            try:
                m = submit_message(key.organization, channel, r, body, subject, source="api", api_key=key,
                                   user=key.created_by, idempotency_key=f"{idem}:{r}" if idem else None)
                results.append(serialize(m))
            except SendError as exc:
                if exc.status in (402, 403) and len(recipients) == 1:
                    raise _http_error(exc)
                results.append({"recipient": r, "status": "rejected", "error": str(exc), "code": exc.code})
        ok = any(x["status"] in ("sent", "queued", "sending") for x in results)
        return Response({"success": ok, "messages": results}, status=status_code if ok or len(recipients) > 1 else 400)


def _http_error(exc):
    e = exceptions.APIException(str(exc), exc.code)
    e.status_code = exc.status
    return e


class SendSmsView(BaseApiView):
    channel = "sms"

    def post(self, request):
        to = as_list(request.data.get("to"))
        if not to or len(to) > MAX_SMS:
            raise exceptions.ValidationError(f"'to' must contain between 1 and {MAX_SMS} numbers.")
        return self.send_many(request, "sms", to, str(request.data.get("text") or ""))


class SendEmailView(BaseApiView):
    channel = "email"

    def post(self, request):
        to = as_list(request.data.get("recipient"))
        if not to or len(to) > MAX_EMAIL:
            raise exceptions.ValidationError(f"'recipient' must contain between 1 and {MAX_EMAIL} addresses.")
        body = request.data.get("html_body") or (f"<p>{request.data.get('text_body')}</p>" if request.data.get("text_body") else "")
        return self.send_many(request, "email", to, str(body), str(request.data.get("subject") or ""))


class MessageListView(BaseApiView):
    def get(self, request):
        qs = Message.objects.filter(organization=request.auth.organization, source="api")
        for f in ("channel", "status"):
            if request.query_params.get(f):
                qs = qs.filter(**{f: request.query_params[f]})
        limit = min(int(request.query_params.get("limit", 50) or 50), 200)
        return Response({"messages": [serialize(m) for m in qs[:limit]]})


class MessageDetailView(BaseApiView):
    def get(self, request, pk):
        m = Message.objects.filter(organization=request.auth.organization, pk=pk).first()
        if not m:
            raise exceptions.NotFound("Message not found.")
        return Response(serialize(m))


class UsageView(BaseApiView):
    def get(self, request):
        org = request.auth.organization
        allowance = demo.get_allowance(org)
        extra = {"sms_mode": "demo" if demo.in_demo(org) else "active",
                 "sms_demo": {"granted": allowance.granted if allowance else 0, "used": allowance.used if allowance else 0,
                              "remaining": allowance.remaining if allowance else 0}}
        sub = current_subscription(org)
        if not sub:
            return Response({"subscription": None, **extra})
        return Response({"plan": sub.plan.name, "period_ends_at": sub.ends_at.isoformat(),
                         "sms": {"quota": sub.plan.sms_quota, "used": sub.sms_used, "remaining": remaining(sub, "sms")},
                         "email": {"quota": sub.plan.email_quota, "used": sub.email_used, "remaining": remaining(sub, "email")},
                         **extra})
