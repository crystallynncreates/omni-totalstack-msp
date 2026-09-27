// Inventory: stock levels, aging hardware, warranty, client assignment (feeds invoices), QR labels.
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Plus, QrCode, AlertTriangle, Printer } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import type { InventoryItem } from '../lib/types'
import { Badge, Card, Field, Modal, PageHeader, Stat, toast, cx } from '../components/ui'
import { daysSince, money, sum, uid, isoDate } from '../lib/format'

export default function Inventory() {
  const s = useStore()
  const [add, setAdd] = useState(false)
  const [qr, setQr] = useState<InventoryItem | null>(null)
  const [q, setQ] = useState('')
  const items = s.inventory.filter((i) => (i.name + i.sku + i.category).toLowerCase().includes(q.toLowerCase()))
  const low = s.inventory.filter((i) => i.qty <= i.reorderAt)
  const aging = s.inventory.filter((i) => daysSince(i.receivedAt) > 180 && i.qty > 0)

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock, warranties and client-assigned assets" actions={<button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> Add item</button>}
        help="Stock updates automatically when purchase orders are received. Assign an item to a client and it shows up in the invoice builder under Hardware. Print QR labels to scan items into jobs." />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Inventory value (cost)" value={money(sum(s.inventory, (i) => i.qty * i.cost))} />
        <Stat label="Retail value" value={money(sum(s.inventory, (i) => i.qty * i.price))} />
        <Stat label="Low stock" value={low.length} tone={low.length ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
        <Stat label="Aging (>180 days)" value={aging.length} tone={aging.length ? 'warn' : 'ok'} />
      </div>
      <Card action={<input className="input w-56 py-1.5" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />} title="Stock">
        <div className="overflow-x-auto"><table className="table-base">
          <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Reorder at</th><th>Cost</th><th>Price</th><th>Location</th><th>Age</th><th>Assigned to</th><th /></tr></thead>
          <tbody>{items.map((i) => (
            <tr key={i.id}>
              <td><div className="font-medium">{i.name}</div><div className="font-mono text-[10px] text-muted">{i.sku}{i.serial && ` · SN ${i.serial}`}</div></td>
              <td>{i.category}</td>
              <td><input type="number" className={cx('input w-16 py-1', i.qty <= i.reorderAt && 'border-warn text-warn')} value={i.qty} onChange={(e) => s.update('inventory', i.id, { qty: +e.target.value })} /></td>
              <td>{i.reorderAt}</td><td>{money(i.cost)}</td><td>{money(i.price)}</td><td>{i.location}</td>
              <td className={cx(daysSince(i.receivedAt) > 180 && 'text-warn')}>{daysSince(i.receivedAt)}d</td>
              <td><select className="input py-1 text-xs" value={i.assignedClientId ?? ''} onChange={(e) => { s.update('inventory', i.id, { assignedClientId: e.target.value || undefined }); if (e.target.value) toast(`Assigned to ${clientName(e.target.value)} — available in invoice builder`) }}><option value="">In stock</option>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
              <td className="text-right">{i.qty <= i.reorderAt && <Badge tone="warn">reorder</Badge>}<button className="ml-1 rounded p-1.5 text-muted hover:text-accent" onClick={() => setQr(i)} aria-label="QR label"><QrCode size={15} /></button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {add && <AddItem onClose={() => setAdd(false)} />}
      {qr && <QrLabel item={qr} onClose={() => setQr(null)} />}
    </div>
  )
}

function QrLabel({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [src, setSrc] = useState('')
  useEffect(() => { QRCode.toDataURL(JSON.stringify({ sku: item.sku, id: item.id }), { margin: 1, width: 220 }).then(setSrc) }, [item])
  const print = () => {
    const w = window.open('', '_blank', 'width=400,height=400')
    if (!w) return
    w.document.write(`<div style="font-family:Arial;text-align:center;padding:12px"><img src="${src}" width="160"/><div style="font-weight:bold">${item.name}</div><div style="font-family:monospace">${item.sku}</div></div><script>onload=()=>print()<\/script>`)
  }
  return (
    <Modal open onClose={onClose} title="QR label" footer={<button className="btn-primary" onClick={print}><Printer size={15} /> Print label</button>}>
      <div className="flex flex-col items-center gap-2 text-center">{src && <img src={src} alt="QR code" className="rounded-lg bg-white p-2" />}<div className="font-semibold">{item.name}</div><div className="font-mono text-xs text-muted">{item.sku}</div></div>
    </Modal>
  )
}

function AddItem({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [i, setI] = useState<InventoryItem>({ id: uid('i'), sku: '', name: '', category: 'Computer', qty: 1, reorderAt: 1, cost: 0, price: 0, location: '', warrantyMonths: 12, receivedAt: isoDate() })
  return (
    <Modal open onClose={onClose} title="Add inventory item" footer={<button className="btn-primary" disabled={!i.name} onClick={() => { s.add('inventory', i); onClose() }}>Save</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><input className="input" value={i.name} onChange={(e) => setI({ ...i, name: e.target.value })} /></Field>
        <Field label="SKU"><input className="input" value={i.sku} onChange={(e) => setI({ ...i, sku: e.target.value })} /></Field>
        <Field label="Serial #"><input className="input" value={i.serial ?? ''} onChange={(e) => setI({ ...i, serial: e.target.value })} /></Field>
        <Field label="Category"><select className="input" value={i.category} onChange={(e) => setI({ ...i, category: e.target.value as InventoryItem['category'] })}>{['Network', 'Computer', 'Peripheral', 'Printer', 'Consumable', 'License', 'Cable'].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Location"><input className="input" value={i.location} onChange={(e) => setI({ ...i, location: e.target.value })} /></Field>
        <Field label="Quantity"><input type="number" className="input" value={i.qty} onChange={(e) => setI({ ...i, qty: +e.target.value })} /></Field>
        <Field label="Reorder when at or below"><input type="number" className="input" value={i.reorderAt} onChange={(e) => setI({ ...i, reorderAt: +e.target.value })} /></Field>
        <Field label="Cost"><input type="number" className="input" value={i.cost} onChange={(e) => setI({ ...i, cost: +e.target.value })} /></Field>
        <Field label="Sell price"><input type="number" className="input" value={i.price} onChange={(e) => setI({ ...i, price: +e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
