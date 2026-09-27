# Enterprise standalone copy (for the MSP's IT person)

Enterprise is a **one-time $4,500 purchase**. The MSP gets their **own copy** of Omni, on **their own domain** (which they buy) and **their own hosting accounts**. It's fully disconnected from the Omni platform, with no monthly fees to Omni.

After purchase, their hosted workspace on the Omni platform stays online for **30 days** (`HANDOFF_DAYS` in `shared/plans.ts`) so nothing goes offline during the move. The daily job then marks it **disconnected**. The platform owner can also disconnect early or extend the window from the Owner Console.

## Steps (about 45 minutes)

1. **Domain:** the MSP buys a domain, for example `it.acme.com` (a subdomain of a domain they own is fine).
2. **Accounts in the MSP's name:** GitHub, Vercel and Supabase (free tiers are enough to start). Optional: Resend for email, Stripe for their clients' payments.
3. **Code:** copy this repository into the MSP's GitHub, then import it into their Vercel.
4. **Database:** in their Supabase, go to SQL Editor, paste `supabase/migrations/0001_init.sql` and click Run.
5. **Environment variables** in their Vercel:
   ```
   STANDALONE=true
   VITE_STANDALONE_SLUG=<their slug, shown in Plan & Billing>
   VITE_SUPABASE_URL=…            VITE_SUPABASE_ANON_KEY=…
   SUPABASE_URL=…                 SUPABASE_SERVICE_ROLE_KEY=…
   PUBLIC_URL=https://it.acme.com
   INTEGRATIONS_ENCRYPTION_KEY=<long random string>
   CRON_SECRET=<random>
   PLATFORM_OWNER_EMAILS=<the MSP owner's email>
   RESEND_API_KEY=… EMAIL_FROM_ADDRESS=…      (optional, for emails)
   ANTHROPIC_API_KEY=…                          (optional, for the AI assistant)
   QBO_CLIENT_ID=… QBO_CLIENT_SECRET=…          (optional, their own Intuit app)
   ```
   Do **not** set any `PLATFORM_STRIPE_*` or `STRIPE_PRICE_*` variables. Standalone copies have no Omni billing.
6. **Domain:** in Vercel → Domains, add `it.acme.com`, then add the DNS record Vercel shows at the domain provider.
7. **Data:** in the old hosted workspace, go to **Plan & Billing → Download all my data**, then run:
   ```bash
   npm install
   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
   node scripts/import-workspace.mjs omni-<slug>-export.json owner@acme.com 'TempPassw0rd!' https://it.acme.com
   ```
   The script prints an invitation link for every technician and client-portal user.
8. **Sign in** at `https://it.acme.com/login`, change the password, re-enter integration keys (they are never exported), and send the invitations.

## What standalone mode changes
- `/` shows the MSP's own branded website (no Omni sales site). Their client portal is at `/portal`.
- Sign-up is closed; only invited people can log in.
- No Plan & Billing screen, no Owner Console, no "Powered by Omni" footer.
- Nothing ever calls back to the Omni platform.
