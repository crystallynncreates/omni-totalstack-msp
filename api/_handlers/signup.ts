// Self-serve purchase: create the MSP's account + workspace, then send them to Stripe Checkout.
// Free Forever and the platform owner's comped account are activated immediately (no payment).
import { body, env, fail, isPlatformOwner, mustDb, ok, origin, orgBySlug, type Req, type Res } from '../_lib/util'
import { stripeCall } from '../_lib/stripe'
import { PLANS, type PlanId } from '../../shared/plans'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'omni', 'login', 'signup', 'portal', 'platform', 'owner', 'billing', 'help', 'docs', 'status', 'mail'])

export function defaultSettings(mspName: string, email: string, ownerName: string) {
  return { name: mspName, legalName: mspName, address: '', city: '', state: '', zip: '', phone: '', email, website: '', accent: 'blue', taxRate: 0, paymentTermsDays: 30, laborRate: 125, afterHoursRate: 187.5, huntressPortalUrl: 'https://huntress.io/login', weeklyEmailDay: 1, weeklyEmailHour: 8, patchSoakDays: 15, ownerName }
}

export default async function signup(req: Req, res: Res, action: string) {
  if (action === 'check-slug') {
    const s = slugify(String(req.query.slug || ''))
    return ok(res, { slug: s, available: s.length >= 2 && !RESERVED.has(s) && !(await orgBySlug(s)) })
  }
  if (req.method !== 'POST') return fail(res, 405, 'POST only')
  const b = await body<{ plan: PlanId; mspName: string; slug?: string; name: string; email: string; password: string }>(req)
  const email = (b.email || '').trim().toLowerCase()
  if (!b.mspName || !b.name || !email || (b.password || '').length < 8) return fail(res, 400, 'Please fill in every field. Passwords need at least 8 characters.')
  const owner = isPlatformOwner(email)
  let plan: PlanId = PLANS[b.plan] ? b.plan : 'free_forever'
  if (owner) plan = 'enterprise'
  if (plan === 'free_forever' && env('FREE_PLAN_ENABLED') === 'false' && !owner) return fail(res, 400, 'Please choose a paid plan.')
  const slug = slugify(b.slug || b.mspName)
  if (slug.length < 2 || RESERVED.has(slug)) return fail(res, 400, 'Please choose a different web address.')
  if (await orgBySlug(slug)) return fail(res, 409, `The address "${slug}" is taken. Try another.`)

  const sb = mustDb()
  const { data: created, error } = await sb.auth.admin.createUser({ email, password: b.password, email_confirm: true, user_metadata: { name: b.name } })
  if (error || !created.user) return fail(res, 409, error?.message?.includes('already') ? 'An account with this email already exists. Sign in instead.' : error?.message || 'Could not create account')
  const userId = created.user.id

  const free = owner || plan === 'free_forever'
  const { data: org, error: oe } = await sb.from('orgs').insert({ name: b.mspName, slug, plan, status: free ? 'active' : 'pending', comped: owner, settings: defaultSettings(b.mspName, email, b.name), owner_user_id: userId }).select('*').single()
  if (oe || !org) { await sb.auth.admin.deleteUser(userId); return fail(res, 500, oe?.message || 'Could not create workspace') }
  await sb.from('org_members').insert({ org_id: org.id, user_id: userId, role: 'owner', name: b.name, email })

  if (free) return ok(res, { ok: true, next: '/login', slug, comped: owner })

  const price = env(PLANS[plan].priceEnv!)
  const key = env('PLATFORM_STRIPE_SECRET_KEY')
  if (!key || !price) return fail(res, 503, 'Online payments are not set up yet. Please contact us to activate your plan.', { orgCreated: true })
  const session = await stripeCall<{ url: string }>(key, '/checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    customer_email: email,
    client_reference_id: org.id,
    'metadata[orgId]': org.id,
    'metadata[plan]': plan,
    'subscription_data[metadata][orgId]': org.id,
    'subscription_data[metadata][plan]': plan,
    allow_promotion_codes: 'true',
    success_url: `${origin(req)}/welcome?org=${slug}`,
    cancel_url: `${origin(req)}/signup?plan=${plan}&canceled=1`,
  })
  return ok(res, { checkoutUrl: session.url, slug })
}
