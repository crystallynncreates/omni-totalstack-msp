// Auto-generated network diagram for a site: Internet → gateway → switching → endpoints.
import { Globe, Router, Network, Wifi, Monitor, Laptop, Server, Printer, Cpu, HelpCircle, Phone } from 'lucide-react'
import type { Device, Site } from '../lib/types'
import { cx } from './ui'

const ICON: Record<Device['type'], typeof Globe> = { firewall: Router, switch: Network, ap: Wifi, workstation: Monitor, laptop: Laptop, server: Server, printer: Printer, iot: Cpu, phone: Phone, unknown: HelpCircle }

function Node({ d, small }: { d: Pick<Device, 'hostname' | 'type' | 'status' | 'ip'>; small?: boolean }) {
  const I = ICON[d.type]
  return (
    <div className={cx('flex flex-col items-center gap-1 rounded-xl border bg-panel px-2 py-2 text-center', d.status === 'offline' ? 'border-bad/60' : d.status === 'warning' ? 'border-warn/60' : 'border-line', small ? 'w-24' : 'w-32')} title={`${d.hostname} · ${d.ip}`}>
      <I size={small ? 16 : 20} className={d.status === 'offline' ? 'text-bad' : d.status === 'warning' ? 'text-warn' : 'text-accent'} />
      <div className="w-full truncate text-[10px] font-medium">{d.hostname}</div>
      <div className="font-mono text-[9px] text-muted">{d.ip}</div>
    </div>
  )
}

export default function Topology({ site, devices }: { site: Site; devices: Device[] }) {
  const gw = devices.filter((d) => d.type === 'firewall')
  const core = devices.filter((d) => d.type === 'switch' || d.type === 'ap')
  const ends = devices.filter((d) => !['firewall', 'switch', 'ap'].includes(d.type))
  const Line = ({ bad }: { bad?: boolean }) => <div className={cx('mx-auto h-6 w-0.5', bad ? 'bg-bad' : 'bg-accent/40')} />
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-bg/40 p-4">
      <div className="flex min-w-max flex-col items-center">
        <div className={cx('flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs', site.status === 'down' ? 'border-bad text-bad' : 'border-line')}><Globe size={14} /> Internet · {site.isp} · {site.wanIp}</div>
        <Line bad={site.status === 'down'} />
        <div className="flex gap-3">{gw.length ? gw.map((d) => <Node key={d.id} d={d} />) : <Node d={{ hostname: 'Gateway (unknown)', type: 'firewall', status: 'warning', ip: '—' }} />}</div>
        <Line />
        <div className="flex flex-wrap justify-center gap-3">{core.length ? core.map((d) => <Node key={d.id} d={d} />) : <div className="rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">No managed switches/APs discovered</div>}</div>
        <Line />
        <div className="flex max-w-3xl flex-wrap justify-center gap-2">{ends.map((d) => <Node key={d.id} d={d} small />)}</div>
      </div>
    </div>
  )
}
