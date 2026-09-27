// Tools: unified toolbox — RMM, remote access, discovery, print management, backup console, scripting, monitoring, vault.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MonitorSmartphone, MousePointerClick, Radar, Printer, HardDrive, Terminal, Activity, KeyRound, Play, ShoppingCart } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import { Badge, Card, Field, PageHeader, Bar, Tabs, toast, cx } from '../components/ui'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

const SCRIPTS = [
  { name: 'Clear print spooler', lang: 'PowerShell', body: 'Stop-Service Spooler -Force\nRemove-Item C:\\Windows\\System32\\spool\\PRINTERS\\* -Force\nStart-Service Spooler' },
  { name: 'Free disk space (temp + update cache)', lang: 'PowerShell', body: 'Remove-Item $env:TEMP\\* -Recurse -Force -EA SilentlyContinue\nDism /Online /Cleanup-Image /StartComponentCleanup' },
  { name: 'Install Huntress agent', lang: 'PowerShell', body: '# Uses your Huntress account & org key from Integrations\n.\\InstallHuntress.powershellv2.ps1 -acctkey $env:HUNTRESS_ACCT -orgkey $env:ORG_KEY' },
  { name: 'Flush DNS & renew IP', lang: 'CMD', body: 'ipconfig /flushdns\nipconfig /release\nipconfig /renew' },
  { name: 'Report local admins', lang: 'PowerShell', body: 'Get-LocalGroupMember -Group Administrators | Select Name, PrincipalSource' },
]

type Tab = 'launch' | 'print' | 'backup' | 'scripts'

export default function Tools() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('launch')
  const [script, setScript] = useState(0)
  const [target, setTarget] = useState(s.devices.find((d) => d.rmmAgent)?.id ?? '')
  const rmmUrl = s.integrations.rmm.config.baseUrl
  const launch = [
    { icon: MonitorSmartphone, name: 'RMM console', text: 'Open your RMM dashboard', href: rmmUrl || '/app/integrations', ext: !!rmmUrl },
    { icon: MousePointerClick, name: 'Remote access', text: 'Start a remote session from any device row', href: '/app/infrastructure' },
    { icon: Radar, name: 'Network discovery', text: 'Scan a client network', href: '/app/discovery' },
    { icon: Printer, name: 'Print management', text: 'Toner, errors, fleet status', tab: 'print' as Tab },
    { icon: HardDrive, name: 'Backup console', text: 'Job status & restore tests', tab: 'backup' as Tab },
    { icon: Terminal, name: 'Scripting engine', text: 'Run scripts through the RMM', tab: 'scripts' as Tab },
    { icon: Activity, name: 'Monitoring', text: 'Sites, devices & alerts', href: '/app/infrastructure' },
    { icon: KeyRound, name: 'Password manager', text: 'Credential vault & rotation', href: '/app/documentation' },
  ]
  const printers = s.devices.filter((d) => d.type === 'printer')

  return (
    <div>
      <PageHeader title="Tools" subtitle="Everything technical, one click away" />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'launch', label: 'Toolbox' }, { id: 'print', label: 'Print management' }, { id: 'backup', label: 'Backup console' }, { id: 'scripts', label: 'Scripting' }]} />
      {tab === 'launch' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {launch.map((l) => {
            const inner = <><div className="mb-3 w-fit rounded-xl bg-gradient-to-br from-accent/20 to-accent2/20 p-2.5 text-accent"><l.icon size={20} /></div><div className="font-semibold">{l.name}</div><p className="text-sm text-muted">{l.text}</p></>
            const cls = 'glass block p-5 text-left transition hover:-translate-y-0.5 hover:shadow-glow'
            return l.tab ? <button key={l.name} className={cls} onClick={() => setTab(l.tab!)}>{inner}</button> : l.ext ? <a key={l.name} className={cls} href={l.href} target="_blank" rel="noreferrer">{inner}</a> : <Link key={l.name} className={cls} to={l.href!}>{inner}</Link>
          })}
        </div>
      )}
      {tab === 'print' && (
        <Card title="Printer fleet" help="Toner levels & errors come from the Omni Agent (SNMP) or your print vendor's cloud. Low toner can auto-create a procurement order.">
          <table className="table-base"><thead><tr><th>Printer</th><th>Client</th><th>Model</th><th>Status</th><th className="w-40">Toner</th><th /></tr></thead>
            <tbody>{printers.map((p) => <tr key={p.id}><td>{p.hostname}<div className="font-mono text-xs text-muted">{p.ip}</div></td><td>{clientName(p.clientId)}</td><td>{p.os}</td><td><Badge tone={p.status === 'online' ? 'ok' : 'bad'}>{p.status}</Badge></td><td><Bar value={100 - (p.toner ?? 100)} tone={(p.toner ?? 100) < 15 ? 'bad' : (p.toner ?? 100) < 30 ? 'warn' : 'ok'} /><span className="text-xs">{p.toner}% remaining</span></td>
              <td>{(p.toner ?? 100) < 30 && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { s.add('purchaseOrders', { id: 'po' + Date.now(), number: `PO-${2040 + s.purchaseOrders.length + 1}`, vendor: 'CDW', clientId: p.clientId, items: [{ name: `Toner for ${p.os}`, sku: 'TONER', qty: 1, cost: 120, price: 165 }], status: 'pending_approval', createdAt: new Date().toISOString() }); toast('Toner order created in Procurement') }}><ShoppingCart size={13} /> Order toner</button>}</td></tr>)}</tbody></table>
        </Card>
      )}
      {tab === 'backup' && (
        <Card title="Backup status">
          <table className="table-base"><thead><tr><th>Device</th><th>Client</th><th>Last result</th><th>Last seen</th></tr></thead>
            <tbody>{s.devices.filter((d) => d.backupStatus).map((d) => <tr key={d.id}><td>{d.hostname}</td><td>{clientName(d.clientId)}</td><td><Badge tone={d.backupStatus === 'ok' ? 'ok' : d.backupStatus === 'failed' ? 'bad' : 'muted'}>{d.backupStatus}</Badge></td><td>{timeAgo(d.lastSeen)}</td></tr>)}</tbody></table>
        </Card>
      )}
      {tab === 'scripts' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Script library">{SCRIPTS.map((x, i) => <button key={x.name} onClick={() => setScript(i)} className={cx('mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm', i === script ? 'bg-accent/15 text-accent' : 'hover:bg-ink/5')}>{x.name}<span className="ml-2 text-xs text-muted">{x.lang}</span></button>)}</Card>
          <Card title={SCRIPTS[script].name} className="lg:col-span-2">
            <pre className="mb-3 overflow-x-auto rounded-xl bg-ink/5 p-3 font-mono text-xs">{SCRIPTS[script].body}</pre>
            <div className="flex items-end gap-2">
              <Field label="Run on" className="flex-1"><select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>{s.devices.filter((d) => d.rmmAgent).map((d) => <option key={d.id} value={d.id}>{d.hostname} · {clientName(d.clientId)}</option>)}</select></Field>
              <button className="btn-primary" onClick={async () => { const r = await api('rmm/script', { deviceId: target, script: SCRIPTS[script] }); s.log(`Ran "${SCRIPTS[script].name}"`); toast(r.ok ? 'Script queued in RMM' : 'Connect your RMM to run scripts remotely', r.ok ? 'ok' : 'warn') }}><Play size={15} /> Run</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
