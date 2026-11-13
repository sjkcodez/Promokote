# Promokote

Bulk **SMS** and **email** campaigns plus a developer API, in one account.
Django (GraphQL for the web console, REST for external systems) + React/Vite/TypeScript/Tailwind.

```
promokote/
  backend/    Django project  (accounts, billing, apikeys, messaging, api, core)
  frontend/   React + Vite + TypeScript + Tailwind console
```

## How sending works (built on top of your existing platform)

Promokote does **not** talk to carriers or mail servers itself. Every SMS/email is forwarded to the upstream platform:

| Promokote | Upstream (`UPSTREAM_BASE_URL`, default `https://emailbackend.tarxemo.com/api/v1`) |
|---|---|
| `POST /api/v1/send-sms/` | `POST /send-sms/` with `{"to", "text"}` |
| `POST /api/v1/send-email/` | `POST /send-email/` with `{"recipient", "subject", "html_body"}` |

Promokote's own upstream credentials live **only** in `backend/.env` (`UPSTREAM_API_KEY` / `UPSTREAM_API_SECRET`). Customers never see them; they get their own Promokote key + secret, which are scoped, rate-limited and metered against their plan. All code that calls upstream is in `backend/core/upstream.py`.

If the upstream credentials are empty, Promokote runs in **fake mode** (nothing is sent; messages are marked sent with a fake id), so you can develop and demo safely.

## Quick start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                      # then fill in UPSTREAM_API_KEY / UPSTREAM_API_SECRET
python manage.py migrate
python manage.py seed_plans                               # Free Trial, Starter, Business, Scale (editable later)
python manage.py createsuperuser                          # this user becomes a Platform Admin
python manage.py runserver                                # http://localhost:8000  (GraphiQL at /graphql/)
python manage.py run_worker                               # 2nd terminal: scheduled campaigns + resumes queued sends
python manage.py test                                     # 30 tests
```
Default DB is SQLite; set `DATABASE_URL=postgres://user:pass@host:5432/promokote` for PostgreSQL.

### Frontend
```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm install
npm run dev                   # http://localhost:5173
npm run build                 # production build in dist/
```

## Feature map (your requirements)

1. **Register / login** - email + password, JWT session, email verification, forgot/reset password (system emails go out through the upstream email endpoint; in fake mode the link is printed in the backend console).
2. **API key + secret** - *API keys* page. Key is public (`pk_live_...`), secret (`ps_...`) is shown **once** and only an HMAC hash is stored. Scope per key: SMS, Email or both. Revocable. Number of keys limited by plan.
3. **Subscriptions, admin-configurable** - *Platform admin* page (staff users): create/edit plans (price, period, SMS credits, emails, API rate limit, max keys, visibility, default plan), activate paid subscriptions after payment, suspend orgs, toggle SMS/Email entitlement per org. Also editable in Django admin at `/admin/`. Free plans activate instantly; paid plans stay *pending* until a platform admin activates them (no payment gateway is wired in yet).
4. **Send with API credentials** - see the *API docs* page in the console, or:
   ```bash
   curl -X POST http://localhost:8000/api/v1/send-sms/ \
     -H "Content-Type: application/json" -H "X-API-KEY: pk_live_..." -H "X-API-SECRET: ps_..." \
     -d '{"to": "0712345678", "text": "Hello!"}'
   curl -X POST http://localhost:8000/api/v1/send-email/ \
     -H "Content-Type: application/json" -H "X-API-KEY: pk_live_..." -H "X-API-SECRET: ps_..." \
     -d '{"recipient": "a@b.com", "subject": "Hi", "html_body": "<h1>Hello</h1>"}'
   ```
   Also `GET /api/v1/messages/`, `/api/v1/messages/<id>/`, `/api/v1/usage/`. Supports many recipients per call, `Idempotency-Key`, and returns 401/402/403/429 as appropriate.
5. **Built on the upstream system** - see above.
6. **Zip** - this archive.

Also included from the requirements document: organisations + roles (owner/admin/marketer/developer/viewer, enforced per action), tenant isolation (every query scoped to the org; covered by tests), contact lists with CSV/paste import and E.164 normalisation, `{{merge}}` fields, live SMS segment/encoding counter, campaigns (now or scheduled, cancel with credit refund), per-message status log, opt-out registry (SMS by number, email by address; blocked automatically, customers cannot override; one-click unsubscribe link added to every campaign email), audit log of sensitive actions, quota refunds on failed sends, mobile-friendly UI.

## Onboarding, demo SMS and Bulk SMS activation

- **Public site**: `/` is a landing page for visitors (dashboard once signed in); `/pricing` lists packages from the `plans` query.
- **Language**: Kiswahili by default, English via the SW/EN switch (saved on the user as `User.language`). UI strings live in `frontend/src/lib/locales/` (`sw.ts` is type-checked against `en.ts`); GraphQL errors and system emails are translated in `backend/core/i18n.py`.
- **Theme**: light/dark tokens in `frontend/src/index.css`, mapped in `tailwind.config.js` (amber brand, grey + black/white neutrals).
- **10 free demo SMS** per new organisation (`DEMO_SMS_CREDITS`), sent with the generic `DEMO_SMS_SENDER_ID`. Enforced in `billing/demo.py`: atomic conditional deduction + DB check constraint, append-only ledger, owner must verify email, one claim per normalised email (Gmail dots / `+alias` collapsed, survives account deletion), per-IP and per-recipient daily caps. Failed sends are refunded.
- **Bulk SMS activation**: until an organisation's Sender ID is approved (`Organization.sms_activated`), all SMS use the demo allowance. Customers request a Sender ID on *Bulk SMS activation*; platform admins confirm payment and approve/reject in *Platform admin*, where the fee, approval time and payment instructions are also set. Organisations that existed before this change were migrated as already activated.
- Upstream `send-sms` has no sender field today; set `UPSTREAM_SMS_SENDER_FIELD` once it does and the approved Sender ID is passed through.

## Not built yet (from the requirements doc)
Wallet/top-ups and payment provider (Phase 1 in the doc - subscriptions were built instead as requested), sending-domain verification/DKIM (upstream owns the sending domain), webhooks and delivery callbacks (upstream returns only an acknowledgement, so status is *sent/failed*, not *delivered*), inbound STOP replies, templates, TOTP MFA, multi-organisation switching, audit-log screen, data-retention jobs. The backend is split into modules so these can be added without rewrites.

## Production notes
Set `DJANGO_DEBUG=False`, a long random `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, `PUBLIC_BASE_URL` (used in unsubscribe links), use PostgreSQL, run `gunicorn config.wsgi` and keep `run_worker` running (systemd/supervisor). The rate limiter uses an in-process cache; switch `CACHES` to Redis when running more than one worker process. Serve `frontend/dist` from any static host.


only for current hosted
email: promokote@gmail.com
password: @Promokote1234