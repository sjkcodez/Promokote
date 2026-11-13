from graphene_django.views import GraphQLView
from .i18n import current_language, language_for, translate


class I18nGraphQLView(GraphQLView):
    """GraphQL endpoint that returns error messages in the caller's language (Kiswahili by default)."""

    def dispatch(self, request, *args, **kwargs):
        token = current_language.set(language_for(request))
        try:
            return super().dispatch(request, *args, **kwargs)
        finally:
            current_language.reset(token)

    @staticmethod
    def format_error(error):
        formatted = GraphQLView.format_error(error)
        if isinstance(formatted, dict) and formatted.get("message"):
            formatted = {**formatted, "message": translate(formatted["message"])}
        return formatted
