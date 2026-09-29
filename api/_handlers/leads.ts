// Lead capture & booking from each MSP's own public landing page (identified by slug). Leads land in that MSP's workspace.
import crypto from 'node:crypto'
import { body, fail, live, notify, ok, orgBySlug, putRecord, sendEmail, env, type Req, type Res } from '../_lib/util.js'

const id = (p: string) => p + crypto.randomBytes(6).toString('hex')

async function tenantFrom(slug?: string) {
  if (!slug) return null
  const org = await orgBySlug(slug)
  return org && live(org) ? org : null
}

export async function leads(req: Req, res: Res) {
  const l = await body<Record<string, unknown> & { slug?: string }>(req)
  const org = await tenantFrom(l.slug)
  if (!org) return fail(res, 404, 'This page is not accepting requests right now.')
  const lead = { id: id('l'), name: l.name, email: l.email, phone: l.phone, company: l.company, employees: l.employees, interest: l.interest || [], message: l.message || '', source: l.source || 'website', status: 'new', createdAt: new Date().toISOString(), callRequested: !!l.callRequested }
  await putRecord(org.id, 'leads', lead)
  await notify(org.id, 'info', `New website lead: ${lead.name}${lead.company ? ` (${lead.company})` : ''}`, '/app/leads')
  const to = String(org.settings?.email || '')
  if (to) await sendEmail(to, `New lead: ${lead.name}`, `<p>${lead.name} · ${lead.email} · ${lead.phone}</p><p>${lead.message}</p>`, String(org.settings?.name || org.name))
  return ok(res, { ok: true })
}

export async function book(req: Req, res: Res) {
  const a = await body<{ slug?: string; name: string; email: string; phone?: string; topic: string; start: string }>(req)
  const org = await tenantFrom(a.slug)
  if (!org) return fail(res, 404, 'Booking is not available right now.')
  const brand = String(org.settings?.name || org.name)
  const leadId = id('l')
  await putRecord(org.id, 'leads', { id: leadId, name: a.name, email: a.email, phone: a.phone, company: '', interest: [], message: a.topic, source: 'booking', status: 'new', createdAt: new Date().toISOString() })
  await putRecord(org.id, 'appointments', { id: id('a'), leadId, name: a.name, email: a.email, phone: a.phone, start: a.start, topic: a.topic, status: 'booked' })
  await notify(org.id, 'info', `New appointment: ${a.name} on ${new Date(a.start).toLocaleString('en-US', { timeZone: env('BUSINESS_TZ') || 'America/New_York' })}`, '/app/leads')
  await sendEmail(a.email, `You're booked with ${brand}`, `<p>Hi ${a.name},</p><p>You're booked for <b>${new Date(a.start).toLocaleString('en-US', { timeZone: env('BUSINESS_TZ') || 'America/New_York' })}</b> — ${a.topic}.</p><p>Talk soon!<br>${brand}</p>`, brand)
  return ok(res)
}
