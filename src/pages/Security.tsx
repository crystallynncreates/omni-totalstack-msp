// Security (Huntress): agent coverage, incidents, Huntress subscriptions (red expiry), identity gaps from Entra ID.
import { ExternalLink, ShieldCheck, ShieldAlert, RefreshCw, UserX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore, clientName } from '../lib/store'
import { Badge, Card, PageHeader, Ring, Stat, toast } from '../components/ui'
import { ContractsTable } from '../components/tables'
import { daysUntil, fmtDateTime, timeAgo } from '../lib/format'
import { api } from '../lib/api'

const INCIDENTS = [
  { id: 'hi1', clientId: 'c1', host: 'BSD-OP1', severity: 'high', title: 'Malicious PowerShell — host isolated', at: new Date(Date.now() - 4 * 864e5).toISOString(), status: 'remediated' },
  { id: 'hi2', clientId: 'c2', host: 'jokafor@harborpine', severity: 'medium', title: 'ITDR: sign-in from unusual country (blocked by Conditional Access)', at: new Date(Date.now() - 1.2 * 864e5).toISOString(), status: 'resolved' },
  { id: 'hi3', clientId: 'c4', host: 'NG-DISPATCH-01', severity: 'low', title: 'Huntress agent not installed', at: new Date(Date.now() - 0.2 * 864e5).toISOString(), status: 'open' },
]

export default function Security() {
  const s = useStore()
  const portal = s.integrations.huntress.config.portalUrl || s.company.huntressPortalUrl
  const eligible = s.devices.filter((d) => !['ap', 'switch', 'firewall', 'printer'].includes(d.type))
  const covered = eligible.filter((d) => d.huntressAgent)
  const noMfa = s.directoryUsers.filter((u) => !u.mfa && u.enabled)
  const stale = s.directoryUsers.filter((u) => daysUntil(u.lastSignIn) < -45 && u.enabled)
  const hContracts = s.contracts.filter((k) => k.type === 'Huntress')

  const sync = async () => {
    const r = await api('huntress/sync', {})
    toast(r.ok ? 'Synced agents and incidents from Huntress' : 'Connect Huntress in Integrations for live data', r.ok ? 'ok' : 'warn')
  }

  return (
    <div>
      <PageHeader title="Security (Huntress)" subtitle="24/7 managed detection & response on every client — required on every plan"
        actions={<><button className="btn-ghost" onClick={sync}><RefreshCw size={15} /> Sync</button><a className="btn-primary" href={portal} target="_blank" rel="noreferrer"><ShieldCheck size={15} /> Open Huntress account <ExternalLink size={12} /></a></>}
        help="Huntress is managed under your business partner account. Omni shows agent coverage, incidents and subscription renewals per client, and flags identity gaps (no MFA, stale accounts) from Entra ID." />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Agent coverage" value={`${Math.round((covered.length / Math.max(1, eligible.length)) * 100)}%`} sub={`${covered.length}/${eligible.length} endpoints`} tone={covered.length === eligible.length ? 'ok' : 'warn'} />
        <Stat label="Open incidents" value={INCIDENTS.filter((i) => i.status === 'open').length} tone="warn" icon={<ShieldAlert size={16} />} />
        <Stat label="Users without MFA" value={noMfa.length} tone={noMfa.length ? 'bad' : 'ok'} />
        <Stat label="Stale accounts" value={stale.length} tone={stale.length ? 'warn' : 'ok'} icon={<UserX size={16} />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Coverage by client">
          <div className="grid grid-cols-2 gap-4">
            {s.clients.filter((c) => c.status !== 'prospect').map((c) => {
              const el = eligible.filter((d) => d.clientId === c.id)
              const pct = el.length ? (el.filter((d) => d.huntressAgent).length / el.length) * 100 : 0
              return <Link key={c.id} to={`/app/clients/${c.id}`}><Ring value={pct} label={c.name} tone={pct === 100 ? 'ok' : 'warn'} /></Link>
            })}
          </div>
        </Card>
        <Card title="Incidents" className="lg:col-span-2">
          {INCIDENTS.map((i) => (
            <div key={i.id} className="flex items-start gap-3 border-b border-line/60 py-2.5 text-sm">
              <Badge tone={i.severity === 'high' ? 'bad' : i.severity === 'medium' ? 'warn' : 'muted'}>{i.severity}</Badge>
              <div className="flex-1"><div className="font-medium">{i.title}</div><div className="text-xs text-muted">{clientName(i.clientId)} · {i.host} · {fmtDateTime(i.at)}</div></div>
              <Badge tone={i.status === 'open' ? 'warn' : 'ok'}>{i.status}</Badge>
            </div>
          ))}
        </Card>
        <Card title="Endpoints missing Huntress" className="lg:col-span-1">
          {eligible.filter((d) => !d.huntressAgent).map((d) => <div key={d.id} className="flex justify-between border-b border-line/60 py-2 text-sm"><span>{d.hostname}<div className="text-xs text-muted">{clientName(d.clientId)}</div></span><button className="btn-ghost px-2 py-1 text-xs" onClick={() => { s.update('devices', d.id, { huntressAgent: true }); toast(`Huntress agent deployment queued for ${d.hostname}`) }}>Deploy agent</button></div>)}
        </Card>
        <Card title="Identity gaps (Entra ID)" className="lg:col-span-2">
          {[...noMfa.map((u) => ({ u, why: 'MFA not enabled' })), ...stale.map((u) => ({ u, why: `No sign-in for ${-daysUntil(u.lastSignIn)} days — disable?` }))].map(({ u, why }) => (
            <div key={u.id + why} className="flex justify-between border-b border-line/60 py-2 text-sm"><span>{u.displayName} <span className="text-xs text-muted">{u.upn} · {clientName(u.clientId)}</span></span><span className="text-xs text-bad">{why} · last {timeAgo(u.lastSignIn)}</span></div>
          ))}
        </Card>
        <Card title="Huntress subscriptions" className="lg:col-span-3" help="Red = expired or expiring within 30 days."><ContractsTable contracts={hContracts} showClient /></Card>
      </div>
    </div>
  )
}
