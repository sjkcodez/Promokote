# Deployment Guide — Promokote

Every push to `main` builds backend and frontend Docker images, pushes them to
`ghcr.io/sjkcodez/promokote-backend` and `ghcr.io/sjkcodez/promokote-frontend`,
then SSHes into the server and restarts the stack
(`.github/workflows/deploy.yml`). Postgres runs as its own container on a
named volume so data survives re-deploys.

| Service  | Container port | Host port | Caddy entry                     |
|----------|---------------|-----------|----------------------------------|
| Frontend | 80            | **3027**  | `promokote.com` / `www.…`        |
| Backend  | 8000          | **8027**  | `api.promokote.com`              |
| Postgres | 5432          | (internal)| —                                |

TLS and domain routing are handled by the system-level Caddy already running
on the server (`/etc/caddy/Caddyfile`). Add these two blocks to that file:

```caddy
# ── Promokote ──────────────────────────────────────────────────────────────────
promokote.com, www.promokote.com {
    reverse_proxy http://127.0.0.1:3027
}
api.promokote.com {
    reverse_proxy http://127.0.0.1:8027
}
```

Then reload Caddy:
```bash
sudo systemctl reload caddy
```

Nothing in this repo touches `/etc/caddy/Caddyfile` — it's shared across all
projects on the server and is managed outside this pipeline.

---

## One-time server setup

SSH into the server as the user matching the `SERVER_USER` secret, then:

**1. Install Docker + Compose plugin (if not already present):**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in for the group change to take effect
docker compose version   # should print a version string
```

**2. Create the deploy directory and env file:**

```bash
mkdir -p ~/promokote-deploy
cd ~/promokote-deploy
```

Copy the contents of [`.env.prod.example`](.env.prod.example) into
`~/promokote-deploy/.env` on the server and fill in real values:

| Variable | Description |
|---|---|
| `DJANGO_SECRET_KEY` | Long random string — `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_ALLOWED_HOSTS` | `api.promokote.com` (your real domain) |
| `CORS_ALLOWED_ORIGINS` | `https://promokote.com,https://www.promokote.com` |
| `DB_NAME` | `promokote` (or any name you choose) |
| `DB_USER` | `promokote` |
| `DB_PASSWORD` | A strong password — used to initialise the Postgres container on first run |
| `DATABASE_URL` | `postgresql://promokote:<DB_PASSWORD>@db:5432/promokote` |
| `UPSTREAM_API_KEY` / `UPSTREAM_API_SECRET` | Real keys if you want actual SMS/email delivery; leave blank and messages are simulated |

This `.env` file is **never touched by CI** — it lives only on the server and
persists across all deploys.

**3. Confirm DNS.** `promokote.com`, `www.promokote.com`, and
`api.promokote.com` need A records pointing at this server's IP so Caddy can
issue Let's Encrypt certificates for them.

**4. Confirm the SSH key.** The public key matching the `SSH_PRIVATE_KEY`
GitHub secret must be in `~/.ssh/authorized_keys` on the server for the deploy
user.

Ports 8027 and 3027 do **not** need to be opened to the public internet —
Caddy reaches them over `127.0.0.1`.

---

## GitHub secrets required

| Secret | Value |
|---|---|
| `SERVER_IP` | Your VPS IP address |
| `SERVER_USER` | SSH user (e.g. `tarxemo`) |
| `SSH_PRIVATE_KEY` | Private key whose public half is in `~/.ssh/authorized_keys` on the server |

No registry token secret is needed — the workflow uses the run-scoped
`GITHUB_TOKEN` to authenticate to GHCR.

---

## First deploy

Push to `main` or trigger the workflow manually from the **Actions** tab
(`workflow_dispatch` is enabled). The deploy step validates that
`DJANGO_SECRET_KEY`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` are all non-blank
in `.env` before touching anything, so a misconfigured server fails fast with a
clear message.

After the first successful deploy, create your superuser:

```bash
cd ~/promokote-deploy
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Then seed the billing plans:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_plans
```

Log in at `https://promokote.com/admin`.

---

## What CI does (`.github/workflows/deploy.yml`)

1. **build-backend** — builds `backend/Dockerfile`, pushes `:latest` and
   `:<sha>` to GHCR.
2. **build-frontend** — builds `frontend/Dockerfile`, baking
   `VITE_API_URL=https://api.promokote.com` into the JS bundle at build time
   (Vite inlines env vars — a runtime var won't work here), pushes both tags.
3. **deploy** — copies `docker-compose.prod.yml` to `~/promokote-deploy/` on
   the server, then over SSH: validates `.env`, logs into GHCR with the
   run-scoped token, pulls new images, starts the `db` container and waits for
   it to be healthy, runs `migrate`, then restarts everything. Old images are
   pruned to keep disk clean.

---

## Useful server-side commands

```bash
cd ~/promokote-deploy

# View logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# Manual restart
docker compose -f docker-compose.prod.yml restart backend

# Full teardown (keeps the DB volume)
docker compose -f docker-compose.prod.yml down

# Teardown INCLUDING the DB volume (⚠ destroys all data)
docker compose -f docker-compose.prod.yml down -v

# Open a Django shell
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

---

## Rollback

Every deploy also pushes a `:<git-sha>`-tagged image. To roll back:

```bash
cd ~/promokote-deploy
# Replace <old-sha> with the commit SHA of the last good deploy
docker pull ghcr.io/sjkcodez/promokote-backend:<old-sha>
docker tag ghcr.io/sjkcodez/promokote-backend:<old-sha> ghcr.io/sjkcodez/promokote-backend:latest
docker pull ghcr.io/sjkcodez/promokote-frontend:<old-sha>
docker tag ghcr.io/sjkcodez/promokote-frontend:<old-sha> ghcr.io/sjkcodez/promokote-frontend:latest
docker compose -f docker-compose.prod.yml up -d
```

