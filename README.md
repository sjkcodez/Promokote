
# Promokote

## 📖 Project Definition
Promokote is a unified, enterprise-grade communication platform that offers two distinct services under one roof: **Bulk SMS** and **Business Email**. 

While the platform serves as a single destination for managing customer communications, the architecture is designed so that the SMS service and the Email service act as completely independent, standalone products. Users can choose to subscribe to one or both, but they will interact with a single, unified dashboard.

## 🎯 Project Purpose
The primary goal of Promokote is to simplify multi-channel marketing and transactional messaging for businesses. By combining Bulk SMS and Business Email into one interface, businesses no longer need to juggle multiple vendors, billing accounts, and contact lists. 

Key purposes include:
- Delivering high-throughput promotional and transactional SMS.
- Providing robust business email hosting and sending capabilities (with full DNS, SPF, DKIM, and DMARC management).
- Offering a shared wallet and billing system for both services.
- Maintaining a unified global opt-out/consent registry across both channels to ensure legal compliance.

---

## 🚦 Current Project Status

**Phase 1: Frontend Scaffolding & Design System (Completed)**
The frontend monorepo is fully operational. The application is currently running with mock data and does not yet require the backend to view the UI. 
- Turborepo workspace configured with 5 Next.js apps.
- Shared UI, API Client, and Auth packages created.
- Custom Tailwind v4 design system (Promokote Palette) implemented.
- Mock authentication flow and unified Console dashboard built.
- SMS and Email portal dashboards are rendering.

**Phase 2: Backend Architecture & API (Next Step)**
The Django backend, database schemas, and actual API integrations (Twilio/Telnyx for SMS, SES/Postmark for Email) are yet to be built.

---

## 💻 Technology Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Styling:** Tailwind CSS v4 (using the new `@theme` directive)
- **Monorepo Tooling:** Turborepo & pnpm Workspaces
- **Language:** TypeScript
- **API Client:** `openapi-fetch` (ready for OpenAPI schema generation)

### Backend (Planned Architecture)
- **Framework:** Django & Django REST Framework (Python)
- **Async Workers:** Celery & Redis (for campaign fan-out and DLR processing)
- **Database:** PostgreSQL (with separate schemas for `core`, `sms`, and `email`)
- **Infrastructure:** Postfix & Dovecot (for actual mailbox hosting in Phase 3), AWS SES/Twilio (for Phase 1 relay APIs).

---

## 📁 Full Project Structure

The project is structured as a monorepo. The root contains both the frontend and backend scopes.

```text
promokote/
│
├── frontend/                   # 🟢 CURRENT SCOPE (Active Development)
│   ├── apps/                   # Standalone Next.js applications
│   │   ├── marketing/          # Public site, pricing, signup (Port 3000)
│   │   ├── console/            # Customer dashboard & service selector (Port 3001)
│   │   ├── sms-portal/         # SMS campaigns, contacts, reports (Port 3002)
│   │   ├── email-portal/       # Email domains, sending, reports (Port 3003)
│   │   └── webmail/            # Webmail client (Port 3004 - Phase 2)
│   ├── packages/               # Shared workspace libraries
│   │   ├── ui/                 # Shared React components (Button, Card, Badge)
│   │   ├── design-tokens/      # Tailwind v4 theme and color palettes
│   │   ├── api-client/         # Auto-generated OpenAPI fetch client
│   │   └── auth/               # Shared session/token helpers
│   ├── package.json            # Root workspace package
│   └── turbo.json              # Turborepo pipeline configuration
│
├── backend/                    # 🔴 PLANNED SCOPE (Django Modular Monolith)
│   ├── manage.py
│   ├── config/                 # Django settings, ASGI, Celery
│   ├── apps/
│   │   ├── core/               # Identity, orgs, billing, wallet, API keys
│   │   ├── sms/                # Campaigns, encoding, throughput, DLRs
│   │   └── email/              # Sending domains, DKIM, mailboxes, relays
│   └── shared/                 # Internal event contracts and test harness
│
├── infra/                      # 🟡 INFRASTRUCTURE (Docker, CI/CD)
│   ├── docker/                 # Dockerfiles for backend, frontend, mail
│   ├── compose/                # Local dev docker-compose files
│   └── terraform/              # Cloud infrastructure as code
│
└── docs/                       # Documentation, API specs, ADRs
```

### 📦 Deep Dive: Frontend Apps & Packages
*   **`console`**: The "brain" of the platform. Handles login, wallet balance, and directs users to the correct portal.
*   **`sms-portal`**: Exclusively for SMS. Uses `bg-sms` (Green) accents.
*   **`email-portal`**: Exclusively for Email. Uses `bg-email` (Violet) accents.
*   **`@promokote/ui`**: Contains components that dynamically adapt their colors based on the `tone` prop (e.g., `<Badge tone="sms">` vs `<Badge tone="email">`).
*   **`@promokote/design-tokens`**: The single source of truth for the Promokote color palette.

---

## 🚀 Getting Started (Frontend Development)

### Prerequisites
- Node.js 20+ 
- `pnpm` (v9+) installed globally (`corepack enable`)

### Installation
1. Clone the repository and navigate to the root directory.
2. Install all workspace dependencies:
   ```bash
   pnpm install
   ```

### Running the Apps
To start all five Next.js applications simultaneously:
```bash
pnpm dev
```

The apps will be available at:
- **Marketing:** `http://localhost:3000`
- **Console (Start Here):** `http://localhost:3001`
- **SMS Portal:** `http://localhost:3002`
- **Email Portal:** `http://localhost:3003`
- **Webmail:** `http://localhost:3004`

*Note: Currently, you can log into the Console using the mock form (any email/password works) to view the dashboard.*

### 🧹 Cache Management
If you encounter weird styling issues, module errors, or if your disk is running low on space, clear the Next.js and Turborepo caches:
```bash
rm -rf .turbo
rm -rf frontend/apps/*/.next
pnpm store prune
```

---

## 🎨 Design System & Palette
The platform uses a custom Tailwind v4 configuration. 
- **Primary:** Promokote Blue (`#2563EB`) - Trust and reliability.
- **Accent:** Promo Orange (`#F97316`) - Action and urgency.
- **SMS Theme:** Signal Green (`#10B981`) - The universal color of messaging.
- **Email Theme:** Inbox Violet (`#7C3AED`) - Professional correspondence.
- **Backgrounds:** Cloud (`#F8FAFC`) with White surfaces.
```
