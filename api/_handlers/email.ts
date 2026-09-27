// Transactional email: invoices and non-payment notices (Resend).
import { body, demo, env, fail, ok, sendEmail, type Req, type Res } from '../_lib/util'

export default async function email(req: Req, res: Res, kind: string) {
  if (!env('RESEND_API_KEY')) return demo(res, 'Email (Resend)')
  const b = await body<{ to: string; invoice?: { number: string; dueDate: string; lines: { qty: number; rate: number }[] }; text?: string }>(req)
  if (!b.to) return fail(res, 400, 'to required')
  if (kind === 'invoice' && b.invoice) {
    const total = b.invoice.lines.reduce((a, l) => a + l.qty * l.rate, 0)
    const r = await sendEmail(b.to, `Invoice ${b.invoice.number}`, `<p>Hello,</p><p>Your invoice <b>${b.invoice.number}</b> for <b>$${total.toFixed(2)}</b> is due ${b.invoice.dueDate}.</p><p><a href="${env('PUBLIC_URL')}/portal">Pay securely online</a> (ACH, card, Apple Pay, Google Pay).</p>`)
    return ok(res, r)
  }
  if (kind === 'notice' && b.text) return ok(res, await sendEmail(b.to, 'Notice of Non-Payment', `<pre style="font-family:Arial;white-space:pre-wrap">${b.text.replace(/</g, '&lt;')}</pre>`))
  return fail(res, 400, 'Unknown email kind')
}
