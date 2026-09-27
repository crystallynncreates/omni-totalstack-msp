// Omni Owner Console — only for the platform owner. Every MSP that bought Omni, their status and revenue.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, ExternalLink, RefreshCw } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { Badge, Card, PageHeader, Stat, toast } from '../components/ui'
import { PLANS, PLAN_ORDER, type PlanId } from '../../shared/plans'
import { fmtDate, money } from '../lib/format'

interface Row { id: string; name: string; slug: string; plan: PlanId; status: string; comped: boolean; license?: string; handoff_by?: string; handed_off_at?: string; lifetime: number; grace_until?: string; current_period_end?: string; custom_domain?: string; created_at: string; owner?: string; staff: number; clientUsers: number; clients: number; devices: number; mrr: number }

export default function OwnerConsole() {
  const session = useStore((s) => s.session)
  const [rows, setRows] = useState<Row[]>([])
  const [mrr, setMrr] = useState(0)
  const [lifetime, setLifetime] = useState(0)
  const [err, setErr] = useState('')
  const load = () => api<{ orgs: Row[]; mrr: number; lifetime: number }>('platform/orgs').then((r) => (r.ok && r.data ? (setRows(r.data.orgs), setMrr(r.data.mrr), setLifetime(r.data.lifetime)) : setErr(r.error || 'Not available')))
  useEffect(() => { load() }, [])
  const update = async (orgId: string, patch: Record<string, unknown>, msg: string) => { const r = await api('platform/update', { orgId, ...patch }); if (!r.ok) return toast(r.error || 'Failed', 'bad'); toast(msg); load() }

  if (!session?.platformOwner) return <Card><p className="text-sm text-muted">The Owner Console is only available to the Omni platform owner.</p></Card>
  return (
    <div>
      <PageHeader title="Omni Owner Console" subtitle="Every MSP on Omni TotalStack MSP" actions={<button className="btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>}
        help="New workspaces are created automatically when an MSP checks out. Enterprise buyers pay once and get a hosted workspace for the handoff period, then are disconnected once their standalone copy is running. Stripe webhooks keep status in sync: a failed payment starts a 7-day grace period, then the daily job pauses the workspace, its website and client portal. You can comp, extend grace, suspend or reactivate any MSP here." />
      {err && <Card><p className="text-sm text-bad">{err}</p></Card>}
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Omni MRR" value={money(mrr)} sub={`ARR ${money(mrr * 12)} · ${rows.filter((r) => r.status === 'active' && !r.comped && r.license !== 'lifetime').length} subscribers`} icon={<Crown size={16} />} />
        <Stat label="Enterprise sales" value={money(lifetime)} sub={`${rows.filter((r) => r.license === 'lifetime' && !r.comped).length} lifetime license(s)`} />
        <Stat label="Past due (grace)" value={rows.filter((r) => r.status === 'past_due').length} tone="warn" />
        <Stat label="Paused / canceled" value={rows.filter((r) => ['suspended', 'canceled'].includes(r.status)).length} tone="bad" />
      </div>
      <Card>
        <div className="overflow-x-auto"><table className="table-base">
          <thead><tr><th>MSP</th><th>Owner</th><th>Plan</th><th>Status</th><th>Usage</th><th>MRR</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.name}<div className="text-xs text-muted"><Link to={`/m/${r.slug}`} target="_blank" className="hover:text-accent">/m/{r.slug} <ExternalLink size={10} className="inline" /></Link>{r.custom_domain && ` · ${r.custom_domain}`}</div></td>
              <td className="text-xs">{r.owner}</td>
              <td><select className="input py-1 text-xs" value={r.plan} onChange={(e) => update(r.id, { plan: e.target.value }, 'Plan changed')}>{PLAN_ORDER.map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}</select></td>
              <td><Badge tone={r.comped || r.license === 'lifetime' ? 'violet' : r.status === 'active' ? 'ok' : r.status === 'past_due' ? 'warn' : 'bad'}>{r.comped ? 'comped' : r.status === 'disconnected' ? 'standalone' : r.license === 'lifetime' ? 'owned' : r.status}</Badge>{r.license === 'lifetime' && r.status !== 'disconnected' && r.handoff_by && <div className="text-[10px] text-muted">hand off by {fmtDate(r.handoff_by)}</div>}{r.status === 'past_due' && r.grace_until && <div className="text-[10px] text-muted">locks {fmtDate(r.grace_until)}</div>}</td>
              <td className="text-xs">{r.clients} clients · {r.devices} devices<div className="text-muted">{r.staff} staff · {r.clientUsers} portal users</div></td>
              <td>{money(r.mrr)}</td>
              <td className="text-xs">{fmtDate(r.created_at)}</td>
              <td><div className="flex flex-wrap gap-1">
                {r.license === 'lifetime' && r.status !== 'disconnected' && <><button className="btn-ghost px-2 py-1 text-xs" onClick={() => update(r.id, { handoffNow: true }, 'Disconnected — now standalone')}>Disconnect now</button><button className="btn-ghost px-2 py-1 text-xs" onClick={() => update(r.id, { extendHandoffDays: 14 }, 'Handoff extended 14 days')}>+14 days</button></>}
                {r.license !== 'lifetime' && r.status !== 'active' && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => update(r.id, { status: 'active' }, 'Reactivated')}>Reactivate</button>}
                {['active', 'past_due'].includes(r.status) && !r.comped && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => update(r.id, { status: 'suspended' }, 'Suspended')}>Suspend</button>}
                {r.status === 'past_due' && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => update(r.id, { extendGraceDays: 7 }, 'Grace extended 7 days')}>+7 days</button>}
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => update(r.id, { comped: !r.comped }, r.comped ? 'No longer comped' : 'Comped (free)')}>{r.comped ? 'Uncomp' : 'Comp'}</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
        {rows.length === 0 && !err && <p className="py-6 text-center text-sm text-muted">No MSPs yet. Share your sales page to get your first customer.</p>}
      </Card>
    </div>
  )
}
