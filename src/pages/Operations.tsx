// Tickets & SLA: kanban with SLA timers, billable flags, AI-suggested fixes, SLA dashboard.
import { useEffect, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { Plus, Sparkles, Timer, DollarSign, List, Columns3 } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import type { Ticket } from '../lib/types'
import { Badge, Card, Field, Modal, PageHeader, Stat, Tabs, Toggle, toast, cx } from '../components/ui'
import { fmtDateTime, uid, iso, addDays, sum } from '../lib/format'
import { askClaude } from '../lib/api'

const COLS: { id: Ticket['status']; label: string }[] = [{ id: 'new', label: 'New' }, { id: 'in_progress', label: 'In progress' }, { id: 'waiting', label: 'Waiting on client' }, { id: 'resolved', label: 'Resolved' }]
const SLA_HOURS: Record<Ticket['priority'], number> = { P1: 4, P2: 8, P3: 24, P4: 72 }

function useNow() { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), 30000); return () => clearInterval(t) }, []); return n }

function SlaTimer({ t }: { t: Ticket }) {
  const now = useNow()
  if (t.status === 'resolved') return <span className="text-xs text-ok">met</span>
  const ms = new Date(t.slaDueAt).getTime() - now
  const h = Math.floor(Math.abs(ms) / 3600e3), m = Math.floor((Math.abs(ms) % 3600e3) / 60e3)
  return <span className={cx('flex items-center gap-1 text-xs font-medium', ms < 0 ? 'text-bad' : ms < 2 * 3600e3 ? 'text-warn' : 'text-muted')}><Timer size={12} />{ms < 0 ? `breached ${h}h ${m}m` : `${h}h ${m}m left`}</span>
}

function TicketCard({ t, onOpen }: { t: Ticket; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onOpen} style={transform ? { transform: `translate(${transform.x}px,${transform.y}px)`, zIndex: 40 } : undefined} className={cx('cursor-grab rounded-xl border bg-panel p-3 text-sm active:cursor-grabbing', isDragging ? 'shadow-glow' : 'border-line', t.priority === 'P1' && 'border-l-4 border-l-bad')}>
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted">#{t.number}</span><Badge tone={t.priority === 'P1' ? 'bad' : t.priority === 'P2' ? 'warn' : 'muted'}>{t.priority}</Badge></div>
      <div className="mt-1 font-medium leading-snug">{t.title}</div>
      <div className="mt-1 text-xs text-muted">{clientName(t.clientId)}{t.assignee && ` · ${t.assignee}`}</div>
      <div className="mt-2 flex items-center justify-between"><SlaTimer t={t} />{t.billable && <Badge tone="ok"><DollarSign size={11} />{t.hours}h</Badge>}</div>
    </div>
  )
}

function Column({ id, label, children, count }: { id: string; label: string; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} className={cx('glass min-h-[300px] p-3', isOver && 'ring-1 ring-accent')}><div className="mb-2 flex justify-between text-sm font-semibold">{label}<span className="text-muted">{count}</span></div><div className="space-y-2">{children}</div></div>
}

type Tab = 'board' | 'list' | 'sla'

export default function Operations() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('board')
  const [open, setOpen] = useState<Ticket | null>(null)
  const [creating, setCreating] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const t = s.tickets.find((x) => x.id === e.active.id)
    if (t && t.status !== e.over.id) { s.update('tickets', t.id, { status: e.over.id as Ticket['status'] }); s.log(`Ticket #${t.number} → ${e.over.id}`) }
  }
  const resolved = s.tickets.filter((t) => t.status === 'resolved')
  const breached = s.tickets.filter((t) => t.status !== 'resolved' && new Date(t.slaDueAt) < new Date())

  return (
    <div>
      <PageHeader title="Tickets & SLA" subtitle={`${s.tickets.filter((t) => t.status !== 'resolved').length} open · ${breached.length} breached`} actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> New ticket</button>}
        help="Drag tickets between columns. Timers show time left on the SLA (P1 4h, P2 8h, P3 24h, P4 72h). Mark billable tickets with hours — they automatically appear in the invoice builder." />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'board', label: 'Board', icon: <Columns3 size={14} /> }, { id: 'list', label: 'List', icon: <List size={14} /> }, { id: 'sla', label: 'SLA dashboard' }]} />
      {tab === 'board' && (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {COLS.map((c) => { const list = s.tickets.filter((t) => t.status === c.id); return <Column key={c.id} id={c.id} label={c.label} count={list.length}>{list.map((t) => <TicketCard key={t.id} t={t} onOpen={() => setOpen(t)} />)}</Column> })}
          </div>
        </DndContext>
      )}
      {tab === 'list' && (
        <Card><table className="table-base"><thead><tr><th>#</th><th>Title</th><th>Client</th><th>Priority</th><th>Status</th><th>SLA</th><th>Billable</th></tr></thead>
          <tbody>{s.tickets.map((t) => <tr key={t.id} className="cursor-pointer" onClick={() => setOpen(t)}><td>{t.number}</td><td>{t.title}</td><td>{clientName(t.clientId)}</td><td>{t.priority}</td><td>{t.status.replace('_', ' ')}</td><td><SlaTimer t={t} /></td><td>{t.billable ? `${t.hours}h` : '—'}</td></tr>)}</tbody></table></Card>
      )}
      {tab === 'sla' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="SLA compliance" value={`${Math.round(((s.tickets.length - breached.length) / Math.max(1, s.tickets.length)) * 100)}%`} tone={breached.length ? 'warn' : 'ok'} />
            <Stat label="Breaches" value={breached.length} tone={breached.length ? 'bad' : 'ok'} />
            <Stat label="Avg response" value="18 min" /><Stat label="Avg resolution" value="6.4 h" />
          </div>
          <Card title="By client"><table className="table-base"><thead><tr><th>Client</th><th>SLA tier</th><th>Open</th><th>Resolved</th><th>Breached</th><th>Billable hours</th></tr></thead>
            <tbody>{s.clients.filter((c) => c.status !== 'prospect').map((c) => { const t = s.tickets.filter((x) => x.clientId === c.id); return <tr key={c.id}><td>{c.name}</td><td>{c.slaTier}</td><td>{t.filter((x) => x.status !== 'resolved').length}</td><td>{t.filter((x) => x.status === 'resolved').length}</td><td className={cx(breached.some((b) => b.clientId === c.id) && 'text-bad')}>{breached.filter((b) => b.clientId === c.id).length}</td><td>{sum(t.filter((x) => x.billable), (x) => x.hours)}</td></tr> })}</tbody></table></Card>
          <Card title="Breach log">{breached.length === 0 ? <p className="text-sm text-muted">No breaches.</p> : breached.map((t) => <div key={t.id} className="flex justify-between border-b border-line/60 py-2 text-sm"><span>#{t.number} {t.title} · {clientName(t.clientId)}</span><span className="text-bad">due {fmtDateTime(t.slaDueAt)}</span></div>)}</Card>
        </div>
      )}
      {open && <TicketModal t={s.tickets.find((x) => x.id === open.id)!} onClose={() => setOpen(null)} />}
      {creating && <NewTicket onClose={() => setCreating(false)} />}
      <p className="mt-3 text-xs text-muted">Resolved this period: {resolved.length}</p>
    </div>
  )
}

function TicketModal({ t, onClose }: { t: Ticket; onClose: () => void }) {
  const s = useStore()
  const [ai, setAi] = useState('')
  const [busy, setBusy] = useState(false)
  const up = (p: Partial<Ticket>) => s.update('tickets', t.id, p)
  const suggest = async () => {
    setBusy(true)
    const r = await askClaude(`MSP ticket for ${clientName(t.clientId)}: "${t.title}". ${t.description}. Give a short numbered troubleshooting plan (max 6 steps) a Tier 1 tech can follow, plus a one-sentence client update.`, 'You are a senior MSP technician.')
    setBusy(false)
    setAi(r ?? '1. Confirm scope: who/what is affected and since when.\n2. Check RMM for device/site alerts and recent changes.\n3. Check Huntress for isolation or incidents on the host.\n4. Apply the matching runbook from Documentation.\n5. Escalate to Tier 2 if not resolved within 50% of the SLA.\n\n(Connect Claude in Integrations for AI-tailored suggestions.)')
  }
  return (
    <Modal open onClose={onClose} wide title={`#${t.number} · ${t.title}`}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-2">
          <p className="rounded-xl bg-ink/5 p-3 text-sm">{t.description}</p>
          <button className="btn-ghost" disabled={busy} onClick={suggest}><Sparkles size={15} /> {busy ? 'Thinking…' : 'AI-suggested solution'}</button>
          {ai && <pre className="whitespace-pre-wrap rounded-xl border border-accent/30 bg-accent/5 p-3 font-sans text-sm">{ai}</pre>}
        </div>
        <div className="space-y-3">
          <Field label="Status"><select className="input" value={t.status} onChange={(e) => up({ status: e.target.value as Ticket['status'] })}>{COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
          <Field label="Priority"><select className="input" value={t.priority} onChange={(e) => up({ priority: e.target.value as Ticket['priority'] })}>{(['P1', 'P2', 'P3', 'P4'] as const).map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Assignee"><select className="input" value={t.assignee ?? ''} onChange={(e) => up({ assignee: e.target.value })}><option value="">Unassigned</option>{s.employees.map((e) => <option key={e.id}>{e.name}</option>)}</select></Field>
          <Toggle checked={t.billable} onChange={(v) => up({ billable: v })} label="Billable" />
          {t.billable && <Field label="Hours"><input type="number" step="0.25" className="input" value={t.hours} onChange={(e) => up({ hours: +e.target.value })} /></Field>}
          <div className="text-xs text-muted">SLA due {fmtDateTime(t.slaDueAt)}</div>
        </div>
      </div>
    </Modal>
  )
}

function NewTicket({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [t, setT] = useState({ clientId: s.clients[0]?.id ?? '', title: '', description: '', priority: 'P3' as Ticket['priority'], category: 'Support' })
  const save = () => {
    s.add('tickets', { id: uid('t'), number: 1000 + s.tickets.length + 1, ...t, status: 'new', createdAt: iso(), slaDueAt: iso(addDays(new Date(), SLA_HOURS[t.priority] / 24)), billable: false, hours: 0 })
    s.log(`Created ticket: ${t.title}`); onClose(); toast('Ticket created')
  }
  return (
    <Modal open onClose={onClose} title="New ticket" footer={<button className="btn-primary" disabled={!t.title} onClick={save}>Create</button>}>
      <div className="space-y-3">
        <Field label="Client"><select className="input" value={t.clientId} onChange={(e) => setT({ ...t, clientId: e.target.value })}>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Subject"><input className="input" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} /></Field>
        <Field label="Details"><textarea className="input" rows={3} value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority"><select className="input" value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value as Ticket['priority'] })}>{(['P1', 'P2', 'P3', 'P4'] as const).map((p) => <option key={p} value={p}>{p} ({SLA_HOURS[p]}h SLA)</option>)}</select></Field>
          <Field label="Category"><input className="input" value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  )
}
