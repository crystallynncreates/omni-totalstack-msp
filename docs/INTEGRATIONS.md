# Integrations

All calls go through `/api/<integration>/<action>`, which is handled in `api/_handlers/`. Keys come either from Vercel environment variables or from the in-app Integrations page (stored AES-GCM encrypted in Supabase). Without keys, endpoints return `{ demo: true }` and the UI keeps using demo data.

| Integration | Env vars | Endpoints | Notes |
|---|---|---|---|
| **Claude** | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | `POST /api/claude` | Messages API. Used by the AI Assistant, proposal polishing, ticket suggestions and QBR summaries. |
| **RMM** | `RMM_VENDOR`, `RMM_BASE_URL`, `RMM_CLIENT_ID`, `RMM_CLIENT_SECRET` | `/api/rmm/{devices,alerts,patches,script,deploy}` | NinjaOne (OAuth client credentials, scopes `monitoring management control`) and Atera (X-API-KEY) are implemented. Add more in `rmm.ts`. |
| **Huntress** | `HUNTRESS_API_KEY`, `HUNTRESS_API_SECRET` | `/api/huntress/{organizations,agents,incidents,sync}` | Basic auth against `api.huntress.io/v1`. |
| **Microsoft 365 / Entra ID** | `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` | `/api/graph/{users,groups,mfa,licenses,secure-score,service-health,sync}?tenant=` | App registration with Graph *application* permissions: User.Read.All, Group.Read.All, Directory.Read.All, AuditLog.Read.All, Reports.Read.All, UserAuthenticationMethod.Read.All, SecurityEvents.Read.All, ServiceHealth.Read.All. Use **GDAP** to reach client tenants (pass `tenant`). |
| **UniFi** | `UNIFI_API_KEY` | `/api/unifi/{sites,devices}` | Site Manager API (`api.ui.com/v1`). A host that isn't `connected` = **DOWN**; offline devices = **degraded**. |
| **Inventory / distributor** | `INVENTORY_PROVIDER`, `INVENTORY_API_KEY` | (adapter slot) | Pax8 / Ingram / Sortly. Procurement receives stock into inventory today. |
| **QuickBooks Online** | `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENV` | `/api/quickbooks/{connect,callback,pnl,aging,bills,sync}` | Visit `/api/quickbooks/connect` once to authorize. Tokens refresh automatically. |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `/api/stripe/{checkout,webhook}` | ACH (`us_bank_account`), cards, Apple Pay and Google Pay. Webhook marks invoices paid and turns on auto-pay. Point the webhook to `/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. |
| **Payroll (Gusto)** | `PAYROLL_TOKEN`, `GUSTO_COMPANY_ID` | `/api/payroll/{employees,payrolls,run}` | Omni prepares hours; Gusto handles taxes and direct deposit. |
| **AI voice calls** | `VOICE_PROVIDER`, `VOICE_API_KEY`, `VOICE_ASSISTANT_ID`, `VOICE_PHONE_NUMBER_ID`, `VOICE_FROM_NUMBER` | `POST /api/voice/call` | Vapi (default), Retell or ElevenLabs. Script: `docs/AI_VOICE_SCRIPT.md`. Consent checkbox on the landing page. |
| **Email (Resend)** | `RESEND_API_KEY`, `EMAIL_FROM` | `/api/email/{invoice,notice}`, cron | Verify your sending domain in Resend. |
| **Discovery agent** | `AGENT_TOKEN` | `/api/discovery/{run,jobs,ingest}` | See `public/agent/omni_scan.py`. |

**Security:** apart from public routes (landing forms, Stripe, OAuth callback, agent with token, cron with secret), every endpoint requires a signed-in Supabase user (`Authorization: Bearer <jwt>`, attached automatically by `src/lib/api.ts`).
