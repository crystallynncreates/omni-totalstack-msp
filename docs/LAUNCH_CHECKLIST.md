# Launch checklist: selling Omni to other MSPs

Do these once, in order. Each step says where to click.

## 1. Database (Supabase), about 5 minutes
1. supabase.com → **New project** (name: `omni-totalstack`).
2. **SQL Editor** → paste all of `supabase/migrations/0001_init.sql` → **Run**.
3. **Authentication → Providers → Email**: turn on. Under **URL Configuration**, set the Site URL to your domain.
4. **Project Settings → API**: copy the **URL**, the **anon key** and the **service_role key**.

## 2. Stripe: how MSPs pay you, about 10 minutes
1. dashboard.stripe.com → **Product catalog** → add product **Omni TotalStack MSP** with three prices:
   **Starter $29.99 / month (recurring)**, **Unlimited $99 / month (recurring)**, **Business $249 / month (recurring)**, **Enterprise $4,500 (one-time)**. Copy each `price_…` ID.
2. **Developers → Webhooks → Add endpoint**: `https://YOUR-DOMAIN/api/billing/webhook`
   Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the **signing secret**.
3. **Settings → Billing → Customer portal**: turn it on (lets MSPs update cards and see invoices).
4. **Settings → Billing → Automatic emails**: turn on failed-payment emails and Smart Retries.

## 3. Email (Resend), about 5 minutes
resend.com → **Domains** → add and verify `omni-totalstack.com` → create an API key.

## 4. Vercel
1. Import the GitHub repo `crystallynncreates/omni-totalstack-msp` → Deploy.
2. **Settings → Environment Variables**: fill in everything in `.env.example`.
   `PLATFORM_OWNER_EMAILS=crystallynncreates@gmail.com` is what makes your account free.
3. **Settings → Domains**: add `omni-totalstack.com` and the wildcard `*.omni-totalstack.com` (every MSP gets `name.omni-totalstack.com`).
4. Redeploy.

## 5. Your free owner account
Go to `/signup` and sign up with **crystallynncreates@gmail.com**. Any plan works; it becomes a complimentary workspace with every feature that is never billed and stays on the platform. The **Omni Owner Console** then appears in the menu.

## 6. Test a customer end to end (Stripe test mode)
1. In a private window, go to `/signup?plan=unlimited` and pay with card `4242 4242 4242 4242`. Also try `/signup?plan=enterprise` (one-time payment); Plan & Billing then shows the **Standalone setup** checklist.
2. The workspace activates and `/welcome` shows. Sign in and the setup wizard asks for logo, colors and details.
3. Open `/m/<their-slug>`: their branded website. Open `/m/<their-slug>/portal`: their client portal.
4. In the Stripe dashboard, simulate a failed payment. The owner sees a **7-day grace** banner. Run the daily job (or wait) after the grace date: the workspace, website and portal pause. Pay again and everything reactivates.

## How non-payment works
| Event | What happens |
|---|---|
| Payment fails | Status `past_due`, a 7-day grace period starts, owner is emailed, banner shows in the app |
| Grace period ends (daily job) | Status `suspended`: Command Center, public website and client portal are locked (enforced by the database), owner emailed |
| Payment succeeds | Status `active` again immediately; nothing is lost |
| Subscription canceled | Status `canceled`, locked. Data is kept; resubscribing reactivates it |
| Enterprise purchased ($4,500 once) | Lifetime license; any monthly subscription is canceled; hosted workspace stays on for 30 days while their standalone copy is set up (docs/STANDALONE.md), then disconnected |
| Owner Console | You can comp, extend grace, suspend or reactivate any MSP manually, and disconnect or extend Enterprise handoffs |
