# Omni TotalStack MSP — Project Memory ("total recall")

This file is the single source of truth for **what was asked, what was decided and what exists**. Update it whenever scope changes. (`CLAUDE.md` points here so any Claude session picks it up.)

- **Owner:** Crystal (crystallynncreates)
- **Repo:** `github.com/crystallynncreates/omni-totalstack-msp`
- **Started:** 2026-09-27
- **Current version:** 1.0.0

## 1. Vision

Crystal is starting an MSP. She needs a web app that lets **her, and other MSP owners (sold as a SaaS)**, run the whole business single-handedly. It has to be simple enough for a **novice business owner and a novice technician**. The name is **Omni TotalStack MSP**, positioned as a premium, enterprise-grade ecosystem with 107+ integrations, AI, billing, RMM and client portals. SaaS tiers: Free Forever, Unlimited, Business, Enterprise.

## 2. Requirements (as stated) → where they live

| Requirement | Implemented in |
|---|---|
| **Business Suite:** group clients; all documents, proposals, RFS and agreements under each client | `pages/Clients.tsx` (grouped by `group`), `pages/ClientDetail.tsx` → Documents tab aggregates docs, proposals, RFS and invoices |
| **Management Hub:** RMM, MS365, Entra ID, UniFi, inventory | `pages/Infrastructure.tsx`, `Documentation.tsx`, `Inventory.tsx`, `Integrations.tsx`; `api/_handlers/{rmm,graph,unifi}.ts` |
| Link to the Huntress account | Client header button, `pages/Security.tsx`; URL set in Admin or Integrations |
| Site-specific contracts and subscriptions, with expiry dates **in red** | `components/ui.tsx` `<Expiry>` (red when expired or ≤30 days), `ContractsTable`; Home widget |
| Show site outages / network down | Home banner, `Infrastructure.tsx`, client Sites tab; UniFi adapter computes status |
| Network discovery scan | `pages/Discovery.tsx` + `public/agent/omni_scan.py` + `api/_handlers/discovery.ts` |
| Detailed client-needs intake → **three solutions** in a formal proposal | `pages/ProposalWizard.tsx`, `lib/proposalEngine.ts`, `pages/ProposalView.tsx` |
| **Mandatory Huntress** subscription in every proposal (managed under the MSP's business account); must address cybersecurity **and** networking | `proposalEngine.ts` (`mandatory: true`, locked in UI), findings cover both areas |
| RFS (request for service) **PDF** from the selected proposal | `lib/pdf.ts` → `rfsPdf` |
| Push updates only after **15 bug-free days** | `lib/patchPolicy.ts` (soak clock resets when a bug is reported), `pages/Patching.tsx` |
| **Weekly automatic client email** about system-wide updates | `api/_handlers/cron.ts` (`weekly-updates`), `vercel.json` cron, preview in Patching → Weekly email |
| Direct API: Claude, RMM, inventory, Huntress, MS365, Entra ID | `api/_handlers/*`, `lib/integrations.ts` |
| Landing page: leads, **AI voice calls**, **appointment booking**, pricing, services map (+ Process Improvement, Business Health, Print Services) | `pages/Landing.tsx`, `api/_handlers/{leads,voice}.ts`, `docs/AI_VOICE_SCRIPT.md` |
| QuickBooks panel (revenue, expenses, profit, aging, vendor bills, tax categories) | `pages/Finance.tsx` → QuickBooks panel; `api/_handlers/quickbooks.ts` |
| Payroll console (pay periods, employees and contractors, hours, PTO, direct deposit, compliance alerts) | `pages/Employees.tsx`, `api/_handlers/payroll.ts` |
| Invoice builder: drag-and-drop, auto-fill (SLA, billable tickets, project hours, hardware), recurring, PDF and email | `components/InvoiceBuilder.tsx` |
| Client payments: ACH, card, wallets, saved methods, auto-pay, history, receipts | `pages/Portal.tsx`, `api/_handlers/stripe.ts` |
| Financial health: MRR, ARR, cash flow, profit per client and per service, outstanding balances | Finance → Financial health |
| **Notice of Non-Payment**, auto-generated when an invoice is unpaid; must include contractor name/address, owner and prime contractor name/address, description of work, amount owed, last date of service | `lib/pdf.ts` (`nonPaymentText`/`nonPaymentPdf`), Finance → Notices, Home widget; client form captures owner and prime contractor |
| Client side: automated network docs (Network Glue-style: devices, Entra ID/AD, M365 users and groups, diagrams, password rotation) | Client → Network docs tab, `Documentation.tsx`, `components/Topology.tsx` |
| IT strategic planning / QBR (myITprocess-style) | `pages/Strategy.tsx` (scorecard, roadmap by quarter, QBR PDF) |
| Workspaces: Home, Clients, Infrastructure, Operations, Projects, Procurement, Inventory, Finance, Tools, Admin | `components/Layout.tsx` NAV |
| Design: matte black, glassmorphism, neon blue/purple/gold, light/dark toggle, Inter/Sora | `src/index.css` tokens, `tailwind.config.js` |
| **Tutorial on first login**, plus tours for system and site updates | `components/SetupWizard.tsx`, `components/Tour.tsx` (`Tour`, `WhatsNew`); version gate in `Layout.tsx` via `APP_VERSION` |
| All files on GitHub; accessible everywhere | This repo |

## 3. Key decisions

- **Stack:** Vite + React + TS on Vercel, with Supabase for DB/Auth. Chosen to match Crystal's existing *calendi* setup.
- **Demo-first:** every screen works offline on `lib/seed.ts` data and every API call degrades gracefully (`lib/api.ts`), so a novice never sees a broken page.
- **Single API function** (`api/index.ts` router) keeps the project under the Vercel Hobby 12-function limit.
- **Secrets never live in the browser.** They go into Vercel env vars or are AES-GCM encrypted in `integration_secrets`, which is readable only by the service role.
- **Multi-tenant from day one:** every table has `org_id` and RLS through `org_members`, so the product can be sold to other MSPs.
- **RMM:** generic adapter with NinjaOne and Atera implemented. Crystal hasn't chosen an RMM yet.
- **Patch soak:** the clock runs from `max(releaseDate, lastIssueReported)`. Any open issue blocks deployment. Default is 15 days, configurable in Patching → Policy.
- **Weekly email:** Monday 12:00 UTC (8 AM ET) via Vercel Cron. The day and time are also editable in-app for the preview; the server schedule lives in `vercel.json`.
- **Non-payment notice** wording is a template. Lien-notice rules vary by state, so it should get legal review before real use.
- **Services map:** no reference image was received, so an original radial "hub" map was designed. Swap it in if Crystal supplies the picture.

## 4. Open items / next steps

- [ ] Crystal to pick an RMM vendor (NinjaOne recommended) and supply API keys.
- [ ] Create the Supabase project, run the migration and wire `lib/store.ts` to sync collections (currently localStorage). Tables are already in place.
- [ ] Huntress partner account and API keys.
- [ ] Choose a voice provider (Vapi, Retell or ElevenLabs), build the assistant from `docs/AI_VOICE_SCRIPT.md` and buy a number.
- [ ] Custom domain for the landing page.
- [ ] Attorney review of the Notice of Non-Payment template for Crystal's state.
- [ ] Add the service-map reference image if still wanted.
- See `docs/ROADMAP.md` for v1.1+.

## 5. Change log

- **2026-09-27, v1.0.0:** Initial full build: landing, platform pricing, login, setup wizard, tour and what's-new, Command Center, Clients and client folders, leads and bookings, proposals (3 options + Huntress) with RFS/proposal PDFs, finance (QuickBooks panel, invoices, drag-drop builder, payments, health, non-payment notices), employees and payroll, procurement, IT strategy/QBR, sites and infrastructure, discovery and agent, patching with the 15-day soak and weekly email, Huntress security, tickets and SLA, projects and Gantt, inventory with QR, documentation and password rotation, tools, integrations hub (15 core + 123 marketplace), Claude assistant, admin, client portal, serverless API (15 adapters), Supabase schema with RLS, docs.
