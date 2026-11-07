"""Platform emails (verification, password reset) are sent through the same upstream email endpoint."""
from django.conf import settings
from . import upstream


def send_system_email(to, subject, html):
    try:
        upstream.send_email(to, subject, html)
    except upstream.UpstreamError as exc:
        print(f"[system-mail] failed for {to}: {exc}")
    if settings.UPSTREAM_FAKE:
        print(f"[system-mail:fake] to={to} subject={subject}\n{html}\n")


def wrap(title, body, link, button):
    return (f'<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2 style="color:#4f46e5">{title}</h2>'
            f"<p>{body}</p><p><a href=\"{link}\" style=\"background:#4f46e5;color:#fff;padding:12px 20px;"
            f'border-radius:8px;text-decoration:none;display:inline-block">{button}</a></p>'
            f'<p style="color:#6b7280;font-size:12px">Or paste this link: {link}</p></div>')
