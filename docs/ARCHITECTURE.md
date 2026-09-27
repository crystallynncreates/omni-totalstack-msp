# Architecture

```
Browser (React SPA on Vercel CDN)
 ├─ Public: /  (landing)   /platform   /portal/:client   /login
 └─ App:    /app/*  ── Zustand store (src/lib/store.ts) ── demo seed or Supabase
          │
          ▼  fetch /api/<route>/<action>  (Bearer Supabase JWT)
Vercel Function  api/index.ts  → api/_handlers/*
          │            │                 │
          ▼            ▼                 ▼
   Supabase (Postgres+RLS)   3rd-party APIs (Claude, NinjaOne/Atera, Huntress,     Vercel Cron
   integration_secrets(AES)   Graph, UniFi, QBO, Stripe, Gusto, Vapi, Resend)      weekly-updates / daily
          ▲
   Omni Agent (python, at client site) ── POST /api/discovery/ingest (AGENT_TOKEN)
```

## Workflow glue
- **Ticket marked billable** → shows in the Invoice Builder "Billable tickets" palette → marked `invoiced` once billed.
- **Project hours** → Invoice Builder "Project hours".
- **Procurement PO received** → inventory stock + vendor bill (expense → QuickBooks).
- **Inventory item assigned to a client** → Invoice Builder "Hardware".
- **Discovery finds a new device** → one-click add to the client's devices (and notification).
- **Proposal accepted** → client becomes onboarding, MRR and SLA tier set, MSA and Huntress contracts created, signed RFS added to documents, draft invoice created, onboarding project with milestones created, lead marked won.
- **Invoice past due** → Notice of Non-Payment pre-generated (Home + Finance → Notices).
- **Contract ≤ 30 days from expiry** → rendered red everywhere, plus a daily notification.
- **Patch** → soaking → approved after N bug-free days → deploy via RMM → listed in the next weekly client email.
- **Payment in portal** → Stripe → webhook → invoice paid, payment recorded, auto-pay saved.

## Onboarding and updates UX
- First sign-in: `SetupWizard` (business, branding, policies, tools, first client and tech), then `Tour` (spotlight on nav items).
- New version: when `APP_VERSION` ≠ `ui.lastSeenVersion`, `WhatsNew` opens with release notes and a "Show me what changed" tour.
