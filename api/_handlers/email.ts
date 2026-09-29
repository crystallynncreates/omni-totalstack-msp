// Transactional email sent on the MSP's behalf (their brand name as sender): invoices and non-payment notices.
import { body, demo, env, fail, ok, origin, sendEmail, type Ctx, type Req, type Res } from '../_lib/util.js'

export default async function email(req: Req, res: Res, kind: string, ctx: Ctx | null) {
  if (!env('RESEND_API_KEY')) return demo(res, 'Email')
  const b = await body<{ to: string; invoice?: { number: string; dueDate: string; lines: { qty: number; rate: number }[]; taxRate?: number }; text?: string }>(req)
  if (!b.to) return fail(res, 400, 'to required')
  const brand = String(ctx?.org.settings?.name || ctx?.org.name || 'Omni TotalStack MSP')
  const portal = ctx ? `${origin(req)}/m/${ctx.org.slug}/portal` : origin(req)
  if (kind === 'invoice' && b.invoice) {
    const sub = b.invoice.lines.reduce((a, l) => a + l.qty * l.rate, 0)
    const total = sub * (1 + (b.invoice.taxRate || 0) / 100)
    return ok(res, await sendEmail(b.to, `${brand} invoice ${b.invoice.number}`, `<p>Hello,</p><p>Invoice <b>${b.invoice.number}</b> for <b>$${total.toFixed(2)}</b> is due ${b.invoice.dueDate}.</p><p><a href="${portal}">Pay securely online</a> — ACH, card, Apple Pay or Google Pay.</p><p>${brand}</p>`, brand))
  }
  if (kind === 'notice' && b.text) return ok(res, await sendEmail(b.to, `${brand}: Notice of Non-Payment`, `<pre style="font-family:Arial;white-space:pre-wrap">${b.text.replace(/</g, '&lt;')}</pre>`, brand))
  return fail(res, 400, 'Unknown email kind')
}
