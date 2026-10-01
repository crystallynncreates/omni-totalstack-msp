# CLAUDE.md — Omni TotalStack MSP

Read `docs/PROJECT_MEMORY.md` first. It's the full requirements, decisions, open items and change log. Update it (and bump `APP_VERSION` in `src/lib/store.ts` plus add an entry to `releases` in `src/lib/seed.ts`) whenever you ship a change, so the in-app "What's new" tour stays accurate.

Conventions:
- The UI must stay novice-friendly: every page gets a `PageHeader` `help` line, empty states explain the next step, and nothing breaks without API keys.
- Types live in `src/lib/types.ts` and mirror `supabase/migrations/*.sql` (snake_case in DB, camelCase in app).
- New API endpoints go in `api/_handlers/<name>.ts` and get registered in `api/index.ts`. Relative imports in `api/` MUST end in `.js` (Vercel runs them as native ESM; extensionless imports crash with FUNCTION_INVOCATION_FAILED). Return `demo(res, 'X')` when not configured.
- Huntress must remain mandatory in every proposal option (`mandatory: true`).
- Patch deployment must respect `patchStage()`. Never bypass the soak policy in code.
- Verify with `npx tsc -b && npx tsc -p api/tsconfig.json && npm run build`.
- Multi-tenant: all workspace data is in `records` (org_id, collection, id, data) with RLS; never add a table without `org_id` + RLS. Billing fields on `orgs` are server-only.
- Plans/limits/features live in `shared/plans.ts` (used by both app and API) and are also enforced by DB triggers.
- An MSP's integration keys must never fall back to platform env vars (see `PLATFORM_PROVIDED` in `api/_lib/util.ts`).
- Command Console (`shared/commands.ts` → `api/_handlers/command.ts` → `api/_lib/adapters.ts`): the server re-parses the text; never accept steps from the browser. Keep DELETE/ALL confirmations, admin-only intents and the patch soak check.
- Customer Guides (`/app/guides`) are platform-owner only.
