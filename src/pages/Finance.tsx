// Finance workspace: QuickBooks panel, invoices, drag-and-drop builder, payments, financial health, non-payment notices.
import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { Download, FileWarning, Mail, RefreshCw, Landmark, CreditCard, Smartphone, Eye, Check } from 'lucide-react'
import { useStore, invoiceTotal, isOverdue, clientName } from '../lib/store'
import { Badge, Card, Modal, PageHeader, Stat, Tabs, Toggle, toast, cx } from '../components/ui'
import InvoiceBuilder from '../components/InvoiceBuilder'
import { daysUntil, fmtDate, money, sum, iso } from '../lib/format'
import { invoicePdf, nonPaymentPdf, nonPaymentText, type NoticeData } from '../lib/pdf'
import { api } from '../lib/api'
import type { Invoice } from '../lib/types'

type Tab = 'overview' | 'invoices' | 'builder' | 'payments' | 'health' | 'notices'
const tip = { contentStyle: { background: 'rgb(var(--panel))', border: '1px solid rgb(var(--line))', borderRadius: 12 } }
const axis = { tick: { fill: 'rgb(var(--muted))', fontSize: 12 }, axisLine: false, tickLine: false }

export default function Finance() {
  const s = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const overdue = s.invoices.filter(isOverdue)
  const qbo = s.integrations.quickbooks.connected

  return (
    <div>
      <PageHeader title="Finance" subtitle={qbo ? 'Synced with QuickBooks Online' : 'Demo figures — connect QuickBooks for live numbers'}
        actions={<button className="btn-ghost" onClick={async () => { const r = await api('quickbooks/sync', {}); toast(r.ok ? 'QuickBooks sync complete' : 'Connect QuickBooks in Integrations first', r.ok ? 'ok' : 'warn') }}><RefreshCw size={15} /> Sync QuickBooks</button>} />
      <Tabs<Tab> value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'overview', label: 'QuickBooks panel' }, { id: 'invoices', label: 'Invoices', count: s.invoices.length }, { id: 'builder', label: 'Invoice builder' },
        { id: 'payments', label: 'Payments' }, { id: 'health', label: 'Financial health' }, { id: 'notices', label: 'Non-payment notices', count: overdue.length },
      ]} />
      {tab === 'overview' && <QuickBooksPanel />}
      {tab === 'invoices' && <InvoiceList />}
      {tab === 'builder' && <InvoiceBuilder initialClient={params.get('client') || undefined} />}
      {tab === 'payments' && <Payments />}
      {tab === 'health' && <Health />}
      {tab === 'notices' && <Notices />}
    </div>
  )
}

function QuickBooksPanel() {
  const s = useStore()
  const revenue = sum(s.invoices.filter((i) => i.status !== 'void' && i.status !== 'draft'), invoiceTotal)
  const expenses = sum(s.expenses, (e) => e.amount) + sum(s.employees, (e) => e.rate * e.hoursThisPeriod * 2)
  const open = s.invoices.filter((i) => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft')
  const buckets = [
    ['Current', open.filter((i) => daysUntil(i.dueDate) >= 0)],
    ['1–30 days', open.filter((i) => daysUntil(i.dueDate) < 0 && daysUntil(i.dueDate) >= -30)],
    ['31–60 days', open.filter((i) => daysUntil(i.dueDate) < -30 && daysUntil(i.dueDate) >= -60)],
    ['61–90+ days', open.filter((i) => daysUntil(i.dueDate) < -60)],
  ] as const
  const taxCats = Object.entries(s.expenses.reduce<Record<string, number>>((a, e) => ((a[e.category] = (a[e.category] || 0) + e.amount), a), {})).sort((a, b) => b[1] - a[1])
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Revenue (MTD)" value={money(revenue)} />
        <Stat label="Expenses (MTD)" value={money(expenses)} />
        <Stat label="Net profit" value={money(revenue - expenses)} tone={revenue - expenses >= 0 ? 'ok' : 'bad'} sub={`${Math.round(((revenue - expenses) / Math.max(1, revenue)) * 100)}% margin`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Aging receivables (A/R)">
          {buckets.map(([label, list]) => (
            <div key={label} className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
              <span className={cx(label !== 'Current' && list.length && 'text-bad')}>{label}</span><span>{list.length} · <b>{money(sum([...list], invoiceTotal))}</b></span>
            </div>
          ))}
        </Card>
        <Card title="Vendor bills">
          {s.expenses.filter((e) => e.status === 'unpaid').map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
              <div><div>{e.vendor}</div><div className="text-xs text-muted">due {fmtDate(e.dueDate)}</div></div>
              <div className="flex items-center gap-2">{money(e.amount)}<button className="btn-ghost px-2 py-1 text-xs" onClick={() => { s.update('expenses', e.id, { status: 'paid' }); toast(`Marked ${e.vendor} bill paid`) }}>Pay</button></div>
            </div>
          ))}
        </Card>
        <Card title="Tax categories (expenses)">
          {taxCats.map(([k, v]) => <div key={k} className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{k}</span>{money(v)}</div>)}
        </Card>
      </div>
    </div>
  )
}

function InvoiceList() {
  const s = useStore()
  const send = async (i: Invoice) => {
    const c = s.clients.find((x) => x.id === i.clientId)!
    const r = await api('email/invoice', { invoice: i, to: c.primaryContact.email })
    s.update('invoices', i.id, { status: i.status === 'draft' ? 'sent' : i.status })
    toast(r.ok ? `Emailed to ${c.primaryContact.email}` : 'Marked as sent (connect Email to deliver automatically)', r.ok ? 'ok' : 'warn')
  }
  return (
    <Card>
      <div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Invoice</th><th>Client</th><th>Issued</th><th>Due</th><th>Total</th><th>Recurring</th><th>Status</th><th /></tr></thead>
        <tbody>{s.invoices.map((i) => {
          const od = isOverdue(i)
          return (
            <tr key={i.id}>
              <td className="font-medium">{i.number}</td><td>{clientName(i.clientId)}</td><td>{fmtDate(i.issueDate)}</td>
              <td className={cx(od && 'font-medium text-bad')}>{fmtDate(i.dueDate)}</td><td>{money(invoiceTotal(i), true)}</td>
              <td>{i.recurring ? <Badge tone="info">{i.recurring}</Badge> : '—'}</td>
              <td><Badge tone={i.status === 'paid' ? 'ok' : od ? 'bad' : i.status === 'draft' ? 'muted' : 'warn'}>{od ? 'overdue' : i.status}</Badge></td>
              <td><div className="flex justify-end gap-1">
                <button className="btn-ghost px-2 py-1" title="PDF" onClick={() => invoicePdf(i, s.clients.find((c) => c.id === i.clientId)!, s.company)}><Download size={13} /></button>
                {i.status !== 'paid' && <button className="btn-ghost px-2 py-1" title="Email" onClick={() => send(i)}><Mail size={13} /></button>}
                {i.status !== 'paid' && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { s.update('invoices', i.id, { status: 'paid', paidDate: iso().slice(0, 10) }); s.add('payments', { id: 'pay' + Date.now(), invoiceId: i.id, clientId: i.clientId, amount: invoiceTotal(i), date: iso(), method: 'check' }); toast('Recorded payment') }}>Mark paid</button>}
              </div></td>
            </tr>
          )
        })}</tbody>
      </table></div>
    </Card>
  )
}

function Payments() {
  const s = useStore()
  const icon = { ach: <Landmark size={14} />, card: <CreditCard size={14} />, wallet: <Smartphone size={14} />, check: <Check size={14} /> }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Payment history" className="lg:col-span-2" help="Clients pay from their portal by ACH, card, Apple Pay or Google Pay (via Stripe). Receipts are downloadable by the client.">
        <table className="table-base"><thead><tr><th>Date</th><th>Client</th><th>Invoice</th><th>Method</th><th>Amount</th></tr></thead>
          <tbody>{s.payments.map((p) => <tr key={p.id}><td>{fmtDate(p.date)}</td><td>{clientName(p.clientId)}</td><td>{s.invoices.find((i) => i.id === p.invoiceId)?.number}</td><td className="flex items-center gap-1.5 uppercase">{icon[p.method]}{p.method}</td><td>{money(p.amount, true)}</td></tr>)}</tbody></table>
        {s.payments.length === 0 && <p className="py-4 text-sm text-muted">No payments recorded yet.</p>}
      </Card>
      <Card title="Saved methods & auto-pay">
        {s.clients.filter((c) => c.status !== 'prospect').map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
            <div><div>{c.name}</div><div className="text-xs uppercase text-muted">{c.paymentMethod ?? 'no method on file'}</div></div>
            <Toggle checked={c.autopay} onChange={(v) => { s.update('clients', c.id, { autopay: v }); toast(`Auto-pay ${v ? 'on' : 'off'} for ${c.name}`) }} />
          </div>
        ))}
        <Link to="/portal" target="_blank" className="btn-ghost mt-3 w-full text-xs">Open client payment portal</Link>
      </Card>
    </div>
  )
}

function Health() {
  const s = useStore()
  const active = s.clients.filter((c) => c.status === 'active')
  const mrr = sum(active, (c) => c.mrr)
  const outstanding = sum(s.invoices.filter((i) => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft'), invoiceTotal)
  const vendorCost = (cid: string) => sum(s.contracts.filter((k) => k.clientId === cid && k.vendor !== s.company.name), (k) => k.value / 12) * 0.6 + sum(s.tickets.filter((t) => t.clientId === cid), (t) => t.hours * 30)
  const perClient = active.map((c) => ({ name: c.name.split(' ')[0], revenue: c.mrr, profit: Math.round(c.mrr - vendorCost(c.id)) }))
  const svc = [
    { name: 'Managed IT', revenue: Math.round(mrr * 0.62), profit: Math.round(mrr * 0.62 * 0.55) },
    { name: 'Security', revenue: Math.round(mrr * 0.18), profit: Math.round(mrr * 0.18 * 0.38) },
    { name: 'Backup', revenue: Math.round(mrr * 0.08), profit: Math.round(mrr * 0.08 * 0.5) },
    { name: 'Network', revenue: Math.round(mrr * 0.07), profit: Math.round(mrr * 0.07 * 0.6) },
    { name: 'Print', revenue: Math.round(mrr * 0.05), profit: Math.round(mrr * 0.05 * 0.45) },
  ]
  const cash = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return { m: d.toLocaleDateString('en-US', { month: 'short' }), in: Math.round(mrr * (0.75 + i * 0.05)), out: Math.round(mrr * (0.55 + i * 0.025)) } })
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="MRR" value={money(mrr)} /><Stat label="ARR" value={money(mrr * 12)} />
        <Stat label="Outstanding balances" value={money(outstanding)} tone={outstanding ? 'warn' : 'ok'} />
        <Stat label="Avg revenue per client" value={money(mrr / Math.max(1, active.length))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cash flow (in vs out)"><div className="h-60"><ResponsiveContainer><BarChart data={cash} barGap={2}><CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 3" /><XAxis dataKey="m" {...axis} /><YAxis {...axis} width={50} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} /><Tooltip {...tip} formatter={(v) => money(Number(v))} /><Legend /><RBar dataKey="in" name="Cash in" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} /><RBar dataKey="out" name="Cash out" fill="rgb(var(--accent2))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card title="Profit per client (monthly)"><div className="h-60"><ResponsiveContainer><BarChart data={perClient} barGap={2}><CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 3" /><XAxis dataKey="name" {...axis} /><YAxis {...axis} width={50} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} /><Tooltip {...tip} formatter={(v) => money(Number(v))} /><Legend /><RBar dataKey="revenue" name="Revenue" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} /><RBar dataKey="profit" name="Profit" fill="rgb(var(--accent2))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card title="Profit per service" className="lg:col-span-2">
          <table className="table-base"><thead><tr><th>Service</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead><tbody>{svc.map((x) => <tr key={x.name}><td>{x.name}</td><td>{money(x.revenue)}</td><td>{money(x.profit)}</td><td>{Math.round((x.profit / Math.max(1, x.revenue)) * 100)}%</td></tr>)}</tbody></table>
        </Card>
      </div>
    </div>
  )
}

function Notices() {
  const s = useStore()
  const [view, setView] = useState<NoticeData | null>(null)
  const overdue = s.invoices.filter(isOverdue)
  const data = (i: Invoice): NoticeData => ({ invoice: i, client: s.clients.find((c) => c.id === i.clientId)!, company: s.company, amountOwed: invoiceTotal(i), daysPastDue: -daysUntil(i.dueDate) })
  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm"><FileWarning size={16} className="mt-0.5 text-warn" /><span>A <b>Notice of Non-Payment</b> is pre-generated automatically the day an invoice passes its due date. Each includes: contractor name & address, property owner and any prime contractor name & address, description of work/materials, amount owed as of today, and last date of service. <i>Lien-notice rules vary by state — have your attorney review the template before sending.</i></span></div>
      {overdue.length === 0 && <Card><p className="text-sm text-muted">No overdue invoices. Nice!</p></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {overdue.map((i) => {
          const d = data(i)
          return (
            <Card key={i.id} title={<span className="text-bad">Notice ready · {d.client.name}</span>} icon={<FileWarning size={16} />}>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted">Invoice</dt><dd>{i.number}</dd>
                <dt className="text-muted">Amount owed</dt><dd className="font-semibold text-bad">{money(d.amountOwed, true)}</dd>
                <dt className="text-muted">Days past due</dt><dd>{d.daysPastDue}</dd>
                <dt className="text-muted">Last date of service</dt><dd>{fmtDate(i.lastServiceDate)}</dd>
                <dt className="text-muted">Property owner</dt><dd>{d.client.ownerName}</dd>
                <dt className="text-muted">Prime contractor</dt><dd>{d.client.primeContractor?.name ?? '—'}</dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => setView(d)}><Eye size={14} /> Preview</button>
                <button className="btn-primary" onClick={() => { nonPaymentPdf(d); s.add('documents', { id: 'doc' + Date.now(), clientId: d.client.id, name: `Notice of Non-Payment — ${i.number}`, category: 'Notice', createdAt: iso(), refId: i.id }); s.log(`Generated non-payment notice for ${i.number}`) }}><Download size={14} /> Download PDF</button>
                <button className="btn-ghost" onClick={async () => { const r = await api('email/notice', { text: nonPaymentText(d), to: d.client.primaryContact.email }); toast(r.ok ? 'Notice emailed' : 'Connect Email in Integrations to send automatically', r.ok ? 'ok' : 'warn') }}><Mail size={14} /> Email</button>
              </div>
            </Card>
          )
        })}
      </div>
      <Modal open={!!view} onClose={() => setView(null)} wide title="Notice of Non-Payment — preview">{view && <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{nonPaymentText(view)}</pre>}</Modal>
    </div>
  )
}
