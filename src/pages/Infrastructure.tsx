// Sites & Infrastructure: live site status (UniFi + RMM), outages / network-down, site contracts (red expiry), devices, topology.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Siren, Plus, Building2 } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import type { Site } from '../lib/types'
import { Badge, Card, Field, Modal, PageHeader, Stat, StatusDot, Tabs, toast, cx } from '../components/ui'
import { ContractsTable, DevicesTable } from '../components/tables'
import Topology from '../components/Topology'
import { fmtDateTime, timeAgo, uid, iso, expiryState } from '../lib/format'
import { api } from '../lib/api'

type Tab = 'sites' | 'devices' | 'contracts'

export default function Infrastructure() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('sites')
  const [sel, setSel] = useState<string | null>(null)
  const [add, setAdd] = useState(false)
  const [filter, setFilter] = useState('all')
  const sites = [...s.sites].sort((a, b) => ['down', 'degraded', 'online'].indexOf(a.status) - ['down', 'degraded', 'online'].indexOf(b.status)).filter((x) => filter === 'all' || x.status === filter)
  const site = s.sites.find((x) => x.id === sel)

  const refresh = async () => {
    const r = await api<{ sites: Partial<Site>[] }>('unifi/sites')
    if (r.ok && r.data) {
      r.data.sites.forEach((u) => { const ex = s.sites.find((x) => x.unifiSiteId === u.unifiSiteId); if (ex) s.update('sites', ex.id, { ...u, lastCheck: iso() }) })
      toast('Site status refreshed from UniFi')
    } else toast('Connect UniFi in Integrations for live status (showing demo data)', 'warn')
  }

  const resolve = (x: Site) => {
    s.update('sites', x.id, { status: 'online', outages: x.outages.map((o) => (o.end ? o : { ...o, end: iso() })) })
    s.devices.filter((d) => d.siteId === x.id && d.status === 'offline').forEach((d) => s.update('devices', d.id, { status: 'online', lastSeen: iso() }))
    s.log(`Marked ${x.name} restored`)
    toast(`${x.name} marked back online`)
  }

  return (
    <div>
      <PageHeader title="Sites & Infrastructure" subtitle="Live status of every client network" actions={<><button className="btn-ghost" onClick={refresh}><RefreshCw size={15} /> Refresh</button><button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> Add site</button></>}
        help="Status comes from UniFi (gateway heartbeat, WAN health) and your RMM. Red = network down, amber = degraded. Contracts and subscriptions tied to each site are listed with expiration dates — red when expired or within 30 days." />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Sites" value={s.sites.length} icon={<Building2 size={16} />} />
        <Stat label="Network down" value={s.sites.filter((x) => x.status === 'down').length} tone={s.sites.some((x) => x.status === 'down') ? 'bad' : 'ok'} icon={<Siren size={16} />} />
        <Stat label="Degraded" value={s.sites.filter((x) => x.status === 'degraded').length} tone="warn" />
        <Stat label="Devices offline" value={s.devices.filter((d) => d.status === 'offline').length} tone={s.devices.some((d) => d.status === 'offline') ? 'bad' : 'ok'} />
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'sites', label: 'Sites & outages' }, { id: 'devices', label: 'All devices', count: s.devices.length }, { id: 'contracts', label: 'Site contracts & subscriptions', count: s.contracts.filter((c) => ['expired', 'soon'].includes(expiryState(c.endDate))).length }]} />

      {tab === 'sites' && (
        <>
          <div className="mb-3 flex gap-2">{['all', 'down', 'degraded', 'online'].map((f) => <button key={f} onClick={() => setFilter(f)} className={cx('chip border px-3 py-1.5 capitalize', filter === f ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted')}>{f}</button>)}</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((x) => {
              const redK = s.contracts.filter((k) => k.siteId === x.id && ['expired', 'soon'].includes(expiryState(k.endDate)))
              const open = x.outages.find((o) => !o.end)
              return (
                <div key={x.id} className={cx('glass p-4', x.status === 'down' && 'border-bad/60 bg-bad/5', x.status === 'degraded' && 'border-warn/50', sel === x.id && 'ring-1 ring-accent')}>
                  <div className="flex items-center gap-2"><StatusDot status={x.status} /><span className="font-semibold">{x.name}</span><Badge tone={x.status === 'online' ? 'ok' : x.status === 'down' ? 'bad' : 'warn'} className="ml-auto">{x.status === 'down' ? 'NETWORK DOWN' : x.status.toUpperCase()}</Badge></div>
                  <div className="mt-1 text-xs text-muted"><Link to={`/app/clients/${x.clientId}`} className="hover:text-accent">{clientName(x.clientId)}</Link> · {x.isp} · WAN {x.wanIp}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-ink/5 p-1.5"><div className="font-semibold">{x.uptime30d}%</div><div className="text-muted">30d uptime</div></div>
                    <div className="rounded-lg bg-ink/5 p-1.5"><div className="font-semibold">{s.devices.filter((d) => d.siteId === x.id && d.status !== 'offline').length}/{s.devices.filter((d) => d.siteId === x.id).length}</div><div className="text-muted">devices up</div></div>
                    <div className="rounded-lg bg-ink/5 p-1.5"><div className="font-semibold">{timeAgo(x.lastCheck)}</div><div className="text-muted">last check</div></div>
                  </div>
                  {open && <div className="mt-2 rounded-lg bg-bad/10 p-2 text-xs text-bad"><b>Outage since {fmtDateTime(open.start)}:</b> {open.cause}</div>}
                  {redK.length > 0 && <div className="mt-2 text-xs font-medium text-bad">⚠ {redK.map((k) => k.name).join(', ')} expiring/expired</div>}
                  <div className="mt-3 flex gap-2">
                    <button className="btn-ghost flex-1 text-xs" onClick={() => setSel(sel === x.id ? null : x.id)}>{sel === x.id ? 'Hide' : 'Diagram'}</button>
                    {x.status !== 'online' && <button className="btn-ghost flex-1 text-xs" onClick={() => resolve(x)}>Mark restored</button>}
                    {x.status === 'down' && <Link to="/app/operations" className="btn-danger flex-1 text-xs">Ticket</Link>}
                  </div>
                </div>
              )
            })}
          </div>
          {site && <Card title={`Topology — ${site.name}`} className="mt-4"><Topology site={site} devices={s.devices.filter((d) => d.siteId === site.id)} /></Card>}
        </>
      )}
      {tab === 'devices' && <Card><DevicesTable devices={s.devices} showClient /></Card>}
      {tab === 'contracts' && <Card help="Every contract and subscription across all sites, soonest expiration first. Red = expired or ≤30 days."><ContractsTable contracts={s.contracts} showClient /></Card>}
      {add && <AddSite onClose={() => setAdd(false)} />}
    </div>
  )
}

function AddSite({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [x, setX] = useState<Site>({ id: uid('s'), clientId: s.clients[0]?.id ?? '', name: '', address: '', status: 'online', isp: '', wanIp: '', lastCheck: iso(), uptime30d: 100, outages: [] })
  return (
    <Modal open onClose={onClose} title="Add site" footer={<button className="btn-primary" disabled={!x.name} onClick={() => { s.add('sites', x); s.log(`Added site ${x.name}`); onClose() }}>Save</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client"><select className="input" value={x.clientId} onChange={(e) => setX({ ...x, clientId: e.target.value })}>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Site name"><input className="input" value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} /></Field>
        <Field label="Address" className="sm:col-span-2"><input className="input" value={x.address} onChange={(e) => setX({ ...x, address: e.target.value })} /></Field>
        <Field label="Internet provider"><input className="input" value={x.isp} onChange={(e) => setX({ ...x, isp: e.target.value })} /></Field>
        <Field label="Public (WAN) IP"><input className="input" value={x.wanIp} onChange={(e) => setX({ ...x, wanIp: e.target.value })} /></Field>
        <Field label="UniFi site ID" hint="Auto-filled when UniFi is connected" className="sm:col-span-2"><input className="input" value={x.unifiSiteId ?? ''} onChange={(e) => setX({ ...x, unifiSiteId: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
