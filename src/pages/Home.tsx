// Command Center — CEO-level cockpit: technical + business health on one screen.
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  Siren, TriangleAlert, FileWarning, Ticket, RefreshCw, Radar, Truck, Boxes, Printer, DollarSign, Wallet, CalendarClock, ShieldCheck, ArrowRight, Magnet,
} from 'lucide-react'
import { useStore, invoiceTotal, isOverdue, clientName } from '../lib/store'
import { Badge, Card, Expiry, Ring, Stat, StatusDot, Bar, cx } from '../components/ui'
import { daysSince, daysUntil, expiryState, fmtDate, money, sum, timeAgo } from '../lib/format'
import { patchStage } from '../lib/patchPolicy'

export default function Home() {
  const s = useStore()
  const down = s.sites.filter((x) => x.status !== 'online')
  const expiring = s.contracts.filter((c) => ['expired', 'soon'].includes(expiryState(c.endDate))).sort((a, b) => a.endDate.localeCompare(b.endDate))
  const overdue = s.invoices.filter(isOverdue)
  const openTickets = s.tickets.filter((t) => t.status !== 'resolved')
  const atRisk = openTickets.filter((t) => new Date(t.slaDueAt).getTime() - Date.now() < 2 * 3600e3)
  const mrr = sum(s.clients.filter((c) => c.status === 'active'), (c) => c.mrr)
  const paidThisMonth = sum(s.payments.filter((p) => daysSince(p.date) <= 30), (p) => p.amount)
  const stages = s.patches.map((p) => patchStage(p, s.company.patchSoakDays).stage)
  const lowStock = s.inventory.filter((i) => i.qty <= i.reorderAt)
  const printers = s.devices.filter((d) => d.type === 'printer')
  const newHosts = s.scans.flatMap((sc) => sc.hosts.filter((h) => h.isNew).map((h) => ({ ...h, clientId: sc.clientId })))
  const slaMet = s.tickets.filter((t) => t.status === 'resolved').length ? 100 - (atRisk.length / Math.max(1, openTickets.length)) * 20 : 100
  const offline = s.devices.filter((d) => d.status === 'offline')
  const inventoryValue = sum(s.inventory, (i) => i.qty * i.cost)
  const procurementSpend = sum(s.purchaseOrders, (p) => sum(p.items, (i) => i.qty * i.cost))
  const nextPayroll = (() => { const d = new Date(); const day = d.getDate() <= 15 ? 15 : new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return new Date(d.getFullYear(), d.getMonth(), day) })()
  const newLeads = s.leads.filter((l) => l.status === 'new')

  const revenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    return { m: d.toLocaleDateString('en-US', { month: 'short' }), revenue: Math.round(mrr * (0.72 + i * 0.056)) }
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-display text-2xl md:text-3xl">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {s.ui.userName}</h1>
          <p className="text-sm text-muted">Here's everything that needs you today — technical and business.</p>
        </div>
        <div className="flex gap-2"><Link to="/app/proposals/new" className="btn-primary">New proposal</Link><Link to="/app/finance?tab=builder" className="btn-ghost">New invoice</Link></div>
      </div>

      {/* Critical banner: outages */}
      {down.length > 0 && (
        <div className="glass flex flex-wrap items-center gap-3 border-bad/50 bg-bad/10 p-4">
          <Siren className="text-bad" />
          <div className="flex-1">
            <div className="font-semibold text-bad">{down.filter((x) => x.status === 'down').length} site(s) DOWN · {down.filter((x) => x.status === 'degraded').length} degraded</div>
            <div className="text-sm">{down.map((x) => `${x.name} — ${x.outages.find((o) => !o.end)?.cause ?? x.status}`).join(' · ')}</div>
          </div>
          <Link to="/app/infrastructure" className="btn-danger">View outages</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={money(mrr)} sub={`ARR ${money(mrr * 12)}`} icon={<DollarSign size={16} />} />
        <Stat label="Overdue invoices" value={money(sum(overdue, invoiceTotal))} sub={`${overdue.length} invoice(s) · notices ready`} tone={overdue.length ? 'bad' : 'ok'} icon={<FileWarning size={16} />} />
        <Stat label="Open tickets" value={openTickets.length} sub={`${atRisk.length} at SLA risk`} tone={atRisk.length ? 'warn' : undefined} icon={<Ticket size={16} />} />
        <Stat label="Payments (30 days)" value={money(paidThisMonth)} sub={`Next payroll ${fmtDate(nextPayroll.toISOString())}`} icon={<Wallet size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Revenue trend" icon={<DollarSign size={16} />} className="xl:col-span-2" help="Monthly recurring revenue for the last six months. Connect QuickBooks to use actual booked revenue.">
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={revenue} margin={{ left: 0, right: 8, top: 8 }}>
                <defs><linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent))" stopOpacity={0.35} /><stop offset="1" stopColor="rgb(var(--accent))" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 3" />
                <XAxis dataKey="m" tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: 'rgb(var(--panel))', border: '1px solid rgb(var(--line))', borderRadius: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="rgb(var(--accent))" strokeWidth={2} fill="url(#rv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Contracts & subscriptions expiring" icon={<CalendarClock size={16} />} help="Anything expired or expiring within 30 days shows in red. Renew or update them from the client's Contracts tab.">
          {expiring.length === 0 && <p className="text-sm text-muted">Nothing expiring in the next 30 days.</p>}
          <div className="space-y-2">
            {expiring.slice(0, 6).map((c) => (
              <Link key={c.id} to={`/app/clients/${c.clientId}?tab=contracts`} className="block rounded-xl border border-bad/30 bg-bad/5 p-2.5 text-sm hover:border-bad">
                <div className="flex justify-between gap-2"><span className="font-medium">{c.name}</span><Badge tone="bad">{c.type}</Badge></div>
                <div className="mt-0.5 flex justify-between text-xs text-muted"><span>{clientName(c.clientId)}</span><Expiry date={c.endDate} /></div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Live RMM feed" icon={<TriangleAlert size={16} />}>
          <ul className="space-y-2 text-sm">
            {[...offline.map((d) => ({ t: `${d.hostname} offline`, c: d.clientId, tone: 'bad' as const, at: d.lastSeen })),
              ...s.devices.filter((d) => d.status === 'warning').map((d) => ({ t: `${d.hostname}: disk ${d.disk}%${d.backupStatus === 'failed' ? ', backup failed' : ''}`, c: d.clientId, tone: 'warn' as const, at: d.lastSeen })),
              ...s.devices.filter((d) => !d.huntressAgent && d.rmmAgent).map((d) => ({ t: `${d.hostname} missing Huntress agent`, c: d.clientId, tone: 'warn' as const, at: d.lastSeen }))].slice(0, 6).map((a, i) => (
              <li key={i} className="flex gap-2"><span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.tone === 'bad' ? 'bg-bad' : 'bg-warn')} /><div><div>{a.t}</div><div className="text-xs text-muted">{clientName(a.c)} · {timeAgo(a.at)}</div></div></li>
            ))}
          </ul>
        </Card>

        <Card title="Ticket heatmap" icon={<Ticket size={16} />} action={<Link to="/app/operations" className="text-xs text-accent">Open</Link>}>
          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
            {['P1', 'P2', 'P3', 'P4'].map((p) => <div key={p} className="text-muted">{p}</div>)}
            {s.clients.filter((c) => c.status === 'active').flatMap((c) => ['P1', 'P2', 'P3', 'P4'].map((p) => {
              const n = openTickets.filter((t) => t.clientId === c.id && t.priority === p).length
              return <div key={c.id + p} title={`${c.name} · ${p}: ${n}`} className="grid h-7 place-items-center rounded-md" style={{ background: n ? `rgb(var(--${p === 'P1' ? 'bad' : p === 'P2' ? 'warn' : 'accent'}) / ${0.25 + n * 0.25})` : 'rgb(var(--line) / .5)' }}>{n || ''}</div>
            }))}
          </div>
          <div className="mt-2 text-xs text-muted">Rows: {s.clients.filter((c) => c.status === 'active').map((c) => c.name.split(' ')[0]).join(' · ')}</div>
        </Card>

        <Card title="SLA compliance" icon={<ShieldCheck size={16} />}>
          <div className="flex items-center gap-4"><Ring value={slaMet} size={84} tone={slaMet > 95 ? 'ok' : 'warn'} /><div className="text-sm"><div>{atRisk.length} ticket(s) at risk</div><div className="text-muted">Avg first response 18 min</div></div></div>
        </Card>

        <Card title="Patch pipeline" icon={<RefreshCw size={16} />} action={<Link to="/app/patching" className="text-xs text-accent">Open</Link>}>
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            {(['soaking', 'approved', 'blocked', 'deployed'] as const).map((st) => (
              <div key={st} className="rounded-xl bg-ink/5 p-2"><div className={cx('h-display text-xl', st === 'blocked' && 'text-bad', st === 'approved' && 'text-ok')}>{stages.filter((x) => x === st).length}</div><div className="text-xs capitalize text-muted">{st}</div></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Network discovery" icon={<Radar size={16} />} action={<Link to="/app/discovery" className="text-xs text-accent">Scan</Link>}>
          {newHosts.length === 0 ? <p className="text-sm text-muted">No new devices.</p> : newHosts.map((h) => <div key={h.ip} className="mb-2 text-sm"><Badge tone={h.risk ? 'warn' : 'info'}>new</Badge> {h.hostname} <span className="text-xs text-muted">({h.ip}) · {clientName(h.clientId)}</span>{h.risk && <div className="text-xs text-warn">{h.risk}</div>}</div>)}
        </Card>
        <Card title="Projects" icon={<ArrowRight size={16} />}>
          <div className="flex flex-wrap justify-around gap-2">{s.projects.filter((p) => p.status !== 'done').map((p) => <Ring key={p.id} value={p.progress} label={p.name} tone={p.status === 'at_risk' ? 'warn' : p.status === 'delayed' ? 'bad' : 'accent'} />)}</div>
        </Card>
        <Card title="Procurement & inventory" icon={<Truck size={16} />}>
          <div className="space-y-1.5 text-sm">
            {s.purchaseOrders.filter((p) => p.status !== 'received').map((p) => <div key={p.id} className="flex justify-between"><span>{p.number} · {p.vendor.split(' ')[0]}</span><Badge tone={p.status === 'backordered' ? 'bad' : p.status === 'pending_approval' ? 'warn' : 'info'}>{p.status.replace('_', ' ')}</Badge></div>)}
            <div className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-xs text-muted"><Boxes size={13} /> {lowStock.length} low-stock · value {money(inventoryValue)} · spend {money(procurementSpend)}</div>
          </div>
        </Card>
        <Card title="Print fleet" icon={<Printer size={16} />}>
          {printers.map((p) => <div key={p.id} className="mb-2 text-sm"><div className="flex justify-between"><span>{p.hostname}</span><span className={cx('text-xs', (p.toner ?? 100) < 15 ? 'text-bad' : 'text-muted')}>{p.toner}% toner</span></div><Bar value={100 - (p.toner ?? 100)} tone={(p.toner ?? 100) < 15 ? 'bad' : (p.toner ?? 100) < 30 ? 'warn' : 'ok'} /></div>)}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Non-payment notices ready" icon={<FileWarning size={16} />} action={<Link to="/app/finance?tab=notices" className="text-xs text-accent">Review</Link>} help="When an invoice passes its due date, a Notice of Non-Payment is pre-generated with contractor, owner, prime contractor, work description, amount owed and last date of service.">
          {overdue.length === 0 && <p className="text-sm text-muted">All invoices are current. 🎉</p>}
          {overdue.map((i) => <div key={i.id} className="flex items-center justify-between border-b border-line/60 py-2 text-sm"><span>{clientName(i.clientId)} · {i.number}</span><span className="text-bad">{money(invoiceTotal(i), true)} · {-daysUntil(i.dueDate)}d late</span></div>)}
        </Card>
        <Card title="Sites" icon={<StatusDot status="online" />}>
          <div className="grid gap-2 sm:grid-cols-2">
            {s.sites.map((x) => <Link key={x.id} to="/app/infrastructure" className="flex items-center gap-2 rounded-xl border border-line p-2 text-sm hover:border-accent"><StatusDot status={x.status} /><span className="truncate">{x.name}</span><span className="ml-auto text-xs text-muted">{x.uptime30d}%</span></Link>)}
          </div>
          {newLeads.length > 0 && <Link to="/app/leads" className="mt-3 flex items-center gap-2 rounded-xl bg-accent/10 p-2.5 text-sm text-accent"><Magnet size={15} /> {newLeads.length} new lead(s) from your website</Link>}
        </Card>
      </div>
    </div>
  )
}
