# Omni TotalStack MSP — Project Memory ("total recall")

This file is the single source of truth for **what was asked, what was decided and what exists**. Update it whenever scope changes. (`CLAUDE.md` points here so any Claude session picks it up.)

- **Owner:** Crystal (crystallynncreates)
- **Repo:** `github.com/crystallynncreates/omni-totalstack-msp`
- **Started:** 2026-09-27
- **Current version:** 1.3.0 (multi-company SaaS; Enterprise = lifetime standalone)

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

## 2b. v1.1: Omni sold to other MSPs (requested 2026-09-27)

| Requirement | Implemented in |
|---|---|
| Public site that **targets MSP owners** and sells Omni | `pages/OmniHome.tsx` at `/` (features, white-label, rollout steps, pricing, FAQ) |
| Buy a plan → **rolled out once paid** | `pages/Signup.tsx` → `api/_handlers/signup.ts` (account + workspace + Stripe Checkout) → `api/_handlers/billing.ts` webhook sets `active` |
| Each MSP and its clients get the **current site, under their own brand** | Per-workspace data (`records` table + RLS), `lib/cloud.ts` sync; MSP public site & portal `pages/TenantSite.tsx` at `/m/<slug>`, `<slug>.omnitotalstack.com` or a custom domain; `lib/brand.tsx` swaps name/logo/colors |
| Setup wizard & Admin set name, logo, colors, address, rates, policies → used on landing, proposals, RFS, invoices, notices | `components/SetupWizard.tsx`, Admin → Company & branding, saved to `orgs.settings` |
| **Shut down on non-payment** | Stripe webhook → `past_due` + 7-day grace → daily cron → `suspended`; DB function `org_live()` blocks all data access; app shows lock screen; public site/portal go offline |
| **Free account for Crystal** | `PLATFORM_OWNER_EMAILS` → complimentary Enterprise (`comped`), plus **Omni Owner Console** (`pages/OwnerConsole.tsx`) |
| Step 1: self-serve sign-up | `/signup`, slug availability check, reserved names |
| Step 2: charge MSPs + enforce plan limits | `shared/plans.ts`; DB triggers for client/device/seat limits; `FeatureGate`; Plan & Billing page (upgrade/downgrade/portal) |
| Step 3: data online, shared across devices & team | Supabase `records` + realtime; RLS by role (finance data hidden from technicians; clients see only their company) |
| Step 4: each MSP's own integrations | `integration_secrets` per org (AES-GCM); only Claude, email and the QuickBooks app come from the platform; per-org agent tokens; cron runs per MSP |
| Step 5: each MSP's own public pages & domain | `/m/<slug>`, wildcard subdomain, custom domain (Business+) via Admin → Website & domain (+ Vercel API) |
| Step 6: invite team & clients | `pages/Team.tsx`, `api/_handlers/invites.ts`, `pages/AcceptInvite.tsx`; client users land in the branded portal |

Pricing (editable in `shared/plans.ts`, set by Crystal 2026-09-27): **no free plan**. **Starter $29.99/mo** (1 staff login, 1 client, 25 devices; proposals/RFS, branded site & portal, discovery, patching, invoices & notices, weekly emails; integrations limited to RMM, Huntress, M365, Entra ID, UniFi; no client online payments, procurement, payroll, QBO, AI, QBR or custom domain), Unlimited $99/mo (2 seats), Business $249/mo (10 seats, payroll, QBO, AI, QBR, custom domain), **Enterprise $4,500 one-time, forever**. The buyer pays for their own domain and gets a standalone copy that is **disconnected from the platform** (`docs/STANDALONE.md`, `scripts/import-workspace.mjs`, `STANDALONE=true` mode). The hosted workspace stays on for a 30-day handoff window, then it's disconnected. Crystal's own account stays complimentary on the platform.

Verified: the migration was run against Postgres 16 with a Supabase shim. RLS, suspension, grace period, plan limits, seat limits and billing-column protection were all tested with 8 scenarios, and all passed.

## 2c. v1.4 requests (2026-09-30)
- [stated] New integrations: RustDesk, Tactical RMM, Chocolatey, Zammad, Synology, PBS, ITFlow, Uptime Kuma, Proxmox, Entra admin center, Fusion Connect, Windows Server, Automox, Lansweeper, Webex → `src/lib/integrations.ts` (29 core cards) + adapters in `api/_lib/adapters.ts`.
- [stated] Android app for Google Play → PWA (manifest, sw.js, icons) + TWA; `/.well-known/assetlinks.json` from env ANDROID_PACKAGE / ANDROID_SHA256 (`api/_handlers/app.ts`). Steps in `docs/ANDROID_APP.md`; store assets in `docs/play-store/`. Privacy policy at /privacy.
- [stated] Send commands to all integrations by typing (e.g. "update windows 11", add/disable/delete user) → Command Console (`/app/command`, `shared/commands.ts`, `api/_handlers/command.ts`). See `docs/COMMANDS.md`. Patch soak policy enforced server-side.
- [stated] Owner-account-only guides: User & Business Guide for Omni subscribers + Client Guide (tickets, invoices, paying) for Crystal's MSP clients → `/app/guides` (visible only when session.platformOwner), content in `src/lib/guides.ts`, PDF via `guidePdf`.
- [stated] Update the Omni landing page with the new features (Command Console, integrations wall, mobile app, FAQ, privacy link).

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

- [x] Supabase project **omni-totalstack-msp** (ref `flwaleljhiuexhjbxdnn`, us-east-1, org `nnsbnmoxanddyxgbuvhi`, free plan) created 2026-09-27; migrations 0001 + 0002 applied. URL https://flwaleljhiuexhjbxdnn.supabase.co. (The older project `gfhnwydldnvtvquagzav` belongs to another app — never put Omni tables there.)
- [x] Vercel project `omni-totalstack-msp` (prj_d4pqA9fBkFyHNzosyrEWRN7vtJXj, team_lFcREAfNO0wJzcKvnLN49uTe) live at https://omni-totalstack-msp.vercel.app. Env vars set except SUPABASE_SERVICE_ROLE_KEY. Vercel connector works when calls OMIT teamId (passing teamId → 403). Pushing to GitHub main now auto-deploys (also possible: create_deployment gitSource github crystallynncreates/omni-totalstack-msp ref main). Previews are Vercel-auth protected; production is public.
- [x] SUPABASE_SERVICE_ROLE_KEY set in Vercel.
- [x] Stripe LIVE connected 2026-09-29 (account "Crystal Lynn Creates", dedicated secret key "Omni TotalStack"). `scripts/setup-stripe.mjs` created the 4 prices (lookup keys omni_starter_monthly / omni_unlimited_monthly / omni_business_monthly / omni_enterprise_lifetime), webhook → /api/billing/webhook, and portal config; all IDs are in Vercel env (STRIPE_PRICE_*, PLATFORM_STRIPE_*, STRIPE_PORTAL_CONFIG). Cloud sandbox can't reach api.stripe.com — run Stripe scripts on Crystal's PC.
- [ ] Email: Gmail SMTP wired (SMTP_USER=omnitotalstack@gmail.com set); waiting on Crystal's Gmail app password → SMTP_PASS.
- [ ] Supabase Auth → URL Configuration: Site URL https://omni-totalstack-msp.vercel.app (+ redirect URL https://omni-totalstack-msp.vercel.app/**) so password-reset links work.
- [x] Android package generated 2026-09-30 via PWABuilder API (package com.omnitotalstack.app, v1.4.0 / code 1) → on Crystal's PC at C:\Users\CNesm\omni-android\package (.aab, .apk, signing.keystore + signing-key-info.txt — NOT in git). ANDROID_PACKAGE + ANDROID_SHA256 (upload key 58:C5:43:…:54:31) set in Vercel.
- [ ] Crystal: Play Console account ($25), upload .aab, then append Google's app-signing SHA-256 to ANDROID_SHA256 and set VITE_PLAY_STORE_URL once live.
- [ ] Follow `docs/LAUNCH_CHECKLIST.md` (Supabase project, Stripe products + webhook, Resend, Vercel env vars, wildcard domain).
- [ ] Buy the domain `omnitotalstack.com` (or pick another and set `PLATFORM_DOMAIN`).
  - **REMINDER for Crystal when the domain is set up:** switch platform email off Gmail (omnitotalstack@gmail.com, SMTP_USER/SMTP_PASS app password, ~500/day limit) to a branded address on the domain (e.g. updates@<domain> via Resend: verify domain → RESEND_API_KEY + EMAIL_FROM_ADDRESS, then remove SMTP_USER/SMTP_PASS). Also update PUBLIC_URL, the Stripe webhook URL (re-run scripts/setup-stripe.mjs with the new PUBLIC_URL) and add the domain in Vercel.
- [ ] Sign up with crystallynncreates@gmail.com for the free owner workspace.


- [ ] Crystal to pick an RMM vendor (NinjaOne recommended) and supply API keys.
- [ ] Create the Supabase project, run the migration and wire `lib/store.ts` to sync collections (currently localStorage). Tables are already in place.
- [ ] Huntress partner account and API keys.
- [ ] Choose a voice provider (Vapi, Retell or ElevenLabs), build the assistant from `docs/AI_VOICE_SCRIPT.md` and buy a number.
- [ ] Custom domain for the landing page.
- [ ] Attorney review of the Notice of Non-Payment template for Crystal's state.
- [ ] Add the service-map reference image if still wanted.
- See `docs/ROADMAP.md` for v1.1+.

## 5. Change log

- **2026-09-30, v1.4.0:** Command Console, 14 new integrations (+ Entra user admin), Android/PWA app, owner-only Customer Guides, landing page refresh, password-reset flow, privacy policy.

- **2026-09-29:** Live on Vercel with Supabase + Stripe (live mode) connected. Fixed ESM import crash in the API.

- **2026-09-27:** Created the live Supabase project and applied the schema plus a security-hardening migration (0002).

- **2026-09-27, v1.3.0:** Added the Starter plan ($29.99/mo): 1 staff, 1 client, 25 devices, limits enforced in the database and app.

- **2026-09-27, v1.2.0:** Removed the Free Forever plan. Enterprise is now a $4,500 one-time lifetime license: one-time Stripe checkout, cancels any subscription, 30-day handoff, then disconnected; standalone mode, workspace export/import, Owner Console handoff controls.

- **2026-09-27, v1.1.0:** Multi-company SaaS: MSP-facing sales site, self-serve signup with Stripe subscriptions, automatic rollout on payment, per-MSP branded website, portal and custom domain, 7-day grace then lockout on non-payment, plan limits, team and client invites, per-MSP integrations and cron, complimentary owner account with Owner Console, Supabase realtime sync, new multi-tenant schema with RLS.

- **2026-09-27, v1.0.0:** Initial full build: landing, platform pricing, login, setup wizard, tour and what's-new, Command Center, Clients and client folders, leads and bookings, proposals (3 options + Huntress) with RFS/proposal PDFs, finance (QuickBooks panel, invoices, drag-drop builder, payments, health, non-payment notices), employees and payroll, procurement, IT strategy/QBR, sites and infrastructure, discovery and agent, patching with the 15-day soak and weekly email, Huntress security, tickets and SLA, projects and Gantt, inventory with QR, documentation and password rotation, tools, integrations hub (15 core + 123 marketplace), Claude assistant, admin, client portal, serverless API (15 adapters), Supabase schema with RLS, docs.
