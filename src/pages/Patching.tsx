// Patching & Updates: 15-day bug-free soak policy + automatic weekly client update email.
import { useMemo, useState } from 'react'
import { ShieldCheck, Bug, Rocket, Mail, Clock, Ban, CheckCircle2, Plus, Send } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Patch } from '../lib/types'
import { Badge, Card, Field, Modal, PageHeader, Stat, Tabs, toast, cx } from '../components/ui'
import { patchStage, nextWeekly, WEEKDAYS, type PatchStage } from '../lib/patchPolicy'
import { weeklyUpdateEmail } from '../lib/pdf'
import { daysSince, fmtDate, fmtDateTime, iso, isoDate, uid, timeAgo } from '../lib/format'
import { api } from '../lib/api'

type Tab = 'pipeline' | 'email' | 'policy'
const TONE: Record<PatchStage, 'warn' | 'ok' | 'bad' | 'info'> = { soaking: 'warn', approved: 'ok', blocked: 'bad', deployed: 'info' }

export default function Patching() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('pipeline')
  const [add, setAdd] = useState(false)
  const soak = s.company.patchSoakDays
  const rows = s.patches.map((p) => ({ p, st: patchStage(p, soak) })).sort((a, b) => ['approved', 'blocked', 'soaking', 'deployed'].indexOf(a.st.stage) - ['approved', 'blocked', 'soaking', 'deployed'].indexOf(b.st.stage))
  const endpoints = s.devices.filter((d) => d.rmmAgent).length

  const deploy = async (p: Patch) => {
    const st = patchStage(p, soak)
    if (st.stage !== 'approved') return toast(`Blocked by policy: ${st.stage === 'blocked' ? 'open issues reported' : `${st.daysLeft} more bug-free day(s) required`}`, 'bad')
    const r = await api('rmm/deploy', { kb: p.kb })
    s.update('patches', p.id, { deployedAt: iso(), deployedCount: endpoints })
    s.devices.forEach((d) => d.pendingPatches && s.update('devices', d.id, { pendingPatches: Math.max(0, d.pendingPatches - 1) }))
    s.log(`Deployed ${p.kb} to ${endpoints} endpoints`)
    toast(r.ok ? `${p.kb} pushed through RMM` : `${p.kb} marked deployed (connect your RMM to push automatically)`, r.ok ? 'ok' : 'warn')
  }

  return (
    <div>
      <PageHeader title="Patching & Updates" subtitle={`Stability rule: updates deploy only after ${soak} bug-free days · weekly email ${WEEKDAYS[s.company.weeklyEmailDay]}s`}
        actions={<><button className="btn-ghost" onClick={() => setAdd(true)}><Plus size={15} /> Track update</button><button className="btn-primary" onClick={() => rows.filter((r) => r.st.stage === 'approved').forEach((r) => deploy(r.p))}><Rocket size={15} /> Deploy all approved</button></>}
        help={`Every update waits in "Soaking" until it has gone ${soak} days with no reported bugs. If a bug is reported, the clock restarts. Only "Approved" updates can be pushed. Clients automatically receive a weekly email listing what was installed.`} />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        {(['soaking', 'approved', 'blocked', 'deployed'] as const).map((st) => <Stat key={st} label={st} value={rows.filter((r) => r.st.stage === st).length} tone={st === 'blocked' ? 'bad' : st === 'approved' ? 'ok' : undefined} icon={st === 'soaking' ? <Clock size={16} /> : st === 'blocked' ? <Ban size={16} /> : st === 'approved' ? <ShieldCheck size={16} /> : <CheckCircle2 size={16} />} />)}
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'pipeline', label: 'Update pipeline' }, { id: 'email', label: 'Weekly client email' }, { id: 'policy', label: 'Policy' }]} />
      {tab === 'pipeline' && (
        <Card>
          <div className="overflow-x-auto"><table className="table-base">
            <thead><tr><th>Update</th><th>Severity</th><th>Released</th><th>Bug-free for</th><th>Stage</th><th /></tr></thead>
            <tbody>{rows.map(({ p, st }) => (
              <tr key={p.id}>
                <td><div className="font-medium">{p.title}</div><div className="text-xs text-muted">{p.kb} · {p.product}</div></td>
                <td><Badge tone={p.severity === 'critical' ? 'bad' : p.severity === 'important' ? 'warn' : 'muted'}>{p.severity}</Badge></td>
                <td>{fmtDate(p.releaseDate)}</td>
                <td className="w-48">
                  <div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-line"><div className={cx('h-full rounded-full', st.stage === 'blocked' ? 'bg-bad' : 'bg-accent')} style={{ width: `${Math.min(100, (st.daysClean / soak) * 100)}%` }} /></div><span className="text-xs">{Math.min(st.daysClean, 99)}/{soak}d</span></div>
                  {p.lastIssueReported && <div className="text-[10px] text-muted">clock reset {fmtDate(p.lastIssueReported)}</div>}
                </td>
                <td>
                  <Badge tone={TONE[st.stage]}>{st.stage}</Badge>
                  <div className="mt-0.5 text-[10px] text-muted">{st.stage === 'soaking' ? `eligible ${fmtDate(st.eligibleOn.toISOString())}` : st.stage === 'blocked' ? `${p.openIssues} open issue(s)` : st.stage === 'deployed' ? `${p.deployedCount} devices · ${timeAgo(p.deployedAt!)}` : 'ready to push'}</div>
                </td>
                <td><div className="flex justify-end gap-1">
                  {st.stage !== 'deployed' && <button className="btn-ghost px-2 py-1 text-xs" title="Report a bug (restarts the clock)" onClick={() => { s.update('patches', p.id, { openIssues: p.openIssues + 1, lastIssueReported: isoDate() }); toast(`Bug logged — ${p.kb} soak clock restarted`, 'warn') }}><Bug size={13} /></button>}
                  {p.openIssues > 0 && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => s.update('patches', p.id, { openIssues: 0 })}>Issues fixed</button>}
                  {st.stage !== 'deployed' && <button className={cx('px-2 py-1 text-xs', st.stage === 'approved' ? 'btn-primary' : 'btn-ghost')} disabled={st.stage !== 'approved'} onClick={() => deploy(p)}><Rocket size={13} /> Deploy</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
      {tab === 'email' && <WeeklyEmail />}
      {tab === 'policy' && (
        <Card title="Update policy">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bug-free soak period (days)"><input type="number" className="input" value={soak} onChange={(e) => s.setCompany({ patchSoakDays: +e.target.value })} /></Field>
            <Field label="Weekly email day"><select className="input" value={s.company.weeklyEmailDay} onChange={(e) => s.setCompany({ weeklyEmailDay: +e.target.value })}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
            <Field label="Send time"><select className="input" value={s.company.weeklyEmailHour} onChange={(e) => s.setCompany({ weeklyEmailHour: +e.target.value })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{((h + 11) % 12) + 1}:00 {h < 12 ? 'AM' : 'PM'}</option>)}</select></Field>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            <li>• Clock starts at the vendor release date and restarts whenever a bug is reported (by you, your team, or vendor known-issue feeds).</li>
            <li>• Any open known issue blocks deployment, regardless of age.</li>
            <li>• Critical zero-day exceptions: an Owner can override from the RMM directly; the override is recorded in the audit log.</li>
            <li>• Server patches deploy in the maintenance window (Sat 10 PM); workstations nightly at 2 AM.</li>
          </ul>
        </Card>
      )}
      {add && <AddPatch onClose={() => setAdd(false)} />}
    </div>
  )
}

function WeeklyEmail() {
  const s = useStore()
  const [clientId, setClientId] = useState(s.clients.find((c) => c.status === 'active')?.id ?? '')
  const client = s.clients.find((c) => c.id === clientId)
  const next = nextWeekly(s.company.weeklyEmailDay, s.company.weeklyEmailHour)
  const html = useMemo(() => {
    const deployed = s.patches.filter((p) => p.deployedAt && daysSince(p.deployedAt) <= 7)
    const upcoming = s.patches.map((p) => ({ p, st: patchStage(p, s.company.patchSoakDays) })).filter((x) => x.st.stage === 'soaking' || x.st.stage === 'approved').map((x) => ({ title: x.p.title, eligibleOn: fmtDate(x.st.eligibleOn.toISOString()) }))
    return weeklyUpdateEmail(s.company, client?.name ?? 'Client', deployed, upcoming)
  }, [s.patches, s.company, client])
  const recipients = s.clients.filter((c) => c.status === 'active')

  const sendNow = async () => {
    const r = await api('cron/weekly-updates', { manual: true })
    s.setUI({ weeklyEmailLog: [{ at: iso(), clients: recipients.length, patches: s.patches.filter((p) => p.deployedAt && daysSince(p.deployedAt) <= 7).length }, ...s.ui.weeklyEmailLog].slice(0, 20) })
    s.log('Sent weekly update email to all active clients')
    toast(r.ok ? `Weekly update sent to ${recipients.length} clients` : `Logged send to ${recipients.length} clients (connect Email to deliver)`, r.ok ? 'ok' : 'warn')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Automatic schedule" icon={<Mail size={16} />}>
        <div className="text-sm">Next send: <b>{fmtDateTime(next.toISOString())}</b></div>
        <div className="mt-1 text-xs text-muted">Every {WEEKDAYS[s.company.weeklyEmailDay]} at {((s.company.weeklyEmailHour + 11) % 12) + 1}:00 {s.company.weeklyEmailHour < 12 ? 'AM' : 'PM'} to the primary contact of each active client. Runs server-side (Vercel Cron → /api/cron/weekly-updates), even when nobody is logged in.</div>
        <div className="mt-3 space-y-1 text-sm">{recipients.map((c) => <div key={c.id} className="flex justify-between"><span>{c.name}</span><span className="text-xs text-muted">{c.primaryContact.email}</span></div>)}</div>
        <button className="btn-primary mt-4 w-full" onClick={sendNow}><Send size={15} /> Send this week's email now</button>
        <div className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted">Send log</div>
        {s.ui.weeklyEmailLog.length === 0 && <p className="text-xs text-muted">No manual sends yet.</p>}
        {s.ui.weeklyEmailLog.map((l) => <div key={l.at} className="text-xs text-muted">{fmtDateTime(l.at)} · {l.clients} clients · {l.patches} updates</div>)}
      </Card>
      <Card title="Preview" className="xl:col-span-2" action={<select className="input w-56 py-1.5" value={clientId} onChange={(e) => setClientId(e.target.value)}>{recipients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}>
        <iframe title="Weekly email preview" className="h-[520px] w-full rounded-xl bg-white" srcDoc={html} />
      </Card>
    </div>
  )
}

function AddPatch({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [p, setP] = useState<Patch>({ id: uid('p'), kb: '', title: '', product: 'Windows 11', severity: 'important', releaseDate: isoDate(), openIssues: 0, deployedCount: 0 })
  return (
    <Modal open onClose={onClose} title="Track an update" footer={<button className="btn-primary" disabled={!p.title} onClick={() => { s.add('patches', p); onClose() }}>Save</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><input className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></Field>
        <Field label="KB / version"><input className="input" value={p.kb} onChange={(e) => setP({ ...p, kb: e.target.value })} /></Field>
        <Field label="Product"><input className="input" value={p.product} onChange={(e) => setP({ ...p, product: e.target.value })} /></Field>
        <Field label="Severity"><select className="input" value={p.severity} onChange={(e) => setP({ ...p, severity: e.target.value as Patch['severity'] })}>{['critical', 'important', 'moderate', 'low'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Vendor release date"><input type="date" className="input" value={p.releaseDate} onChange={(e) => setP({ ...p, releaseDate: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
