// Client payments INTO each MSP's own Stripe account (ACH, card, Apple Pay / Google Pay), saved methods, auto-pay.
// Amounts are always computed on the server from the invoice record — never trusted from the browser.
import { body, fail, live, ok, orgBySlug, origin, raw, records, putRecord, notify, secret, demo, type Ctx, type Org, type Req, type Res } from '../_lib/util'
import { stripeCall, verifyStripe } from '../_lib/stripe'
import { hasFeature } from '../../shared/plans'

type Inv = { id: string; number: string; clientId: string; status: string; lines: { qty: number; rate: number }[]; taxRate: number }
const total = (i: Inv) => { const s = i.lines.reduce((a, l) => a + l.qty * l.rate, 0); return s + s * (i.taxRate || 0) / 100 }

export default async function stripe(req: Req, res: Res, action: string, ctx: Ctx | null) {
  if (action === 'webhook') {
    const orgId = String(req.query.org || '')
    const payload = await raw(req)
    const whsec = await secret(orgId, 'stripe', 'webhookSecret', 'STRIPE_WEBHOOK_SECRET')
    if (!verifyStripe(payload, String(req.headers['stripe-signature'] || ''), whsec)) return fail(res, 400, 'Bad signature')
    const evt = JSON.parse(payload)
    if ((evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') && evt.data.object.payment_status === 'paid') {
      const s = evt.data.object
      const inv = (await records<Inv>(orgId, 'invoices')).find((i) => i.id === s.metadata.invoiceId)
      if (inv && inv.status !== 'paid') {
        await putRecord(orgId, 'invoices', { ...inv, status: 'paid', paidDate: new Date().toISOString().slice(0, 10) })
        await putRecord(orgId, 'payments', { id: 'pay' + s.id.slice(-10), invoiceId: inv.id, clientId: inv.clientId, amount: s.amount_total / 100, date: new Date().toISOString(), method: s.payment_method_types?.[0] === 'us_bank_account' ? 'ach' : 'card', stripeId: s.id })
        const client = (await records<{ id: string; name: string } & Record<string, unknown>>(orgId, 'clients')).find((c) => c.id === inv.clientId)
        if (client && s.metadata.autopay === 'true') await putRecord(orgId, 'clients', { ...client, autopay: true, stripeCustomer: s.customer, paymentMethod: s.payment_method_types?.[0] === 'us_bank_account' ? 'ach' : 'card' })
        await notify(orgId, 'ok', `${client?.name ?? 'A client'} paid ${inv.number} ($${(s.amount_total / 100).toFixed(2)})`, '/app/finance?tab=payments')
      }
    }
    return ok(res, { received: true })
  }

  if (action === 'pay' || action === 'checkout') {
    const b = await body<{ slug?: string; invoiceId: string; method: string; save?: boolean; autopay?: boolean }>(req)
    const org: Org | null = ctx?.org ?? (b.slug ? await orgBySlug(b.slug) : null)
    if (!org || !live(org)) return fail(res, 404, 'Payments are not available right now.')
    if (!hasFeature(org.plan, 'stripe_payments', org.comped)) return demo(res, 'Online payments')
    const key = await secret(org.id, 'stripe', 'secretKey', 'STRIPE_SECRET_KEY')
    if (!key) return demo(res, 'Stripe')
    const inv = (await records<Inv>(org.id, 'invoices')).find((i) => i.id === b.invoiceId)
    if (!inv || inv.status === 'paid' || inv.status === 'void') return fail(res, 404, 'Invoice not found or already paid.')
    const back = `${origin(req)}/m/${org.slug}/portal`
    const params: Record<string, string> = {
      mode: 'payment', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(Math.round(total(inv) * 100)),
      'line_items[0][price_data][product_data][name]': `Invoice ${inv.number}`, 'line_items[0][quantity]': '1',
      'payment_method_types[0]': b.method === 'ach' ? 'us_bank_account' : 'card',
      success_url: `${back}?paid=${inv.id}`, cancel_url: back,
      'metadata[invoiceId]': inv.id, 'metadata[clientId]': inv.clientId, 'metadata[autopay]': String(!!b.autopay),
    }
    if (b.save || b.autopay) { params['payment_intent_data[setup_future_usage]'] = 'off_session'; params.customer_creation = 'always' }
    const s = await stripeCall<{ url: string }>(key, '/checkout/sessions', params)
    return ok(res, { url: s.url })
  }
  return fail(res, 404, 'Unknown Stripe action')
}
