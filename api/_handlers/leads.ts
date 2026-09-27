// Website lead capture & appointment booking.
import { body, db, env, ok, sendEmail, type Req, type Res } from '../_lib/util'

export async function leads(req: Req, res: Res) {
  const l = await body<Record<string, unknown>>(req)
  const sb = db()
  if (sb) await sb.from('leads').insert({ name: l.name, email: l.email, phone: l.phone, company: l.company, employees: l.employees, interest: l.interest, message: l.message, source: l.source || 'website', status: 'new' })
  if (env('LEAD_NOTIFY_EMAIL')) await sendEmail(env('LEAD_NOTIFY_EMAIL'), `New lead: ${l.name} (${l.company})`, `<p>${l.name} · ${l.email} · ${l.phone}</p><p>${l.message ?? ''}</p><p>Interests: ${(l.interest as string[] | undefined)?.join(', ') ?? ''}</p>`)
  return ok(res, { ok: true, stored: !!sb })
}

export async function book(req: Req, res: Res) {
  const a = await body<{ name: string; email: string; phone?: string; topic: string; start: string }>(req)
  const sb = db()
  if (sb) {
    const { data: lead } = await sb.from('leads').insert({ name: a.name, email: a.email, phone: a.phone, source: 'booking', status: 'new', message: a.topic }).select('id').single()
    await sb.from('appointments').insert({ lead_id: lead?.id, name: a.name, email: a.email, phone: a.phone, start: a.start, topic: a.topic, status: 'booked' })
  }
  await sendEmail(a.email, 'Your consultation is booked', `<p>Hi ${a.name},</p><p>You're booked for <b>${new Date(a.start).toLocaleString('en-US', { timeZone: env('BUSINESS_TZ') || 'America/New_York' })}</b> — ${a.topic}.</p><p>We'll call you at ${a.phone || 'the number you provided'}. Talk soon!</p>`)
  if (env('LEAD_NOTIFY_EMAIL')) await sendEmail(env('LEAD_NOTIFY_EMAIL'), `New booking: ${a.name}`, `<p>${a.name} (${a.email}) booked ${a.start}: ${a.topic}</p>`)
  return ok(res)
}
