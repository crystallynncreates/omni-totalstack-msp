// One-time Stripe setup for the Omni platform (safe to run again — it reuses what already exists).
// Creates the 4 plan prices, the billing webhook, and the customer portal, then prints the
// values to put in Vercel: STRIPE_PRICE_*, PLATFORM_STRIPE_WEBHOOK_SECRET.
//
// Usage:  STRIPE_KEY=sk_live_... PUBLIC_URL=https://omni-totalstack.com node scripts/setup-stripe.mjs
const KEY = process.env.STRIPE_KEY
const BASE = (process.env.PUBLIC_URL || 'https://omni-totalstack.com').replace(/\/$/, '')
if (!KEY) { console.error('Set STRIPE_KEY first.'); process.exit(1) }

async function stripe(path, params, method) {
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method: method || (params ? 'POST' : 'GET'),
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params).toString() : undefined,
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`${path}: ${j.error?.message || r.status}`)
  return j
}

const PLANS = [
  { env: 'STRIPE_PRICE_STARTER', lookup: 'omni_starter_monthly', name: 'Omni TotalStack MSP — Starter', cents: 2999, recurring: true, desc: '1 staff seat, 1 client, 25 devices.' },
  { env: 'STRIPE_PRICE_UNLIMITED', lookup: 'omni_unlimited_monthly', name: 'Omni TotalStack MSP — Unlimited', cents: 9900, recurring: true, desc: 'Unlimited clients and devices, 2 staff seats.' },
  { env: 'STRIPE_PRICE_BUSINESS', lookup: 'omni_business_monthly', name: 'Omni TotalStack MSP — Business', cents: 24900, recurring: true, desc: 'Unlimited clients and devices, 10 staff seats, custom domain.' },
  { env: 'STRIPE_PRICE_ENTERPRISE', lookup: 'omni_enterprise_lifetime', name: 'Omni TotalStack MSP — Enterprise (lifetime)', cents: 450000, recurring: false, desc: 'One-time purchase: your own standalone copy, disconnected from the Omni platform.' },
]
const EVENTS = ['checkout.session.completed', 'invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted']

const out = {}
const acct = await stripe('/account')
out.account = `${acct.settings?.dashboard?.display_name || acct.business_profile?.name || acct.id} (${KEY.startsWith('sk_live') || KEY.startsWith('rk_live') ? 'LIVE' : 'TEST'} mode)`

for (const p of PLANS) {
  const found = await stripe(`/prices?active=true&lookup_keys[]=${p.lookup}`)
  let price = found.data[0]
  if (!price) {
    const prod = await stripe('/products', { name: p.name, description: p.desc })
    const params = { product: prod.id, unit_amount: String(p.cents), currency: 'usd', lookup_key: p.lookup }
    if (p.recurring) params['recurring[interval]'] = 'month'
    price = await stripe('/prices', params)
  }
  out[p.env] = price.id
}

const url = `${BASE}/api/billing/webhook`
const hooks = await stripe('/webhook_endpoints?limit=100')
const existing = hooks.data.find((h) => h.url === url)
if (existing) {
  await stripe(`/webhook_endpoints/${existing.id}`, { disabled: 'false', ...Object.fromEntries(EVENTS.map((e, i) => [`enabled_events[${i}]`, e])) })
  out.PLATFORM_STRIPE_WEBHOOK_SECRET = '(unchanged — webhook already existed; keep the current Vercel value, or delete the webhook in Stripe and re-run to get a new secret)'
} else {
  const h = await stripe('/webhook_endpoints', { url, description: 'Omni TotalStack MSP platform billing', ...Object.fromEntries(EVENTS.map((e, i) => [`enabled_events[${i}]`, e])) })
  out.PLATFORM_STRIPE_WEBHOOK_SECRET = h.secret
}

const portals = await stripe('/billing_portal/configurations?active=true&limit=100')
const mine = portals.data.find((c) => c.metadata?.omni === 'platform')
if (mine) { out.STRIPE_PORTAL_CONFIG = mine.id } else {
  const c = await stripe('/billing_portal/configurations', {
    'business_profile[headline]': 'Manage your Omni TotalStack MSP plan',
    'features[payment_method_update][enabled]': 'true',
    'features[invoice_history][enabled]': 'true',
    'features[customer_update][enabled]': 'true',
    'features[customer_update][allowed_updates][0]': 'email',
    'features[customer_update][allowed_updates][1]': 'address',
    'features[subscription_cancel][enabled]': 'true',
    'default_return_url': `${BASE}/app/billing`,
    'metadata[omni]': 'platform',
  })
  out.STRIPE_PORTAL_CONFIG = c.id
}

console.log(JSON.stringify(out, null, 2))
