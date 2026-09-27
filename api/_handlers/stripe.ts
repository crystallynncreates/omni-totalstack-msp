// Stripe: Checkout for invoices (ACH, card, Apple Pay / Google Pay), saved methods, webhook → mark paid.
import crypto from 'node:crypto'
import { body, db, demo, env, fail, ok, raw, secret, type Req, type Res } from '../_lib/util'

const form = (o: Record<string, string>) => new URLSearchParams(o).toString()

export default async function stripe(req: Req, res: Res, action: string) {
  const key = await secret('stripe', 'secretKey', 'STRIPE_SECRET_KEY')
  if (!key) return demo(res, 'Stripe')
  if (action === 'checkout') {
    const b = await body<{ invoiceId: string; amount: number; method: string; clientId: string; save?: boolean; autopay?: boolean }>(req)
    const origin = env('PUBLIC_URL') || `https://${req.headers.host}`
    const params: Record<string, string> = {
      mode: 'payment',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(Math.round(b.amount * 100)),
      'line_items[0][price_data][product_data][name]': `Invoice ${b.invoiceId}`,
      'line_items[0][quantity]': '1',
      'payment_method_types[0]': b.method === 'ach' ? 'us_bank_account' : 'card', // Apple Pay / Google Pay ride on "card"
      success_url: `${origin}/portal/${b.clientId}?paid=${b.invoiceId}`,
      cancel_url: `${origin}/portal/${b.clientId}`,
      'metadata[invoiceId]': b.invoiceId,
      'metadata[clientId]': b.clientId,
      'metadata[autopay]': String(!!b.autopay),
    }
    if (b.save) { params['payment_intent_data[setup_future_usage]'] = 'off_session'; params.customer_creation = 'always' }
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(params) })
    const j = await r.json(); if (!r.ok) return fail(res, r.status, j.error?.message || 'Stripe error')
    return ok(res, { url: j.url })
  }
  if (action === 'webhook') {
    const payload = await raw(req)
    const sig = String(req.headers['stripe-signature'] || '')
    const secretKey = await secret('stripe', 'webhookSecret', 'STRIPE_WEBHOOK_SECRET')
    const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=') as [string, string]))
    const expected = crypto.createHmac('sha256', secretKey).update(`${parts.t}.${payload}`).digest('hex')
    if (!parts.v1 || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))) return fail(res, 400, 'Bad signature')
    const evt = JSON.parse(payload)
    if (evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') {
      const s = evt.data.object
      const sb = db()
      if (sb && s.payment_status === 'paid') {
        await sb.from('invoices').update({ status: 'paid', paid_date: new Date().toISOString().slice(0, 10) }).eq('id', s.metadata.invoiceId)
        await sb.from('payments').insert({ invoice_id: s.metadata.invoiceId, client_id: s.metadata.clientId, amount: s.amount_total / 100, method: s.payment_method_types?.[0] === 'us_bank_account' ? 'ach' : 'card', stripe_id: s.id })
        if (s.metadata.autopay === 'true') await sb.from('clients').update({ autopay: true, stripe_customer: s.customer }).eq('id', s.metadata.clientId)
      }
    }
    return ok(res, { received: true })
  }
  return fail(res, 404, 'Unknown Stripe action')
}
