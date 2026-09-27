// Proposal detail: findings, three options side-by-side (editable), select → RFS PDF, accept → onboard.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, FileSignature, Check, ShieldCheck, Sparkles, Send, Trash2, Lock, PartyPopper } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Proposal, LineItem } from '../lib/types'
import { Badge, Card, Empty, toast, cx } from '../components/ui'
import { optionTotals, recommend, CATALOG } from '../lib/proposalEngine'
import { proposalPdf, rfsPdf } from '../lib/pdf'
import { askClaude } from '../lib/api'
import { fmtDate, money, uid, iso, isoDate, addDays } from '../lib/format'

export default function ProposalView() {
  const { id } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const p = s.proposals.find((x) => x.id === id)
  const client = s.clients.find((c) => c.id === p?.clientId)
  const [aiBusy, setAiBusy] = useState(false)
  if (!p || !client) return <Empty title="Proposal not found" action={<Link to="/app/proposals" className="btn-ghost">Back</Link>} />

  const save = (patch: Partial<Proposal>) => s.update('proposals', p.id, patch)
  const rec = recommend(p.options, p.intake.budgetMonthly)

  const setLine = (oi: number, li: number, patch: Partial<LineItem>) => {
    const options = p.options.map((o, k) => (k !== oi ? o : { ...o, lineItems: o.lineItems.map((l, j) => (j === li ? { ...l, ...patch } : l)) }))
    save({ options })
  }
  const removeLine = (oi: number, li: number) => save({ options: p.options.map((o, k) => (k !== oi ? o : { ...o, lineItems: o.lineItems.filter((_, j) => j !== li) })) })
  const addLine = (oi: number, sku: string) => {
    const c = CATALOG[sku]
    save({ options: p.options.map((o, k) => (k !== oi ? o : { ...o, lineItems: [...o.lineItems, { sku, description: c.name, category: c.category, qty: 1, unitPrice: c.price, recurring: c.recurring }] })) })
  }

  const select = (i: number) => {
    const n = s.proposals.filter((x) => x.rfsNumber).length + 1
    save({ selected: i, rfsNumber: p.rfsNumber ?? `RFS-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`, rfsDate: p.rfsDate ?? iso() })
    s.log(`Selected ${p.options[i].tier} on ${p.number}`)
    toast(`${p.options[i].tier} selected — RFS ready to download`)
  }

  const accept = () => {
    if (p.selected === undefined) return
    const o = p.options[p.selected]
    const t = optionTotals(o)
    save({ status: 'accepted' })
    s.update('clients', client.id, { status: client.status === 'prospect' ? 'onboarding' : client.status, mrr: Math.round(t.monthly), slaTier: o.tier })
    s.add('contracts', { id: uid('k'), clientId: client.id, name: `Master Services Agreement — ${o.tier}`, type: 'MSA', vendor: s.company.name, startDate: isoDate(), endDate: isoDate(addDays(new Date(), 365)), value: Math.round(t.monthly * 12), billing: 'monthly', autoRenew: true })
    s.add('contracts', { id: uid('k'), clientId: client.id, name: 'Huntress managed security (required)', type: 'Huntress', vendor: 'Huntress', startDate: isoDate(), endDate: isoDate(addDays(new Date(), 365)), value: Math.round(o.lineItems.filter((l) => l.sku.startsWith('HUN')).reduce((a, l) => a + l.qty * l.unitPrice, 0) * 12), billing: 'monthly', autoRenew: true })
    s.add('documents', { id: uid('doc'), clientId: client.id, name: `Signed RFS ${p.rfsNumber}`, category: 'Agreement', createdAt: iso(), status: 'signed', refId: p.id })
    s.add('invoices', { id: uid('inv'), number: `INV-${1100 + s.invoices.length + 1}`, clientId: client.id, issueDate: isoDate(), dueDate: isoDate(addDays(new Date(), s.company.paymentTermsDays)), status: 'draft', lastServiceDate: isoDate(), taxRate: 0, workDescription: `Services per ${p.rfsNumber}: ${o.title}`, lines: o.lineItems.map((l) => ({ id: uid('il'), description: l.description, qty: l.qty, rate: l.unitPrice, source: l.recurring ? 'sla' : 'hardware' })) })
    s.add('projects', { id: uid('pj'), clientId: client.id, name: `Onboarding — ${o.tier}`, status: 'on_track', progress: 0, start: isoDate(), end: isoDate(addDays(new Date(), 14)), budget: t.oneTime, billableHours: 0, milestones: [{ name: 'Kickoff & documentation', due: isoDate(addDays(new Date(), 2)), done: false }, { name: 'Deploy RMM + Huntress agents', due: isoDate(addDays(new Date(), 4)), done: false }, { name: 'Network discovery & remediation', due: isoDate(addDays(new Date(), 9)), done: false }, { name: 'Go-live & welcome call', due: isoDate(addDays(new Date(), 14)), done: false }] })
    s.leads.filter((l) => l.email && l.email === client.primaryContact.email).forEach((l) => s.update('leads', l.id, { status: 'won' }))
    s.notify('ok', `${client.name} accepted ${o.tier} — onboarding project, contracts and first invoice created`, `/app/clients/${client.id}`)
    s.log(`Proposal ${p.number} accepted`)
    toast('Accepted! Contracts, onboarding project and draft invoice were created.')
  }

  const aiPolish = async () => {
    setAiBusy(true)
    const text = await askClaude(`Rewrite this MSP proposal executive summary to be persuasive, warm and non-technical for a small-business owner. Keep every fact and keep the Huntress requirement. 150 words max.\n\n${p.executiveSummary}`, 'You are a senior MSP sales engineer.')
    setAiBusy(false)
    if (text) { save({ executiveSummary: text }); toast('Summary polished by Claude') } else toast('Connect Claude in Integrations to use AI writing', 'warn')
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/app/proposals" className="text-xs text-muted hover:text-accent">← Proposals</Link>
          <h1 className="h-display text-2xl md:text-3xl">{p.number} · {client.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted"><Badge tone={p.status === 'accepted' ? 'ok' : 'info'}>{p.status}</Badge> Created {fmtDate(p.createdAt)} {p.rfsNumber && <Badge tone="violet">{p.rfsNumber}</Badge>}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => proposalPdf(p, client, s.company)}><Download size={15} /> Proposal PDF</button>
          <button className="btn-ghost" disabled={p.selected === undefined} onClick={() => rfsPdf(p, client, s.company)}><FileSignature size={15} /> RFS PDF</button>
          {p.status === 'draft' && <button className="btn-ghost" onClick={() => { save({ status: 'sent' }); toast(`Marked as sent to ${client.primaryContact.email}`) }}><Send size={15} /> Mark sent</button>}
          {p.status !== 'accepted' && <button className="btn-primary" disabled={p.selected === undefined} onClick={accept}><PartyPopper size={15} /> Client accepted</button>}
          <button className="btn-ghost" onClick={() => { if (confirmDelete()) { s.remove('proposals', p.id); nav('/app/proposals') } }}><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Executive summary" className="lg:col-span-2" action={<button className="btn-ghost px-2 py-1 text-xs" disabled={aiBusy} onClick={aiPolish}><Sparkles size={13} /> {aiBusy ? 'Writing…' : 'Polish with Claude'}</button>}>
          <textarea className="input min-h-[140px] text-sm leading-relaxed" value={p.executiveSummary} onChange={(e) => save({ executiveSummary: e.target.value })} />
        </Card>
        <Card title="Assessment findings">
          <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">
            {p.findings.map((f, i) => <li key={i} className="flex gap-2"><Badge className="h-fit shrink-0" tone={f.severity === 'high' ? 'bad' : f.severity === 'medium' ? 'warn' : 'muted'}>{f.area}</Badge><span>{f.text}</span></li>)}
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 mt-6 h-display text-xl">Three solutions</h2>
      <div className="grid gap-4 xl:grid-cols-3">
        {p.options.map((o, oi) => {
          const t = optionTotals(o)
          const sel = p.selected === oi
          return (
            <div key={oi} className={cx('glass flex flex-col p-4', sel && 'ring-2 ring-accent shadow-glow')}>
              <div className="flex items-start justify-between">
                <div><div className="text-xs uppercase tracking-widest text-muted">Option {oi + 1} · {o.tier}</div><div className="h-display text-lg">{o.title}</div></div>
                {oi === rec && <Badge tone="info">Fits budget</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted">{o.summary}</p>
              <div className="my-3 grid grid-cols-2 gap-2 rounded-xl bg-ink/5 p-3 text-center">
                <div><div className="h-display text-xl">{money(t.monthly)}</div><div className="text-xs text-muted">per month</div></div>
                <div><div className="h-display text-xl">{money(t.oneTime)}</div><div className="text-xs text-muted">one-time</div></div>
              </div>
              <ul className="mb-3 space-y-1 text-sm">{o.addresses.map((a) => <li key={a} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-ok" />{a}</li>)}</ul>
              <details className="mb-3 rounded-xl border border-line p-2 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-muted">Line items ({o.lineItems.length}) — edit quantities & prices</summary>
                <div className="mt-2 space-y-2">
                  {o.lineItems.map((l, li) => (
                    <div key={li} className="rounded-lg bg-ink/5 p-2 text-xs">
                      <div className="flex items-start gap-1">{l.mandatory && <Lock size={12} className="mt-0.5 shrink-0 text-accent2" />}<span className="flex-1">{l.description}</span>{!l.mandatory && <button onClick={() => removeLine(oi, li)} className="text-muted hover:text-bad"><Trash2 size={12} /></button>}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <input type="number" className="input w-16 px-2 py-1 text-xs" value={l.qty} onChange={(e) => setLine(oi, li, { qty: +e.target.value })} />×
                        <input type="number" className="input w-20 px-2 py-1 text-xs" value={l.unitPrice} onChange={(e) => setLine(oi, li, { unitPrice: +e.target.value })} />
                        <span className="ml-auto font-medium">{money(l.qty * l.unitPrice)}{l.recurring ? '/mo' : ''}</span>
                      </div>
                    </div>
                  ))}
                  <select className="input text-xs" value="" onChange={(e) => e.target.value && addLine(oi, e.target.value)}>
                    <option value="">+ Add item from catalog…</option>
                    {Object.values(CATALOG).map((c) => <option key={c.sku} value={c.sku}>{c.name} ({money(c.price)}/{c.unit})</option>)}
                  </select>
                </div>
              </details>
              <div className="mt-auto flex items-center gap-2 rounded-lg bg-accent2/10 px-2 py-1.5 text-xs text-accent2"><ShieldCheck size={13} /> Huntress included (required)</div>
              <button className={cx('mt-3', sel ? 'btn-primary' : 'btn-ghost')} onClick={() => select(oi)}>{sel ? <><Check size={15} /> Selected</> : 'Select this option'}</button>
              {sel && <button className="btn-ghost mt-2" onClick={() => rfsPdf(p, client, s.company)}><Download size={15} /> Download RFS (PDF)</button>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const confirmDelete = () => window.confirm('Delete this proposal?')
