// Scheduled jobs (Vercel Cron — see vercel.json):
//   weekly-updates : emails every active client a summary of system-wide updates (15-day soak policy)
//   daily          : flags overdue invoices → non-payment notices, expiring contracts, credential rotation due
import { db, demo, env, fail, ok, sendEmail, type Req, type Res } from '../_lib/util'

const DAY = 86400000
const soakEligible = (p: { release_date: string; last_issue_reported?: string | null }, soak: number) =>
  new Date(Math.max(new Date(p.release_date).getTime(), p.last_issue_reported ? new Date(p.last_issue_reported).getTime() : 0) + soak * DAY)

function template(company: string, phone: string, soak: number, client: string, deployed: { title: string; kb: string }[], upcoming: { title: string; eligible: string }[]) {
  const li = (s: string) => `<li style="margin:4px 0">${s}</li>`
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#14161e"><div style="background:#0c0e14;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0"><b style="font-size:18px">${company}</b><div style="color:#9aa3b5;font-size:13px">Weekly System Update Report</div></div><div style="border:1px solid #e3e6ee;border-top:0;padding:24px;border-radius:0 0 12px 12px"><p>Hello ${client} team,</p><p>Here is your weekly summary of system-wide updates. We only deploy updates after they have been <b>bug-free for ${soak} days</b>.</p><h3 style="color:#2563eb">Installed this week</h3><ul>${deployed.length ? deployed.map((d) => li(`${d.title} (${d.kb})`)).join('') : li('No updates were required this week.')}</ul><h3 style="color:#2563eb">Scheduled next</h3><ul>${upcoming.length ? upcoming.map((u) => li(`${u.title} — eligible ${u.eligible}`)).join('') : li('Nothing pending.')}</ul><p>No action is needed on your part. Questions? Call ${phone}.</p></div></div>`
}

export default async function cron(req: Req, res: Res, job: string) {
  // GET = Vercel Cron (CRON_SECRET). POST = manual "send now" from the app (router already verified the signed-in user).
  const authorized = req.method === 'POST' || (!!env('CRON_SECRET') && req.headers.authorization === `Bearer ${env('CRON_SECRET')}`)
  if (!authorized) return fail(res, 401, 'Unauthorized')
  const sb = db()
  if (!sb) return demo(res, 'Supabase (required for scheduled jobs)')
  const { data: company } = await sb.from('company').select('*').limit(1).maybeSingle()
  const soak = company?.patch_soak_days ?? 15

  if (job === 'weekly-updates') {
    const since = new Date(Date.now() - 7 * DAY).toISOString()
    const [{ data: clients }, { data: deployed }, { data: pending }] = await Promise.all([
      sb.from('clients').select('id,name,contact_email').eq('status', 'active'),
      sb.from('patches').select('title,kb,deployed_at').gte('deployed_at', since),
      sb.from('patches').select('title,release_date,last_issue_reported,open_issues').is('deployed_at', null).eq('open_issues', 0),
    ])
    const upcoming = (pending || []).map((p) => ({ title: p.title, eligible: soakEligible(p, soak).toDateString() }))
    let sent = 0
    for (const c of clients || []) {
      if (!c.contact_email) continue
      const r = await sendEmail(c.contact_email, `${company?.name ?? 'Your IT team'}: weekly system update report`, template(company?.name ?? 'Omni TotalStack MSP', company?.phone ?? '', soak, c.name, deployed || [], upcoming))
      if (r.ok) sent++
    }
    await sb.from('audit').insert({ who: 'cron', action: `Weekly update email sent to ${sent} clients` })
    return ok(res, { sent })
  }

  if (job === 'daily') {
    const today = new Date().toISOString().slice(0, 10)
    const { data: overdue } = await sb.from('invoices').select('id,number,client_id').lt('due_date', today).in('status', ['sent'])
    for (const i of overdue || []) {
      await sb.from('invoices').update({ status: 'overdue' }).eq('id', i.id)
      await sb.from('notifications').insert({ level: 'bad', text: `Invoice ${i.number} is past due — Notice of Non-Payment generated`, href: '/app/finance?tab=notices' })
    }
    const soon = new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10)
    const { data: expiring } = await sb.from('contracts').select('name,end_date').lte('end_date', soon).gte('end_date', today)
    for (const k of expiring || []) await sb.from('notifications').insert({ level: 'warn', text: `${k.name} expires ${k.end_date}`, href: '/app/infrastructure' })
    return ok(res, { overdue: overdue?.length ?? 0, expiring: expiring?.length ?? 0 })
  }
  return fail(res, 404, 'Unknown cron job')
}
