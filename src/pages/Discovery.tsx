// Network Discovery: run the Omni Agent at a site (or import its results) to find every device on the network.
import { useEffect, useState } from 'react'
import { Radar, Upload, Download, Play, PlusCircle, ShieldAlert, Terminal } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import type { DiscoveredHost, DiscoveryScan, Device } from '../lib/types'
import { Badge, Card, Field, PageHeader, Tabs, toast, cx } from '../components/ui'
import { fmtDateTime, uid, iso } from '../lib/format'
import { api } from '../lib/api'

const RISKY: Record<number, string> = { 21: 'FTP open', 23: 'Telnet open', 3389: 'RDP exposed', 445: 'SMB open', 5900: 'VNC open', 1900: 'UPnP', 161: 'SNMP v1/v2 open' }
const VENDORS = [['Dell', 'workstation'], ['HP', 'printer'], ['Ubiquiti', 'ap'], ['Apple', 'laptop'], ['Hikvision', 'iot'], ['Lenovo', 'laptop'], ['Brother', 'printer'], ['Yealink', 'phone'], ['Espressif', 'iot'], ['Synology', 'server']] as const

function simulate(base: string, known: string[]): DiscoveredHost[] {
  const prefix = base.split('.').slice(0, 3).join('.')
  return Array.from({ length: 9 + Math.floor(Math.random() * 6) }, (_, k) => {
    const [vendor, t] = VENDORS[Math.floor(Math.random() * VENDORS.length)]
    const ip = `${prefix}.${10 + k * 7}`
    const ports = t === 'printer' ? [80, 443, 9100] : t === 'workstation' || t === 'laptop' ? [135, 445, ...(Math.random() > 0.7 ? [3389] : [])] : t === 'iot' ? [80, ...(Math.random() > 0.5 ? [23] : [])] : t === 'server' ? [22, 443, 445, 5000] : t === 'phone' ? [80, 5060] : [22, 443]
    const risk = ports.map((p) => RISKY[p]).filter(Boolean).join(', ') || undefined
    return { ip, mac: Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':').toUpperCase(), hostname: `${vendor.toUpperCase().slice(0, 4)}-${(1000 + k * 37).toString(16).toUpperCase()}`, vendor, guessedType: t as Device['type'], openPorts: ports, isNew: !known.includes(ip), risk }
  })
}

type Tab = 'scan' | 'history' | 'agent'

export default function Discovery() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('scan')
  const [siteId, setSiteId] = useState(s.sites[0]?.id ?? '')
  const site = s.sites.find((x) => x.id === siteId)
  const [range, setRange] = useState('10.10.0.0/24')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [scan, setScan] = useState<DiscoveryScan | null>(s.scans[0] ?? null)
  const [agentToken, setAgentToken] = useState('YOUR_AGENT_TOKEN')
  useEffect(() => { if (s.session && ['owner', 'admin'].includes(s.session.role)) api<{ token: string }>('discovery/token', {}).then((r) => r.ok && r.data && setAgentToken(r.data.token)) }, [s.session])

  const run = async () => {
    if (!site) return
    setRunning(true); setProgress(0)
    const r = await api<{ jobId: string }>('discovery/run', { siteId, range })
    if (r.ok) { toast('Scan queued — the Omni Agent at this site will report back in a minute'); setRunning(false); return }
    // Demo: simulate an agent sweep with progress
    for (let p = 0; p <= 100; p += 10) { setProgress(p); await new Promise((res) => setTimeout(res, 120)) }
    const known = s.devices.filter((d) => d.siteId === siteId).map((d) => d.ip)
    const sc: DiscoveryScan = { id: uid('sc'), siteId, clientId: site.clientId, range, startedAt: iso(), source: 'demo', hosts: simulate(range, known) }
    s.add('scans', sc); setScan(sc); setRunning(false)
    const n = sc.hosts.filter((h) => h.isNew).length
    s.notify(n ? 'warn' : 'ok', `Discovery at ${site.name}: ${sc.hosts.length} hosts, ${n} new`, '/app/discovery')
    s.log(`Ran network discovery at ${site.name}`)
  }

  const importFile = (f?: File) => {
    if (!f || !site) return
    f.text().then((txt) => {
      try {
        const j = JSON.parse(txt)
        const known = s.devices.filter((d) => d.siteId === siteId).map((d) => d.ip)
        const hosts: DiscoveredHost[] = (j.hosts || j).map((h: DiscoveredHost & { ports?: number[] }) => {
          const ports = h.openPorts || h.ports || []
          return { ip: h.ip, mac: h.mac || '', hostname: h.hostname || h.ip, vendor: h.vendor || 'Unknown', guessedType: h.guessedType || 'unknown', openPorts: ports, isNew: !known.includes(h.ip), risk: ports.map((p: number) => RISKY[p]).filter(Boolean).join(', ') || undefined }
        })
        const sc: DiscoveryScan = { id: uid('sc'), siteId, clientId: site.clientId, range: j.range || 'imported', startedAt: j.startedAt || iso(), source: 'import', hosts }
        s.add('scans', sc); setScan(sc); toast(`Imported ${hosts.length} hosts`)
      } catch { toast('That file is not an Omni Agent result (JSON)', 'bad') }
    })
  }

  const addToInventory = (h: DiscoveredHost, sc: DiscoveryScan) => {
    s.add('devices', { id: uid('d'), clientId: sc.clientId, siteId: sc.siteId, hostname: h.hostname, type: h.guessedType, os: 'Unknown', ip: h.ip, mac: h.mac, vendor: h.vendor, status: 'online', cpu: 0, ram: 0, disk: 0, lastSeen: iso(), pendingPatches: 0, huntressAgent: false, rmmAgent: false })
    s.update('scans', sc.id, { hosts: sc.hosts.map((x) => (x.ip === h.ip ? { ...x, isNew: false } : x)) })
    setScan({ ...sc, hosts: sc.hosts.map((x) => (x.ip === h.ip ? { ...x, isNew: false } : x)) })
    toast(`${h.hostname} added to ${clientName(sc.clientId)}'s devices`)
  }

  return (
    <div>
      <PageHeader title="Network Discovery" subtitle="Find every device on a client network" help="Browsers can't scan private networks, so discovery runs through the Omni Agent — a small script installed on one computer at the client site. It sweeps the subnet (ping + ARP + common ports + SNMP), identifies devices and reports back here. New or risky devices are flagged." />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'scan', label: 'Scan' }, { id: 'history', label: 'History', count: s.scans.length }, { id: 'agent', label: 'Install the Omni Agent' }]} />
      {tab === 'scan' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Start a scan" icon={<Radar size={16} />}>
            <div className="space-y-3">
              <Field label="Site"><select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>{s.sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
              <Field label="Network range (CIDR)" hint="Usually the office LAN, e.g. 192.168.1.0/24"><input className="input font-mono" value={range} onChange={(e) => setRange(e.target.value)} /></Field>
              <button className="btn-primary w-full" disabled={running} onClick={run}><Play size={15} /> {running ? `Scanning… ${progress}%` : 'Run discovery'}</button>
              {running && <div className="h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} /></div>}
              <label className="btn-ghost w-full cursor-pointer"><Upload size={15} /> Import agent results (.json)<input type="file" accept=".json" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} /></label>
            </div>
          </Card>
          <Card title={scan ? `Results — ${s.sites.find((x) => x.id === scan.siteId)?.name} · ${fmtDateTime(scan.startedAt)}` : 'Results'} className="xl:col-span-2" action={scan && <Badge tone={scan.source === 'demo' ? 'muted' : 'info'}>{scan.source === 'demo' ? 'demo scan' : scan.source}</Badge>}>
            {!scan ? <p className="text-sm text-muted">Run a scan to see devices.</p> : (
              <>
                <div className="mb-3 flex flex-wrap gap-2 text-xs"><Badge tone="info">{scan.hosts.length} hosts</Badge><Badge tone="warn">{scan.hosts.filter((h) => h.isNew).length} new</Badge><Badge tone="bad">{scan.hosts.filter((h) => h.risk).length} risky</Badge></div>
                <div className="overflow-x-auto"><table className="table-base">
                  <thead><tr><th>IP</th><th>Hostname</th><th>Vendor</th><th>Type</th><th>Open ports</th><th>Flags</th><th /></tr></thead>
                  <tbody>{scan.hosts.map((h) => (
                    <tr key={h.ip} className={cx(h.risk && 'bg-bad/5')}>
                      <td className="font-mono text-xs">{h.ip}<div className="text-[10px] text-muted">{h.mac}</div></td><td>{h.hostname}</td><td>{h.vendor}</td><td className="capitalize">{h.guessedType}</td>
                      <td className="font-mono text-xs">{h.openPorts.join(', ')}</td>
                      <td className="space-x-1">{h.isNew && <Badge tone="warn">new</Badge>}{h.risk && <Badge tone="bad"><ShieldAlert size={11} />{h.risk}</Badge>}</td>
                      <td>{h.isNew && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => addToInventory(h, scan)}><PlusCircle size={13} /> Add</button>}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              </>
            )}
          </Card>
        </div>
      )}
      {tab === 'history' && (
        <Card><table className="table-base"><thead><tr><th>When</th><th>Client / site</th><th>Range</th><th>Source</th><th>Hosts</th><th>New</th><th /></tr></thead>
          <tbody>{s.scans.map((sc) => <tr key={sc.id}><td>{fmtDateTime(sc.startedAt)}</td><td>{clientName(sc.clientId)} · {s.sites.find((x) => x.id === sc.siteId)?.name}</td><td className="font-mono text-xs">{sc.range}</td><td>{sc.source}</td><td>{sc.hosts.length}</td><td>{sc.hosts.filter((h) => h.isNew).length}</td><td><button className="text-accent" onClick={() => { setScan(sc); setTab('scan') }}>View</button></td></tr>)}</tbody></table></Card>
      )}
      {tab === 'agent' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Install in 3 steps" icon={<Terminal size={16} />}>
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              <li>Download the agent onto any always-on computer at the client site (Windows, Mac or Linux with Python 3).<div className="mt-2"><a className="btn-primary" href={`${import.meta.env.BASE_URL}agent/omni_scan.py`} download><Download size={15} /> Download omni_scan.py</a></div></li>
              <li>Run a one-time scan and save the results:<pre className="mt-2 overflow-x-auto rounded-lg bg-ink/5 p-2 font-mono text-xs">python omni_scan.py --range 192.168.1.0/24 --out results.json</pre>Then use <b>Import agent results</b> on the Scan tab.</li>
              <li>Or connect it to Omni for automatic scans (every 24h + on demand):<pre className="mt-2 overflow-x-auto rounded-lg bg-ink/5 p-2 font-mono text-xs">python omni_scan.py --range 192.168.1.0/24 \{'\n'}  --post {window.location.origin}/api/discovery/ingest \{'\n'}  --site {siteId} --token {agentToken}</pre></li>
            </ol>
            <p className="mt-3 text-xs text-muted">Only scan networks you manage and have written permission to scan (your MSA covers this for clients).</p>
          </Card>
          <Card title="What the agent collects">
            <ul className="space-y-1.5 text-sm">
              {['IP & MAC address (ping sweep + ARP table)', 'Hostname (reverse DNS / NetBIOS)', 'Manufacturer (MAC OUI lookup)', 'Open ports on common services (22, 23, 80, 443, 445, 3389, 9100, …)', 'Device type guess (printer, AP, workstation, server, IoT)', 'Risk flags (Telnet, RDP, SMB, FTP exposed)'].map((x) => <li key={x} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{x}</li>)}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}
