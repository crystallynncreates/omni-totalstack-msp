// Client-facing portal: tickets, invoices & payments (ACH/card/wallet, saved methods, auto-pay, receipts), projects, assets, documents.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CreditCard, Landmark, Smartphone, Download, Plus, Ticket, FolderKanban, Monitor, FileText, Receipt, LogOut, ShieldCheck } from 'lucide-react'
import { useStore, invoiceTotal, isOverdue } from '../lib/store'
import { Badge, Card, Modal, Tabs, Toaster, toast, Toggle, Ring, StatusDot, cx } from '../components/ui'
import Logo from '../components/Logo'
import { fmtDate, money, uid, iso, addDays } from '../lib/format'
import { invoicePdf } from '../lib/pdf'
import { api } from '../lib/api'
import type { Invoice, Payment } from '../lib/types'
import { jsPDF } from 'jspdf'
import { useBrand } from '../lib/brand'
import { supabase } from '../lib/supabase'
import { bootstrap, signOut } from '../lib/cloud'

type Tab = 'home' | 'tickets' | 'billing' | 'projects' | 'assets' | 'documents'

export default function Portal() {
  const { clientId } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const { company, base, demo } = useBrand()
  const session = s.session
  // A signed-in client user always sees their own company; staff and the demo can pick one.
  const lockedClient = session?.role === 'client' ? session.clientId : null
  const client = s.clients.find((c) => c.id === (lockedClient || clientId))
  const [tab, setTab] = useState<Tab>('home')
  const [pay, setPay] = useState<Invoice | null>(null)
  const [newTicket, setNewTicket] = useState(false)
  const [t, setT] = useState<{ title: string; description: string; priority: 'P1' | 'P2' | 'P3' | 'P4' }>({ title: '', description: '', priority: 'P3' })

  if (!demo && !session) return <PortalSignIn />
  if (!client) {
    return (
      <div className="grid min-h-full place-items-center p-4">
        <div className="glass w-full max-w-md p-8 text-center">
          <Logo size={48} />
          <h1 className="mt-3 h-display text-2xl">{company.name} Client Portal</h1>
          <p className="mb-5 text-sm text-muted">{demo ? 'Demo: pick a client below.' : lockedClient ? 'Your account is not linked to a client yet. Please contact us.' : 'Preview the portal as one of your clients:'}</p>
          {!lockedClient && <div className="space-y-2">{s.clients.map((c) => <button key={c.id} onClick={() => nav(`${base}/portal/${c.id}`)} className="btn-ghost w-full justify-between">{c.name}<span className="text-xs text-muted">{c.group}</span></button>)}</div>}
          <Link to={base || '/'} className="mt-4 block text-xs text-muted hover:text-accent">← Back to website</Link>
        </div>
      </div>
    )
  }

  const invoices = s.invoices.filter((i) => i.clientId === client.id && i.status !== 'draft')
  const tickets = s.tickets.filter((x) => x.clientId === client.id)
  const projects = s.projects.filter((x) => x.clientId === client.id)
  const devices = s.devices.filter((x) => x.clientId === client.id)
  const docs = s.documents.filter((x) => x.clientId === client.id && ['Agreement', 'Proposal', 'RFS', 'QBR', 'Invoice'].includes(x.category))
  const payments = s.payments.filter((p) => p.clientId === client.id)
  const balance = invoices.filter((i) => i.status !== 'paid').reduce((a, i) => a + invoiceTotal(i), 0)
  const protectedPct = devices.length ? (devices.filter((d) => d.huntressAgent || ['ap', 'switch', 'firewall', 'printer'].includes(d.type)).length / devices.length) * 100 : 100

  const submitTicket = () => {
    s.add('tickets', { id: uid('t'), number: 1000 + s.tickets.length + 1, clientId: client.id, title: t.title, description: t.description, priority: t.priority, status: 'new', category: 'Portal', createdAt: iso(), slaDueAt: iso(addDays(new Date(), t.priority === 'P1' ? 0.17 : t.priority === 'P2' ? 0.33 : 1)), billable: false, hours: 0 })
    s.notify('info', `New portal ticket from ${client.name}: ${t.title}`, '/app/operations')
    setNewTicket(false); setT({ title: '', description: '', priority: 'P3' })
    toast('Ticket submitted — we are on it!')
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-panel/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Logo size={30} /><div><div className="h-display text-sm">{company.name}</div><div className="text-xs text-muted">Client portal · {client.name}</div></div>
          {lockedClient ? <button onClick={() => signOut()} className="btn-ghost ml-auto"><LogOut size={15} /> Sign out</button> : <Link to={`${base}/portal`} className="btn-ghost ml-auto"><LogOut size={15} /> Switch</Link>}
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'home', label: 'Overview' }, { id: 'tickets', label: 'Tickets', icon: <Ticket size={14} />, count: tickets.filter((x) => x.status !== 'resolved').length }, { id: 'billing', label: 'Invoices & Payments', icon: <Receipt size={14} /> }, { id: 'projects', label: 'Projects', icon: <FolderKanban size={14} /> }, { id: 'assets', label: 'My devices', icon: <Monitor size={14} /> }, { id: 'documents', label: 'Documents', icon: <FileText size={14} /> }]} />

        {tab === 'home' && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="Balance due"><div className={cx('h-display text-3xl', balance > 0 && 'text-warn')}>{money(balance, true)}</div><button className="btn-primary mt-3" onClick={() => setTab('billing')}>Pay now</button></Card>
            <Card title="Security protection" icon={<ShieldCheck size={16} />}><div className="flex items-center gap-4"><Ring value={protectedPct} tone={protectedPct === 100 ? 'ok' : 'warn'} /><p className="text-sm text-muted">Devices monitored 24/7 by the Huntress Security Operations Center.</p></div></Card>
            <Card title="Open requests"><div className="h-display text-3xl">{tickets.filter((x) => x.status !== 'resolved').length}</div><button className="btn-ghost mt-3" onClick={() => setNewTicket(true)}><Plus size={15} /> New request</button></Card>
            <Card title="Your plan" className="md:col-span-3"><div className="flex flex-wrap items-center gap-3 text-sm"><Badge tone="info">{client.slaTier}</Badge> Auto-pay: {lockedClient ? <Badge tone={client.autopay ? 'ok' : 'muted'}>{client.autopay ? 'On' : 'Off — turn on when you pay'}</Badge> : <Toggle checked={client.autopay} onChange={(v) => { s.update('clients', client.id, { autopay: v }); toast(v ? 'Auto-pay turned on' : 'Auto-pay turned off') }} />} <span className="text-muted">Saved method: {client.paymentMethod ? client.paymentMethod.toUpperCase() : 'none'}</span></div></Card>
          </div>
        )}

        {tab === 'tickets' && (
          <Card title="Support requests" action={<button className="btn-primary" onClick={() => setNewTicket(true)}><Plus size={15} /> New request</button>}>
            <table className="table-base"><thead><tr><th>#</th><th>Subject</th><th>Priority</th><th>Status</th><th>Opened</th></tr></thead>
              <tbody>{tickets.map((x) => <tr key={x.id}><td>{x.number}</td><td>{x.title}</td><td>{x.priority}</td><td><Badge tone={x.status === 'resolved' ? 'ok' : 'info'}>{x.status.replace('_', ' ')}</Badge></td><td>{fmtDate(x.createdAt)}</td></tr>)}</tbody></table>
          </Card>
        )}

        {tab === 'billing' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Invoices" className="lg:col-span-2">
              <table className="table-base"><thead><tr><th>Invoice</th><th>Due</th><th>Amount</th><th>Status</th><th /></tr></thead>
                <tbody>{invoices.map((i) => (
                  <tr key={i.id}><td>{i.number}</td><td>{fmtDate(i.dueDate)}</td><td>{money(invoiceTotal(i), true)}</td>
                    <td><Badge tone={i.status === 'paid' ? 'ok' : isOverdue(i) ? 'bad' : 'warn'}>{i.status === 'paid' ? 'paid' : isOverdue(i) ? 'overdue' : 'open'}</Badge></td>
                    <td className="flex justify-end gap-1.5">
                      <button className="btn-ghost px-2 py-1" onClick={() => invoicePdf(i, client, company)} title="Download PDF"><Download size={14} /></button>
                      {i.status !== 'paid' && <button className="btn-primary px-3 py-1" onClick={() => setPay(i)}>Pay</button>}
                    </td></tr>
                ))}</tbody></table>
            </Card>
            <Card title="Payment history">
              {payments.length === 0 && <p className="text-sm text-muted">No payments yet.</p>}
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
                  <div><div>{money(p.amount, true)}</div><div className="text-xs text-muted">{fmtDate(p.date)} · {p.method.toUpperCase()}</div></div>
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => receipt(p, s.invoices.find((i) => i.id === p.invoiceId)!, client.name, company.name)}><Download size={13} /> Receipt</button>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab === 'projects' && <div className="grid gap-4 md:grid-cols-2">{projects.map((p) => <Card key={p.id} title={p.name}><div className="flex items-center gap-4"><Ring value={p.progress} /><ul className="text-sm">{p.milestones.map((m) => <li key={m.name} className={m.done ? 'text-ok' : 'text-muted'}>{m.done ? '✓' : '○'} {m.name} — {fmtDate(m.due)}</li>)}</ul></div></Card>)}{projects.length === 0 && <p className="text-muted">No active projects.</p>}</div>}

        {tab === 'assets' && (
          <Card title="Your devices"><table className="table-base"><thead><tr><th>Device</th><th>Type</th><th>User</th><th>Status</th><th>Protected</th><th>Warranty</th></tr></thead>
            <tbody>{devices.map((d) => <tr key={d.id}><td>{d.hostname}</td><td className="capitalize">{d.type}</td><td>{d.assignedUser || '—'}</td><td><StatusDot status={d.status} /> {d.status}</td><td>{d.huntressAgent ? <Badge tone="ok">Huntress</Badge> : '—'}</td><td>{fmtDate(d.warrantyEnd)}</td></tr>)}</tbody></table></Card>
        )}

        {tab === 'documents' && <Card title="Documents">{docs.map((d) => <div key={d.id} className="flex items-center justify-between border-b border-line/60 py-2 text-sm"><span className="flex items-center gap-2"><FileText size={15} className="text-accent" />{d.name}</span><Badge>{d.category}</Badge></div>)}</Card>}
      </main>

      <Modal open={newTicket} onClose={() => setNewTicket(false)} title="New support request" footer={<button className="btn-primary" disabled={!t.title} onClick={submitTicket}>Submit</button>}>
        <div className="space-y-3">
          <input className="input" placeholder="What do you need help with?" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
          <textarea className="input" rows={4} placeholder="Details (optional)" value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} />
          <select className="input" value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value as typeof t.priority })}>
            <option value="P1">Urgent — business is stopped</option><option value="P2">High — several people affected</option><option value="P3">Normal — one person affected</option><option value="P4">Low — question or request</option>
          </select>
        </div>
      </Modal>
      {pay && <PayModal invoice={pay} onClose={() => setPay(null)} />}
      <Toaster />
    </div>
  )
}

function PayModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const s = useStore()
  const { company, slug, demo } = useBrand()
  const client = s.clients.find((c) => c.id === invoice.clientId)!
  const [method, setMethod] = useState<Payment['method']>(client.paymentMethod || 'card')
  const [save, setSave] = useState(true)
  const [autopay, setAutopay] = useState(client.autopay)
  const [busy, setBusy] = useState(false)
  const amount = invoiceTotal(invoice)

  const submit = async () => {
    setBusy(true)
    const r = await api<{ url?: string }>('stripe/pay', { slug, invoiceId: invoice.id, method, save, autopay })
    if (r.ok && r.data?.url) { window.location.href = r.data.url; return }
    if (!demo) { setBusy(false); return toast(r.error || 'Online payment is not available yet — please contact us.', 'warn') }
    // Demo mode: record the payment locally.
    const p: Payment = { id: uid('pay'), invoiceId: invoice.id, clientId: client.id, amount, date: iso(), method }
    s.add('payments', p)
    s.update('invoices', invoice.id, { status: 'paid', paidDate: iso().slice(0, 10) })
    s.update('clients', client.id, { autopay, paymentMethod: save ? (method === 'check' ? client.paymentMethod : method) : client.paymentMethod })
    s.notify('ok', `${client.name} paid ${invoice.number} (${money(amount, true)})`, '/app/finance?tab=payments')
    s.log(`Payment received for ${invoice.number}`)
    setBusy(false); onClose(); toast('Payment successful — thank you!')
  }
  const opts: { id: Payment['method']; label: string; icon: React.ReactNode; note: string }[] = [
    { id: 'ach', label: 'Bank (ACH)', icon: <Landmark size={18} />, note: 'Lowest fees · 3–5 days' },
    { id: 'card', label: 'Credit / debit card', icon: <CreditCard size={18} />, note: 'Instant' },
    { id: 'wallet', label: 'Apple Pay / Google Pay', icon: <Smartphone size={18} />, note: 'Instant' },
  ]
  return (
    <Modal open onClose={onClose} title={`Pay ${invoice.number}`} footer={<button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Processing…' : `Pay ${money(amount, true)}`}</button>}>
      <div className="space-y-3">
        {opts.map((o) => (
          <button key={o.id} onClick={() => setMethod(o.id)} className={cx('flex w-full items-center gap-3 rounded-xl border p-3 text-left', method === o.id ? 'border-accent bg-accent/10' : 'border-line')}>
            <span className="text-accent">{o.icon}</span><span className="flex-1"><span className="block text-sm font-medium">{o.label}</span><span className="text-xs text-muted">{o.note}</span></span>
          </button>
        ))}
        <Toggle checked={save} onChange={setSave} label="Save this payment method" />
        <div><Toggle checked={autopay} onChange={setAutopay} label="Turn on auto-pay for future invoices" /></div>
        <p className="text-xs text-muted">Payments are processed securely by Stripe. {company.name} never sees your full card or bank number.</p>
      </div>
    </Modal>
  )
}

function receipt(p: Payment, inv: Invoice, clientName: string, company: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(`${company} — Payment Receipt`, 40, 60)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  ;[['Received from', clientName], ['Invoice', inv?.number ?? ''], ['Amount', money(p.amount, true)], ['Method', p.method.toUpperCase()], ['Date', fmtDate(p.date)], ['Receipt #', p.id.toUpperCase()]].forEach(([k, v], i) => { doc.text(`${k}:`, 40, 100 + i * 20); doc.text(v, 160, 100 + i * 20) })
  doc.text('Thank you for your payment!', 40, 240)
  doc.save(`Receipt-${inv?.number}.pdf`)
}

function PortalSignIn() {
  const { company, base } = useBrand()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const { error } = await supabase!.auth.signInWithPassword({ email, password: pw })
    if (error) { setBusy(false); return setErr(error.message) }
    const r = await bootstrap()
    setBusy(false)
    if (!r.ok) setErr(r.message || 'This account does not have portal access yet.')
  }
  return (
    <div className="grid min-h-full place-items-center p-4">
      <form onSubmit={submit} className="glass w-full max-w-md space-y-3 p-8">
        <div className="text-center"><Logo size={48} /><h1 className="mt-3 h-display text-2xl">{company.name}</h1><p className="text-sm text-muted">Client portal sign-in</p></div>
        <input className="input" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" required placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-sm text-bad">{err}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-xs text-muted">First time here? Open the invitation link in your email to set your password.</p>
        <Link to={base || '/'} className="block text-center text-xs text-muted hover:text-accent">← Back to website</Link>
      </form>
    </div>
  )
}
