"""Platform emails (verification, password reset) are sent through the same upstream email endpoint."""
from django.conf import settings
from . import upstream


def send_system_email(to, subject, html):
    if settings.UPSTREAM_FAKE:
        print(f"[system-mail:fake] to={to} subject={subject}\n{html}\n")
        return
    try:
        upstream.send_email(to, subject, html)
    except upstream.UpstreamError as exc:
        print(f"[system-mail] failed for {to}: {exc}")


def wrap(title, body, link, button, lang="en"):
    paste = "Au nakili kiungo hiki:" if lang == "sw" else "Or paste this link:"
    return (f'<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111111">'
            f'<h2 style="color:#111111;border-bottom:3px solid #f59e0b;padding-bottom:8px">{title}</h2>'
            f"<p>{body}</p><p><a href=\"{link}\" style=\"background:#f59e0b;color:#111111;font-weight:bold;padding:12px 20px;"
            f'border-radius:8px;text-decoration:none;display:inline-block">{button}</a></p>'
            f'<p style="color:#6b7280;font-size:12px">{paste} {link}</p></div>')


def send_localized(to, kind, lang, link, **fmt):
    """Send one of the templates in core.i18n.EMAILS in the recipient's language."""
    from .i18n import email_text
    subject, title, body, button = email_text(kind, lang, **fmt)
    send_system_email(to, subject, wrap(title, body, link, button, lang))
