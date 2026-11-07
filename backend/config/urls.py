from django.contrib import admin
from django.core import signing
from django.http import HttpResponse
from django.urls import include, path
from django.views.decorators.csrf import csrf_exempt
from graphene_django.views import GraphQLView
from accounts.models import Organization
from core.models import OptOut


def unsubscribe(request, token):
    """Public one-click unsubscribe link placed in every campaign email."""
    try:
        data = signing.loads(token, salt="promokote.unsub")
        org = Organization.objects.get(id=data["o"])
        OptOut.objects.get_or_create(organization=org, channel="email", address=data["a"], defaults={"reason": "unsubscribe link"})
    except Exception:
        return HttpResponse("This unsubscribe link is invalid.", status=400)
    return HttpResponse("<div style='font-family:Arial;text-align:center;margin-top:80px'><h2>You have been unsubscribed</h2>"
                        f"<p>You will no longer receive emails from {org.name}.</p></div>")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("graphql/", csrf_exempt(GraphQLView.as_view(graphiql=True))),
    path("api/v1/", include("api.urls")),
    path("u/<str:token>/", unsubscribe),
]
