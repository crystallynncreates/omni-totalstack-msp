// Command Console: type what you want done ("update windows 11 on all devices at Acme", "disable user john@acme.com")
// and Omni sends it to the right integration — after showing exactly what will happen and asking you to confirm.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TerminalSquare, Play, Eye, ShieldAlert, CheckCircle2, XCircle, Copy, Plug, ExternalLink, KeyRound, History, Sparkles, Loader2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { Badge, Card, PageHeader, toast, cx } from '../components/ui'
import { parseCommand, planCommand, COMMAND_EXAMPLES, INTEGRATION_NAMES, type Plan } from '../../shared/commands'
import { patchStage } from '../lib/patchPolicy'
import { iso, uid } from '../lib/format'

interface StepResult { integration: string; ok: boolean; message: string; lines?: string[]; secret?: string; link?: string }
interface Run { id: string; at: string; text: string; plan: Plan; results: StepResult[]; simulated?: boolean }

const RISK_TONE = { read: 'info', change: 'warn', destructive: 'bad' } as const
const RISK_LABEL = { read: 'Read-only', change: 'Makes changes', destructive: 'Destructive' }

export default function Command() {
  const s = useStore()
  const [params] = useSearchParams()
  const [text, setText] = useState(params.get('q') || '')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [rewritten, setRewritten] = useState<string>()
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState<'plan' | 'run' | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [rdId, setRdId] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const session = s.session
  const role = session?.role || 'owner'

  const connected = useMemo(() => {
    // Demo workspace: pretend everything is connected so every command can be tried (results are simulated).
    if (!session) return new Set([...Object.keys(s.integrations), 'entra', 'm365'])
    const set = new Set(Object.entries(s.integrations).filter(([, v]) => v?.connected).map(([k]) => k))
    if (set.has('m365')) set.add('entra')
    return set
  }, [s.integrations, session])
  const clients = s.clients.map((c) => ({ id: c.id, name: c.name }))
  const devices = s.devices.map((d) => ({ hostname: d.hostname, clientId: d.clientId }))

  // Instant local preview as you type
  const live = useMemo(() => (text.trim().length > 3 ? planCommand(parseCommand(text, clients, devices), connected) : null), [text, connected, s.clients, s.devices]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (params.get('q')) void preview() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function preview() {
    if (!text.trim()) return
    setConfirm(''); setRewritten(undefined)
    if (!session) { setPlan(planCommand(parseCommand(text, clients, devices), connected)); return }
    setBusy('plan')
    const r = await api<{ plan: Plan; rewritten?: string }>('command/plan', { text })
    setBusy(null)
    if (r.ok && r.data) { setPlan(r.data.plan); setRewritten(r.data.rewritten) } else { setPlan(planCommand(parseCommand(text, clients, devices), connected)); if (r.error) toast(r.error, 'warn') }
  }

  async function run() {
    if (!plan?.parsed) return
    const word = plan.confirmWord || 'yes'
    if (plan.risk !== 'read' && plan.confirmWord && confirm.trim().toUpperCase() !== plan.confirmWord) return toast(`Type ${plan.confirmWord} to confirm`, 'warn')
    if (plan.role === 'admin' && !['owner', 'admin'].includes(role)) return toast('Only owners and admins can do that.', 'bad')
    // Remote control is opened right here on this computer
    if (plan.parsed.intent === 'remote') return openRemote(plan)
    setBusy('run')
    let results: StepResult[]
    let simulated = false
    if (session) {
      const r = await api<{ results: StepResult[]; plan: Plan }>('command/run', { text: rewritten || text, confirm: plan.confirmWord ? confirm.trim().toUpperCase() : word })
      if (!r.ok || !r.data) { setBusy(null); return toast(r.error || 'Command failed', 'bad') }
      results = r.data.results
    } else { results = simulate(plan); simulated = true }
    setBusy(null)
    setRuns((x) => [{ id: uid('run'), at: iso(), text: rewritten || text, plan, results, simulated }, ...x].slice(0, 30))
    s.log(`Command: ${plan.title}${simulated ? ' (demo)' : ''}`)
    setPlan(null); setConfirm(''); setText('')
    toast(results.every((r) => r.ok) ? 'Done' : 'Finished with problems — see the results below', results.every((r) => r.ok) ? 'ok' : 'warn')
  }

  function openRemote(p: Plan) {
    const host = p.parsed!.params.device || p.parsed!.target.devices[0]
    const d = s.devices.find((x) => x.hostname.toLowerCase() === String(host).toLowerCase())
    const id = d?.rustdeskId || rdId.trim()
    if (!id) return toast(`Enter ${host}'s RustDesk ID below (shown in the RustDesk app on that computer)`, 'warn')
    if (d && !d.rustdeskId) s.update('devices', d.id, { rustdeskId: id })
    window.location.href = `rustdesk://${encodeURIComponent(id)}`
    setRuns((x) => [{ id: uid('run'), at: iso(), text, plan: p, results: [{ integration: 'rustdesk', ok: true, message: `Opening RustDesk to ${host} (ID ${id}). If nothing happens, install RustDesk from rustdesk.com.`, link: `rustdesk://${id}` }] }, ...x])
    setPlan(null); setRdId('')
  }

  /** Demo workspace: show what would happen, and apply it to the demo data — patch soak policy still enforced. */
  function simulate(p: Plan): StepResult[] {
    const c = p.parsed!
    const soak = s.company.patchSoakDays || 15
    const targets = c.target.scope === 'all' ? s.devices : c.target.scope === 'client' ? s.devices.filter((d) => d.clientId === c.target.clientId) : s.devices.filter((d) => c.target.devices.map((h) => h.toLowerCase()).includes(d.hostname.toLowerCase()))
    return p.steps.map((st) => {
      const base = { integration: st.integration }
      if (c.intent === 'patch') {
        const words = (c.params.product || '').toLowerCase().split(/\s+/).filter(Boolean)
        const rows = s.patches.filter((x) => words.every((w) => `${x.product} ${x.title}`.toLowerCase().includes(w))).map((x) => ({ x, st: patchStage(x, soak) }))
        const ok = rows.filter((r) => r.st.stage === 'approved')
        ok.forEach((r) => s.update('patches', r.x.id, { deployedAt: iso(), deployedCount: r.x.deployedCount + targets.length }))
        return { ...base, ok: true, message: ok.length ? `Installed ${ok.length} approved update(s) on ${targets.length} device(s).` : `Nothing eligible — every matching update is still in its ${soak}-day soak or blocked.`, lines: [...ok.map((r) => `Installed ${r.x.kb} ${r.x.title}`), ...rows.filter((r) => r.st.stage === 'soaking').map((r) => `Skipped ${r.x.kb} — soaking until ${r.st.eligibleOn.toDateString()}`), ...rows.filter((r) => r.st.stage === 'blocked').map((r) => `Skipped ${r.x.kb} — blocked by known issues`)] }
      }
      if (c.intent.startsWith('user_') && c.params.user) {
        const u = s.directoryUsers.find((x) => x.upn.toLowerCase() === c.params.user.toLowerCase())
        if (u && c.intent === 'user_disable') s.update('directoryUsers', u.id, { enabled: false })
        if (u && c.intent === 'user_enable') s.update('directoryUsers', u.id, { enabled: true })
        const secret = ['user_add', 'user_reset'].includes(c.intent) ? 'Demo-Pa55word!' : undefined
        return { ...base, ok: true, message: `${p.title} — done.`, secret }
      }
      if (c.intent === 'ticket' && st.integration !== 'omni') return { ...base, ok: true, message: `Ticket created in ${st.name}.` }
      if (c.intent === 'patch_status' && st.integration !== 'omni') return { ...base, ok: true, message: `${st.name}: per-device patch report retrieved.` }
      if (c.intent === 'ticket' && st.integration === 'omni' && c.target.clientId) {
        const number = Math.max(1000, ...s.tickets.map((t) => t.number)) + 1
        s.add('tickets', { id: uid('t'), number, clientId: c.target.clientId, title: c.params.subject, description: 'Opened from the Command Console', priority: 'P3', status: 'new', category: 'General', createdAt: iso(), slaDueAt: iso(new Date(Date.now() + 8 * 3600e3)), billable: true, hours: 0 })
        return { ...base, ok: true, message: `Ticket #${number} opened.` }
      }
      if (c.intent === 'patch_status') {
        const st2 = s.patches.map((x) => patchStage(x, soak).stage)
        return { ...base, ok: true, message: `${st2.filter((x) => x === 'approved').length} approved · ${st2.filter((x) => x === 'soaking').length} soaking · ${st2.filter((x) => x === 'blocked').length} blocked · ${st2.filter((x) => x === 'deployed').length} deployed` }
      }
      if (c.intent === 'monitor_status') { const down = s.sites.filter((x) => x.status !== 'online'); return { ...base, ok: true, message: down.length ? `${down.length} site(s) down or degraded.` : 'All sites are online.', lines: down.map((x) => `${x.status.toUpperCase()} ${x.name}`) } }
      if (c.intent === 'find') { const q = (c.params.query || '').toLowerCase(); const hits = s.devices.filter((d) => `${d.hostname} ${d.ip}`.toLowerCase().includes(q)); return { ...base, ok: true, message: `${hits.length} match(es).`, lines: hits.map((d) => `${d.hostname} · ${d.ip} · ${d.os}`) } }
      const onDevices = ['install', 'upgrade', 'uninstall', 'reboot', 'shutdown', 'run', 'service_restart', 'gpupdate'].includes(c.intent)
      return { ...base, ok: true, message: `${p.title}${onDevices && targets.length ? ` — ${targets.length} device(s)` : ''} — done.`, lines: onDevices ? targets.slice(0, 20).map((d) => `${d.hostname}: done`) : undefined }
    })
  }

  const shown = plan || live
  return (
    <div>
      <PageHeader title="Command Console" subtitle="Type what you want done — Omni sends it to the right tool"
        help="Type a plain-English command like “update windows 11 on all devices at Acme” or “disable user john@acme.com”. Omni shows exactly what will happen and which integration does it, then asks you to confirm. Windows updates still follow your 15-day bug-free rule — updates that are still soaking are skipped. Every command is written to the audit log." />
      {!session && <div className="mb-4 rounded-xl bg-accent/10 p-3 text-sm">Demo workspace: commands are simulated on the demo data. In your real workspace they run on your connected integrations.</div>}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="glass p-4">
            <form onSubmit={(e) => { e.preventDefault(); void preview() }} className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <TerminalSquare size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
                <input ref={input} data-tour="command-input" autoFocus value={text} onChange={(e) => { setText(e.target.value); setPlan(null) }} onKeyDown={(e) => { if (e.key === 'ArrowUp' && !text && runs[0]) setText(runs[0].text) }} placeholder="e.g. update windows 11 on all devices at Acme" className="input py-3 pl-10 font-mono" aria-label="Command" />
              </div>
              <button className="btn-primary" disabled={!text.trim() || !!busy}>{busy === 'plan' ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} Preview</button>
            </form>
            {shown && (
              <div className="mt-4 rounded-xl border border-line p-4" data-testid="plan">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted">{plan ? (plan.ok ? 'Ready to run' : 'Needs attention') : 'Preview'}</div>
                    <div className="mt-0.5 text-lg font-semibold">{shown.title}</div>
                    {rewritten && <div className="mt-1 flex items-center gap-1 text-xs text-muted"><Sparkles size={12} className="text-accent" /> Understood as: <span className="font-mono">{rewritten}</span></div>}
                  </div>
                  <div className="flex gap-1.5"><Badge tone={RISK_TONE[shown.risk]}>{RISK_LABEL[shown.risk]}</Badge>{shown.role === 'admin' && <Badge tone="violet">Owner/admin only</Badge>}</div>
                </div>
                {shown.steps.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm"><span className="text-muted">Runs on:</span>{shown.steps.map((st) => <span key={st.integration} className={cx('chip', st.connected ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn')}>{st.connected ? <CheckCircle2 size={12} /> : <Plug size={12} />} {st.name}{st.via ? ` via ${st.via === 'tacticalrmm' ? 'Tactical RMM' : st.via}` : ''}</span>)}</div>}
                {shown.detail.map((d) => <p key={d} className="mt-2 text-sm text-muted">{d}</p>)}
                {shown.problems.length > 0 && <ul className="mt-3 space-y-1 rounded-lg bg-warn/10 p-3 text-sm text-warn">{shown.problems.map((p) => <li key={p}>• {p}</li>)}{shown.steps.some((x) => !x.connected) && <li><Link to="/app/integrations" className="underline">Open Integrations</Link></li>}</ul>}
                {plan && plan.ok && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {plan.parsed?.intent === 'remote' && !s.devices.find((d) => d.hostname.toLowerCase() === String(plan.parsed?.params.device).toLowerCase())?.rustdeskId && <input className="input w-56" placeholder="RustDesk ID (e.g. 123 456 789)" value={rdId} onChange={(e) => setRdId(e.target.value)} />}
                    {plan.confirmWord && <><ShieldAlert size={16} className="text-bad" /><input className="input w-40 font-mono" placeholder={`Type ${plan.confirmWord}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirmation" /></>}
                    <button className={plan.risk === 'destructive' ? 'btn-danger' : 'btn-primary'} onClick={run} disabled={!!busy || (!!plan.confirmWord && confirm.trim().toUpperCase() !== plan.confirmWord)}>{busy === 'run' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} {plan.risk === 'read' ? 'Run' : 'Confirm & run'}</button>
                    <button className="btn-ghost" onClick={() => setPlan(null)}>Cancel</button>
                  </div>
                )}
                {!plan && live?.parsed && <p className="mt-3 text-xs text-muted">Press <b>Preview</b> (or Enter) to get it ready to run.</p>}
              </div>
            )}
          </div>

          <Card title="Results" icon={<History size={16} />}>
            {runs.length === 0 ? <p className="text-sm text-muted">Commands you run appear here with the result from each tool. Everything is also saved in Admin → Audit log.</p> : (
              <div className="space-y-3">{runs.map((r) => (
                <div key={r.id} className="rounded-xl border border-line p-3" data-testid="run">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-mono text-sm">&gt; {r.text}</div><div className="flex gap-1.5">{r.simulated && <Badge>Demo</Badge>}<span className="text-xs text-muted">{new Date(r.at).toLocaleTimeString()}</span></div></div>
                  {r.results.map((x, i) => (
                    <div key={i} className="mt-2">
                      <div className="flex items-start gap-2 text-sm">{x.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-bad" />}<div><b>{INTEGRATION_NAMES[x.integration] || x.integration}</b>: {x.message}</div></div>
                      {x.secret && <div className="ml-6 mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-warn/10 p-2 text-sm"><KeyRound size={14} className="text-warn" /> Temporary password (shown once): <code className="rounded bg-ink/10 px-1.5 py-0.5">{x.secret}</code><button className="btn-ghost px-2 py-1 text-xs" onClick={() => { void navigator.clipboard?.writeText(x.secret!); toast('Copied') }}><Copy size={12} /> Copy</button></div>}
                      {x.link && <a href={x.link} className="btn-ghost ml-6 mt-1.5 px-2 py-1 text-xs"><ExternalLink size={12} /> Open again</a>}
                      {x.lines && x.lines.length > 0 && <details className="ml-6 mt-1"><summary className="cursor-pointer text-xs text-muted">{x.lines.length} line(s) of detail</summary><pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-ink/5 p-2 text-xs">{x.lines.join('\n')}</pre></details>}
                    </div>
                  ))}
                </div>
              ))}</div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Try a command">
            <div className="space-y-3">{COMMAND_EXAMPLES.map((g) => (
              <div key={g.group}><div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">{g.group}</div>
                <div className="flex flex-wrap gap-1.5">{g.items.map((ex) => <button key={ex} onClick={() => { setText(ex); setPlan(null); input.current?.focus() }} className="chip border border-line px-2 py-1 text-left font-mono text-[11px] text-muted hover:border-accent hover:text-accent">{ex}</button>)}</div></div>
            ))}</div>
          </Card>
          <Card title="Safety rules">
            <ul className="space-y-1.5 text-sm text-muted">
              <li>• You always see the plan before anything runs.</li>
              <li>• Updates install only after {s.company.patchSoakDays || 15} bug-free days — soaking updates are skipped automatically.</li>
              <li>• Deleting users needs you to type <b>DELETE</b>; restarting or running scripts on every device needs <b>ALL</b>.</li>
              <li>• Adding/deleting users, password resets and scripts are owner/admin only.</li>
              <li>• Each tool uses your workspace’s own keys, and every command is recorded in the audit log.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
