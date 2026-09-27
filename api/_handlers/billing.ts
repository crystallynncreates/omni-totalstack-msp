// Omni subscription billing: checkout (upgrade / reactivate), customer portal, and the Stripe webhook that
// activates workspaces on payment and locks them on non-payment (after a grace period).
import { body, env, fail, mustDb, ok, origin, raw, sendEmail, type Ctx, type Req, type Res } from '../_lib/util'
import { stripeCall, verifyStripe } from '../_lib/stripe'
import { GRACE_DAYS, HANDOFF_DAYS, PLANS, type PlanId } from '../../shared/plans'

const planFromPrice = (priceId?: string): PlanId | null => {
  for (const p of Object.values(PLANS)) if (p.priceEnv && env(p.priceEnv) && env(p.priceEnv) === priceId) return p.id
  return null
}

async function ownerEmail(orgId: string) {
  const { data } = await mustDb().from('org_members').select('email').eq('org_id', orgId).eq('role', 'owner').limit(1).maybeSingle()
  return data?.email as string | undefined
}

export default async function billing(req: Req, res: Res, action: string, ctx: Ctx | null) {
  const key = env('PLATFORM_STRIPE_SECRET_KEY')
  const sb = mustDb()

  if (action === 'webhook') {
    const payload = await raw(req)
    if (!verifyStripe(payload, String(req.headers['stripe-signature'] || ''), env('PLATFORM_STRIPE_WEBHOOK_SECRET'))) return fail(res, 400, 'Bad signature')
    const evt = JSON.parse(payload)
    const { error: dup } = await sb.from('billing_events').insert({ id: evt.id, type: evt.type, payload: evt })
    if (dup) return ok(res, { duplicate: true })
    const o = evt.data.object
    // Lifetime (Enterprise) orgs have no subscription — ignore any subscription events for them.
    const byCustomer = async (cust: string) => (await sb.from('orgs').select('id,name,status,license').eq('stripe_customer_id', cust).neq('license', 'lifetime').maybeSingle()).data

    // Enterprise: one-time lifetime purchase → standalone copy, handoff window, then disconnected from the platform
    if (evt.type === 'checkout.session.completed' && o.mode === 'payment' && o.metadata?.plan === 'enterprise' && o.payment_status === 'paid') {
      const orgId = o.metadata?.orgId || o.client_reference_id
      const { data: prev } = await sb.from('orgs').select('stripe_subscription_id').eq('id', orgId).maybeSingle()
      if (prev?.stripe_subscription_id && key) { try { await stripeCall(key, `/subscriptions/${prev.stripe_subscription_id}`, undefined, 'DELETE') } catch { /* already gone */ } }
      const handoff = new Date(Date.now() + HANDOFF_DAYS * 864e5).toISOString()
      await sb.from('orgs').update({ plan: 'enterprise', license: 'lifetime', status: 'active', grace_until: null, stripe_customer_id: o.customer, stripe_subscription_id: null, handoff_by: handoff }).eq('id', orgId)
      await sb.from('billing_events').update({ org_id: orgId }).eq('id', evt.id)
      const to = await ownerEmail(orgId)
      if (to) await sendEmail(to, 'You own Omni TotalStack MSP Enterprise — next steps', `<p>Thank you! Your one-time Enterprise purchase is complete. There are no monthly fees.</p><p><b>What happens next:</b> we set up your own standalone copy, fully disconnected from the Omni platform, on the domain you purchase. Your current workspace stays online until <b>${new Date(handoff).toDateString()}</b> while we move your data over.</p><ol><li>Buy your domain (for example from Cloudflare or GoDaddy).</li><li>Open <a href="${origin(req)}/app/billing">Plan & Billing → Standalone setup</a> and follow the checklist.</li></ol>`)
      return ok(res, { received: true })
    }

    if (evt.type === 'checkout.session.completed' && o.mode === 'subscription') {
      const orgId = o.metadata?.orgId || o.client_reference_id
      await sb.from('orgs').update({ status: 'active', plan: o.metadata?.plan, stripe_customer_id: o.customer, stripe_subscription_id: o.subscription, grace_until: null }).eq('id', orgId)
      await sb.from('billing_events').update({ org_id: orgId }).eq('id', evt.id)
      const to = await ownerEmail(orgId)
      if (to) await sendEmail(to, 'Your Omni TotalStack MSP workspace is live', `<p>Welcome aboard! Your payment went through and your workspace is ready.</p><p><a href="${origin(req)}/login">Sign in to your Command Center</a> — the setup wizard will walk you through branding and your first client.</p>`)
    }
    if (evt.type === 'invoice.paid' || evt.type === 'invoice.payment_succeeded') {
      const org = await byCustomer(o.customer)
      if (org) await sb.from('orgs').update({ status: 'active', grace_until: null, current_period_end: o.lines?.data?.[0]?.period?.end ? new Date(o.lines.data[0].period.end * 1000).toISOString() : null }).eq('id', org.id)
    }
    if (evt.type === 'invoice.payment_failed') {
      const org = await byCustomer(o.customer)
      if (org) {
        const grace = new Date(Date.now() + GRACE_DAYS * 864e5).toISOString()
        await sb.from('orgs').update({ status: 'past_due', grace_until: grace }).eq('id', org.id).is('grace_until', null)
        const to = await ownerEmail(org.id)
        if (to) await sendEmail(to, 'Action needed: your Omni payment failed', `<p>We couldn't process your latest Omni TotalStack MSP payment.</p><p>Your workspace, landing page and client portal stay online for <b>${GRACE_DAYS} days</b>. After that they're paused until payment is received. <a href="${origin(req)}/app/billing">Update your payment method</a>.</p>`)
      }
    }
    if (evt.type === 'customer.subscription.updated') {
      const org = await byCustomer(o.customer)
      if (org) {
        const plan = planFromPrice(o.items?.data?.[0]?.price?.id)
        const map: Record<string, string> = { active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'suspended', canceled: 'canceled', incomplete_expired: 'suspended', paused: 'suspended' }
        const patch: Record<string, unknown> = { status: map[o.status] || org.status, current_period_end: o.current_period_end ? new Date(o.current_period_end * 1000).toISOString() : null }
        if (plan) patch.plan = plan
        if (patch.status === 'active') patch.grace_until = null
        await sb.from('orgs').update(patch).eq('id', org.id)
      }
    }
    if (evt.type === 'customer.subscription.deleted') {
      const org = await byCustomer(o.customer)
      if (org) await sb.from('orgs').update({ status: 'canceled' }).eq('id', org.id)
    }
    return ok(res, { received: true })
  }

  if (!ctx) return fail(res, 401, 'Please sign in.')
  const org = ctx.org

  if (action === 'status') return ok(res, { plan: org.plan, status: org.status, comped: org.comped, grace_until: org.grace_until, current_period_end: org.current_period_end })

  if (!['owner', 'admin'].includes(ctx.role)) return fail(res, 403, 'Only the workspace owner can manage billing.')
  if (org.comped) return fail(res, 400, 'This workspace is complimentary — there is nothing to bill.')
  if (org.license === 'lifetime' && action === 'checkout') return fail(res, 400, 'You own Omni Enterprise outright — there is no subscription to change.')
  if (!key) return fail(res, 503, 'Online billing is not configured on this server yet.')

  if (action === 'checkout') {
    const b = await body<{ plan: PlanId }>(req)
    const plan = PLANS[b.plan] ? b.plan : org.plan
    // Enterprise = one-time lifetime purchase (the monthly subscription is canceled once it's paid)
    if (PLANS[plan].billing === 'one_time') {
      const params: Record<string, string> = {
        mode: 'payment', 'line_items[0][price]': env(PLANS[plan].priceEnv!), 'line_items[0][quantity]': '1',
        client_reference_id: org.id, 'metadata[orgId]': org.id, 'metadata[plan]': plan, 'payment_intent_data[metadata][orgId]': org.id, 'invoice_creation[enabled]': 'true',
        success_url: `${origin(req)}/app/billing?paid=enterprise`, cancel_url: `${origin(req)}/app/billing`,
      }
      if (org.stripe_customer_id) params.customer = org.stripe_customer_id
      else { params.customer_email = ctx.email; params.customer_creation = 'always' }
      const s = await stripeCall<{ url: string }>(key, '/checkout/sessions', params)
      return ok(res, { url: s.url })
    }
    // Existing subscription → switch price in place. Otherwise → new Checkout.
    if (org.stripe_subscription_id && org.status !== 'canceled') {
      const sub = await stripeCall<{ items: { data: { id: string }[] } }>(key, `/subscriptions/${org.stripe_subscription_id}`)
      await stripeCall(key, `/subscriptions/${org.stripe_subscription_id}`, { 'items[0][id]': sub.items.data[0].id, 'items[0][price]': env(PLANS[plan].priceEnv!), proration_behavior: 'create_prorations', 'metadata[plan]': plan })
      await sb.from('orgs').update({ plan }).eq('id', org.id)
      return ok(res, { ok: true, changed: plan })
    }
    const params: Record<string, string> = {
      mode: 'subscription', 'line_items[0][price]': env(PLANS[plan].priceEnv!), 'line_items[0][quantity]': '1',
      client_reference_id: org.id, 'metadata[orgId]': org.id, 'metadata[plan]': plan, 'subscription_data[metadata][orgId]': org.id,
      success_url: `${origin(req)}/app/billing?paid=1`, cancel_url: `${origin(req)}/app/billing`,
    }
    if (org.stripe_customer_id) params.customer = org.stripe_customer_id
    else params.customer_email = ctx.email
    const s = await stripeCall<{ url: string }>(key, '/checkout/sessions', params)
    return ok(res, { url: s.url })
  }

  if (action === 'portal') {
    if (!org.stripe_customer_id) return fail(res, 400, 'No billing account yet — choose a plan first.')
    const s = await stripeCall<{ url: string }>(key, '/billing_portal/sessions', { customer: org.stripe_customer_id, return_url: `${origin(req)}/app/billing` })
    return ok(res, { url: s.url })
  }
  return fail(res, 404, 'Unknown billing action')
}
