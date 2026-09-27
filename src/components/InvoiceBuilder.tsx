// Drag-and-drop invoice builder. Drag items from the "Auto-fill" palette onto the invoice (or click +),
// reorder lines by dragging the grip handle. Sources: SLA services, billable tickets, project hours, hardware.
import { useMemo, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { GripVertical, Plus, Trash2, Download, Send, Repeat, Save } from 'lucide-react'
import { useStore, invoiceTotal } from '../lib/store'
import type { Invoice, InvoiceLine } from '../lib/types'
import { Badge, Card, Field, Toggle, toast, cx } from './ui'
import { money, uid, isoDate, addDays } from '../lib/format'
import { invoicePdf } from '../lib/pdf'
import { api } from '../lib/api'

type Src = Omit<InvoiceLine, 'id'> & { key: string; group: string }

function PaletteItem({ item, onAdd }: { item: Src; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: 'src:' + item.key, data: item })
  return (
    <div ref={setNodeRef} style={transform ? { transform: `translate(${transform.x}px,${transform.y}px)`, zIndex: 50 } : undefined} className={cx('flex items-center gap-2 rounded-lg border border-line bg-panel p-2 text-xs', isDragging && 'shadow-glow')}>
      <span {...listeners} {...attributes} className="cursor-grab text-muted active:cursor-grabbing"><GripVertical size={14} /></span>
      <span className="flex-1">{item.description}<div className="text-muted">{item.qty} × {money(item.rate, true)}</div></span>
      <button onClick={onAdd} className="rounded p-1 text-accent hover:bg-accent/10" aria-label="Add"><Plus size={14} /></button>
    </div>
  )
}

function Row({ l, onChange, onRemove }: { l: InvoiceLine; onChange: (p: Partial<InvoiceLine>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: l.id })
  return (
    <div ref={setNodeRef} style={{ transform: transform ? `translate(0,${transform.y}px)` : undefined, transition }} className="flex items-center gap-2 rounded-lg border border-line bg-panel p-2">
      <span {...listeners} {...attributes} className="cursor-grab text-muted"><GripVertical size={15} /></span>
      <input className="input flex-1 py-1.5" value={l.description} onChange={(e) => onChange({ description: e.target.value })} />
      <input type="number" step="0.25" className="input w-20 py-1.5" value={l.qty} onChange={(e) => onChange({ qty: +e.target.value })} />
      <input type="number" step="0.01" className="input w-24 py-1.5" value={l.rate} onChange={(e) => onChange({ rate: +e.target.value })} />
      <span className="w-24 text-right text-sm font-medium">{money(l.qty * l.rate, true)}</span>
      {l.source && l.source !== 'manual' && <Badge tone="info" className="hidden sm:inline-flex">{l.source}</Badge>}
      <button onClick={onRemove} className="text-muted hover:text-bad"><Trash2 size={14} /></button>
    </div>
  )
}

function DropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'invoice' })
  return <div ref={setNodeRef} className={cx('min-h-[160px] space-y-2 rounded-xl border-2 border-dashed p-2 transition', isOver ? 'border-accent bg-accent/5' : 'border-line')}>{children}</div>
}

export default function InvoiceBuilder({ initialClient }: { initialClient?: string }) {
  const s = useStore()
  const [clientId, setClientId] = useState(initialClient || s.clients.find((c) => c.status === 'active')?.id || s.clients[0]?.id || '')
  const client = s.clients.find((c) => c.id === clientId)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [recurring, setRecurring] = useState<Invoice['recurring'] | ''>('monthly')
  const [taxRate, setTaxRate] = useState(0)
  const [due, setDue] = useState(isoDate(addDays(new Date(), s.company.paymentTermsDays)))
  const [desc, setDesc] = useState('Managed IT services, cybersecurity monitoring (Huntress), network management and related labor.')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const palette: Src[] = useMemo(() => {
    if (!client) return []
    const out: Src[] = []
    const latestProp = s.proposals.find((p) => p.clientId === clientId && p.status === 'accepted' && p.selected !== undefined)
    if (latestProp) latestProp.options[latestProp.selected!].lineItems.filter((l) => l.recurring).forEach((l) => out.push({ key: 'sla' + l.sku, group: 'SLA services', description: l.description, qty: l.qty, rate: l.unitPrice, source: 'sla' }))
    else out.push({ key: 'sla-base', group: 'SLA services', description: `Managed IT — ${client.slaTier} (monthly agreement)`, qty: 1, rate: client.mrr, source: 'sla' })
    s.tickets.filter((t) => t.clientId === clientId && t.billable && !t.invoiced).forEach((t) => out.push({ key: 'tk' + t.id, group: 'Billable tickets', description: `Ticket #${t.number}: ${t.title}`, qty: t.hours, rate: s.company.laborRate, source: 'ticket', refId: t.id }))
    s.projects.filter((p) => p.clientId === clientId && p.billableHours > 0).forEach((p) => out.push({ key: 'pj' + p.id, group: 'Project hours', description: `Project: ${p.name}`, qty: p.billableHours, rate: s.company.laborRate, source: 'project', refId: p.id }))
    s.purchaseOrders.filter((po) => po.clientId === clientId).forEach((po) => po.items.forEach((it) => out.push({ key: 'po' + po.id + it.sku, group: 'Hardware (procurement)', description: `${it.name} (${po.number})`, qty: it.qty, rate: it.price, source: 'hardware', refId: po.id })))
    s.inventory.filter((i) => i.assignedClientId === clientId).forEach((it) => out.push({ key: 'inv' + it.id, group: 'Hardware (inventory)', description: it.name, qty: 1, rate: it.price, source: 'hardware', refId: it.id }))
    return out
  }, [client, clientId, s.proposals, s.tickets, s.projects, s.purchaseOrders, s.inventory, s.company.laborRate])

  const addSrc = (x: Src) => setLines((ls) => [...ls, { id: uid('il'), description: x.description, qty: x.qty, rate: x.rate, source: x.source, refId: x.refId }])
  const onDragEnd = (e: DragEndEvent) => {
    const a = String(e.active.id)
    if (a.startsWith('src:')) { if (e.over) addSrc(e.active.data.current as Src); return }
    if (e.over && a !== e.over.id) setLines((ls) => arrayMove(ls, ls.findIndex((l) => l.id === a), ls.findIndex((l) => l.id === e.over!.id)))
  }

  const draft: Invoice = { id: uid('inv'), number: `INV-${1100 + s.invoices.length + 1}`, clientId, issueDate: isoDate(), dueDate: due, lines, status: 'draft', recurring: recurring || undefined, lastServiceDate: isoDate(), workDescription: desc, taxRate }
  const sub = lines.reduce((a, l) => a + l.qty * l.rate, 0)

  const save = async (send: boolean) => {
    if (!client || !lines.length) return toast('Add at least one line item', 'warn')
    const inv = { ...draft, status: send ? ('sent' as const) : ('draft' as const) }
    s.add('invoices', inv)
    lines.filter((l) => l.source === 'ticket' && l.refId).forEach((l) => s.update('tickets', l.refId!, { invoiced: true }))
    s.log(`${send ? 'Sent' : 'Saved'} invoice ${inv.number} to ${client.name}`)
    if (send) {
      const r = await api('email/invoice', { invoice: inv, to: client.primaryContact.email })
      toast(r.ok ? `Invoice emailed to ${client.primaryContact.email}` : `Invoice ${inv.number} saved as sent (connect Email + QuickBooks to deliver automatically)`, r.ok ? 'ok' : 'warn')
    } else toast('Draft saved')
    setLines([])
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Auto-fill (drag onto the invoice)" help="Everything billable for this client shows here: SLA services from their agreement, billable tickets, project hours, and hardware from procurement/inventory. Drag an item onto the invoice or click +.">
          <Field label="Client"><select className="input mb-3" value={clientId} onChange={(e) => { setClientId(e.target.value); setLines([]) }}>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <button className="btn-ghost mb-3 w-full text-xs" onClick={() => palette.forEach(addSrc)}>Add everything</button>
          {Array.from(new Set(palette.map((p) => p.group))).map((g) => (
            <div key={g} className="mb-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">{g}</div>
              <div className="space-y-1.5">{palette.filter((p) => p.group === g).map((p) => <PaletteItem key={p.key} item={p} onAdd={() => addSrc(p)} />)}</div>
            </div>
          ))}
        </Card>
        <Card title={`Invoice ${draft.number}`} className="xl:col-span-2" action={<div className="flex gap-2"><button className="btn-ghost" disabled={!client || !lines.length} onClick={() => client && invoicePdf(draft, client, s.company)}><Download size={15} /> PDF</button><button className="btn-ghost" onClick={() => save(false)}><Save size={15} /> Save draft</button><button className="btn-primary" onClick={() => save(true)}><Send size={15} /> Send</button></div>}>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <Field label="Due date"><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
            <Field label="Tax %"><input type="number" className="input" value={taxRate} onChange={(e) => setTaxRate(+e.target.value)} /></Field>
            <Field label="Recurring"><div className="flex items-center gap-2"><Toggle checked={!!recurring} onChange={(v) => setRecurring(v ? 'monthly' : '')} />{recurring && <select className="input py-1.5" value={recurring} onChange={(e) => setRecurring(e.target.value as Invoice['recurring'])}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select>}{recurring && <Repeat size={14} className="text-accent" />}</div></Field>
          </div>
          <div className="mb-1 hidden gap-2 px-2 text-[10px] uppercase tracking-widest text-muted sm:flex"><span className="w-4" /><span className="flex-1">Description</span><span className="w-20">Qty</span><span className="w-24">Rate</span><span className="w-24 text-right">Amount</span><span className="w-20" /></div>
          <DropZone>
            <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {lines.map((l) => <Row key={l.id} l={l} onChange={(p) => setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, ...p } : x)))} onRemove={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} />)}
            </SortableContext>
            {lines.length === 0 && <div className="grid h-36 place-items-center text-sm text-muted">Drag items here, or click + on the left</div>}
          </DropZone>
          <button className="btn-ghost mt-2 text-xs" onClick={() => setLines((ls) => [...ls, { id: uid('il'), description: 'Custom item', qty: 1, rate: 0, source: 'manual' }])}><Plus size={13} /> Custom line</button>
          <Field label="Description of work (used on notices if unpaid)" className="mt-3"><textarea className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <div className="mt-3 ml-auto w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted">Subtotal</span>{money(sub, true)}</div>
            <div className="flex justify-between"><span className="text-muted">Tax</span>{money(sub * taxRate / 100, true)}</div>
            <div className="flex justify-between border-t border-line pt-1 h-display text-lg"><span>Total</span>{money(invoiceTotal(draft), true)}</div>
          </div>
        </Card>
      </div>
    </DndContext>
  )
}
