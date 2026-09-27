# Omni TotalStack MSP

**The all-in-one command center for managed service providers, sold as a white-label SaaS.** MSPs buy a plan at `/`, and their own branded workspace, website and client portal go live the moment payment clears. It's built for a first-time MSP owner and a first-time technician, and it's designed to scale to enterprise.

The web app has two sides:

1. **Business Suite:** clients grouped by industry, and each client's documents, proposals, RFS and agreements. It also covers finance (QuickBooks, invoices, payments, notices of non-payment), payroll, procurement and IT strategy/QBR.
2. **Management Hub:** RMM, Microsoft 365, Entra ID, UniFi, inventory and Huntress. It shows site status and outages, contracts expiring (in red), network discovery, a patch policy that holds updates for 15 bug-free days, and a weekly email to clients about updates.

There's also a **public landing page** (lead capture, AI voice calls, appointment booking, pricing, services map) and a **client portal** (tickets, invoices, payments, projects, devices, documents).

> Status: **v1.0.0.** The app is complete. Without API keys it runs on built-in demo data, and each integration goes live once you add its keys. See [`docs/PROJECT_MEMORY.md`](docs/PROJECT_MEMORY.md) for the full requirements, decisions and roadmap.

---

## Quick start (local)

```bash
npm install
npm run dev          # http://localhost:5173
```

- `/` is the Omni sales site for MSP owners, with pricing and signup at `/signup`.
- `/m/demo` is a sample MSP's branded website, and `/m/demo/portal` is its client portal.
- `/login` opens the MSP sign-in. Any email works in demo mode. On first sign-in you get the **setup wizard**, then the **guided tour**.
- `/app/billing`, `/app/team` and `/app/owner` (platform owner only) cover plans, invites and every MSP on the platform.

## Going live

Follow **[`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md)**. It covers Supabase, Stripe, Resend, Vercel, domains and your free owner account.

## Deploy (Vercel + Supabase)

1. Push this repo to GitHub, then **Import** it in Vercel. The framework (Vite) is auto-detected.
2. Create a Supabase project and run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Copy `.env.example` into Vercel → Settings → Environment Variables and fill in what you have.
4. Redeploy. Vercel sets up the cron jobs automatically: each MSP's weekly client update email goes out on the day they chose, and the daily job handles overdue invoices, expiring contracts and non-payment lockouts.

The full step-by-step is in [`docs/SETUP.md`](docs/SETUP.md). Per-vendor keys are covered in [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

## Network discovery agent

Browsers can't scan private networks, so discovery runs through `public/agent/omni_scan.py`. It needs only Python 3, with no installs:

```bash
python omni_scan.py --range 192.168.1.0/24 --out results.json      # then import in the app
python omni_scan.py --auto --post https://YOUR-DOMAIN/api/discovery/ingest --site SITE_ID --token AGENT_TOKEN
```

## Tech

React 19, TypeScript, Vite, Tailwind, Zustand, Recharts, jsPDF and dnd-kit on the front end. Vercel serverless functions (`/api`), Supabase (Postgres, Auth, RLS multi-tenant) and Vercel Cron on the back end.

## Repo map

```
src/
  pages/          # every screen (Landing, Home, Clients, ClientDetail, Proposal*, Finance, Patching, …)
  components/     # Layout (nav), Tour/WhatsNew, SetupWizard, InvoiceBuilder, Topology, shared tables, UI kit
  lib/            # types, store (state), seed (demo data), proposalEngine, patchPolicy, pdf, integrations, api
api/
  index.ts        # single router (/api/<route>/<action>)
  _handlers/      # claude, huntress, graph (M365/Entra), unifi, rmm, quickbooks, stripe, voice, email, cron, discovery, …
  _lib/util.ts    # auth guard, Supabase admin client, AES-GCM secret storage, email
supabase/migrations/0001_init.sql
public/agent/omni_scan.py
docs/             # SETUP, INTEGRATIONS, ARCHITECTURE, PROJECT_MEMORY, AI_VOICE_SCRIPT, ROADMAP
```
