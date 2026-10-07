# Setup guide (no coding experience needed)

## 1. Try it
Open the deployed site, click **MSP login** and sign in with any email. The setup wizard runs first: choose **Explore with demo data** to learn safely, or **Start fresh**. A 10-step tour follows, and you can replay it any time with the **?** button.

## 2. Put it online (Vercel)
1. Sign in to vercel.com with GitHub → **Add New → Project** → import `omni-totalstack-msp`.
2. Leave the defaults (framework: Vite) → **Deploy**. You get a live URL in about a minute.
3. Optional: Settings → Domains → add your domain (e.g. `omni-totalstack.com`).

## 3. Turn on the database and logins (Supabase)
1. supabase.com → **New project**.
2. **SQL Editor** → paste all of `supabase/migrations/0001_init.sql` → **Run**.
3. **Authentication → Users** → *Add user* for yourself.
4. **SQL Editor**: create your org and membership:
   ```sql
   insert into orgs (name) values ('Omni TotalStack MSP') returning id;
   insert into org_members (org_id, user_id, role) values ('<org id>', '<your auth user id>', 'owner');
   ```
5. **Project Settings → API**: copy the URL, the `anon` key and the `service_role` key.
6. In Vercel → Settings → Environment Variables, add:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (front end)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `INTEGRATIONS_ENCRYPTION_KEY`: any long random sentence
   - `CRON_SECRET`, `AGENT_TOKEN`: random strings
   - `PUBLIC_URL`: your site URL
7. **Redeploy.** Logins are now real accounts.

## 4. Connect your tools
Go to **Integrations** in the app. Each card walks you through getting that vendor's API key. Details are in `docs/INTEGRATIONS.md`.

## 5. Scheduled jobs
Vercel Cron runs these automatically once deployed:
- **Monday 8 AM ET:** weekly system-update email to every active client (needs Resend and Supabase).
- **Daily 7 AM ET:** marks overdue invoices (which creates non-payment notices) and flags contracts expiring within 30 days.

## 6. Install the discovery agent at a client site
Network Discovery → **Install the Omni Agent** tab has the download and the copy-paste commands.
