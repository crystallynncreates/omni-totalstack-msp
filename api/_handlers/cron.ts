// Scheduled jobs (Vercel Cron — vercel.json), run for EVERY MSP workspace:
//   weekly-updates : each MSP's active clients get that MSP's branded weekly system-update email (15-day soak policy)
//   daily          : lock workspaces whose grace period ended; flag overdue invoices (→ non-payment notices)
//                    and contracts expiring within 30 days
import { env, fail, live, mustDb, notify, ok, putRecord, records, sendEmail, type Ctx, type Org, type Req, type Res } from '../_lib/util'

const DAY = 864e5
type Patch = { title: string; kb: string; releaseDate: string; lastIssueReported?: string; openIssues: number; deployedAt?: string }
const eligible = (p: Patch, soak: number) => new Date(Math.max(new Date(p.releaseDate).getTime(), p.lastIssueReported ? new Date(p.lastIssueReported).getTime() : 0) + soak * DAY)

function template(brand: string, phone: string, soak: number, client: string, deployed: Patch[], upcoming: { title: string; eligible: string }[]) {
  const li = (s: string) => `<li style="margin:4px 0">${s}</li>`
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#14161e"><div style="background:#0c0e14;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0"><b style="font-size:18px">${brand}</b><div style="color:#9aa3b5;font-size:13px">Weekly System Update Report</div></div><div style="border:1px solid #e3e6ee;border-top:0;padding:24px;border-radius:0 0 12px 12px"><p>Hello ${client} team,</p><p>Here is your weekly summary of system-wide updates. We only deploy updates after they have been <b>bug-free for ${soak} days</b>.</p><h3 style="color:#2563eb">Installed this week</h3><ul>${deployed.length ? deployed.map((d) => li(`${d.title} (${d.kb})`)).join('') : li('No updates were required this week.')}</ul><h3 style="color:#2563eb">Scheduled next</h3><ul>${upcoming.length ? upcoming.map((u) => li(`${u.title} — eligible ${u.eligible}`)).join('') : li('Nothing pending.')}</ul><p>No action is needed on your part.${phone ? ` Questions? Call ${phone}.` : ''}</p></div></div>`
}

async function weekly(org: Org, onlyManual = false) {
  const s = org.settings as Record<string, string | number>
  const soak = Number(s.patchSoakDays || 15)
  const patches = await records<Patch>(org.id, 'patches')
  const deployed = patches.filter((p) => p.deployedAt && Date.now() - new Date(p.deployedAt).getTime() <= 7 * DAY)
  const upcoming = patches.filter((p) => !p.deployedAt && p.openIssues === 0).map((p) => ({ title: p.title, eligible: eligible(p, soak).toDateString() }))
  const clients = (await records<{ name: string; status: string; primaryContact?: { email?: string } }>(org.id, 'clients')).filter((c) => c.status === 'active' && c.primaryContact?.email)
  let sent = 0
  for (const c of clients) {
    const r = await sendEmail(c.primaryContact!.email!, `${s.name || org.name}: weekly system update report`, template(String(s.name || org.name), String(s.phone || ''), soak, c.name, deployed, upcoming), String(s.name || org.name))
    if (r.ok) sent++
  }
  void onlyManual
  await putRecord(org.id, 'audit', { id: 'au' + Date.now(), at: new Date().toISOString(), who: 'Omni scheduler', action: `Weekly update email sent to ${sent} client(s)` })
  return sent
}

export default async function cron(req: Req, res: Res, job: string, ctx: Ctx | null) {
  const fromScheduler = req.method === 'GET' && !!env('CRON_SECRET') && req.headers.authorization === `Bearer ${env('CRON_SECRET')}`
  if (!fromScheduler && !ctx) return fail(res, 401, 'Unauthorized')
  const sb = mustDb()

  // Manual "send now" from inside a workspace → only that MSP
  if (!fromScheduler && ctx) {
    if (job === 'weekly-updates') return ok(res, { sent: await weekly(ctx.org, true) })
    return fail(res, 400, 'Unknown job')
  }

  const { data: orgs } = await sb.from('orgs').select('*')
  if (job === 'weekly-updates') {
    let total = 0
    for (const o of (orgs || []) as Org[]) {
      if (!live(o)) continue
      if (Number((o.settings as Record<string, number>).weeklyEmailDay ?? 1) !== new Date().getUTCDay()) continue
      total += await weekly(o)
    }
    return ok(res, { sent: total })
  }

  if (job === 'daily') {
    const today = new Date().toISOString().slice(0, 10)
    let locked = 0, overdue = 0
    for (const o of (orgs || []) as Org[]) {
      // Non-payment: grace period over → lock the workspace, its landing page and client portal
      if (!o.comped && o.status === 'past_due' && o.grace_until && new Date(o.grace_until) < new Date()) {
        await sb.from('orgs').update({ status: 'suspended' }).eq('id', o.id)
        const { data: owner } = await sb.from('org_members').select('email').eq('org_id', o.id).eq('role', 'owner').limit(1).maybeSingle()
        if (owner?.email) await sendEmail(owner.email, 'Your Omni workspace is paused', `<p>We still haven't received payment, so your Omni TotalStack MSP workspace, landing page and client portal are paused. Your data is safe.</p><p><a href="${env('PUBLIC_URL')}/app/billing">Pay now to reactivate instantly</a>.</p>`)
        locked++; continue
      }
      if (!live(o)) continue
      for (const i of await records<{ id: string; number: string; dueDate: string; status: string }>(o.id, 'invoices')) {
        if (i.status === 'sent' && i.dueDate < today) {
          await putRecord(o.id, 'invoices', { ...i, status: 'overdue' })
          await notify(o.id, 'bad', `Invoice ${i.number} is past due — a Notice of Non-Payment is ready`, '/app/finance?tab=notices')
          overdue++
        }
      }
      const soon = new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10)
      for (const k of await records<{ name: string; endDate: string }>(o.id, 'contracts'))
        if (k.endDate === soon || k.endDate === today) await notify(o.id, 'warn', `${k.name} expires ${k.endDate}`, '/app/infrastructure?tab=contracts')
    }
    return ok(res, { locked, overdue })
  }
  return fail(res, 404, 'Unknown cron job')
}
