// Procurement: vendor catalogs, quote builder with margin calculator, purchase orders & order tracking.
// Receiving an order auto-adds stock to Inventory and a vendor bill to Finance (→ QuickBooks).
import { useState } from 'react'
import { Truck, Plus, PackageCheck, Calculator, Trash2 } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import type { PurchaseOrder } from '../lib/types'
import { Badge, Card, Field, PageHeader, Tabs, toast } from '../components/ui'
import { fmtDate, money, sum, uid, iso, isoDate, addDays } from '../lib/format'

const VENDORS: Record<string, { sku: string; name: string; cost: number }[]> = {
  'Ubiquiti (via distributor)': [{ sku: 'UCG-FIBER', name: 'UniFi Cloud Gateway Fiber', cost: 279 }, { sku: 'U7-PRO', name: 'UniFi U7 Pro Access Point', cost: 189 }, { sku: 'USW-PRO-24-POE', name: 'UniFi Switch Pro 24 PoE', cost: 599 }, { sku: 'U5G-MAX', name: 'UniFi 5G Max (LTE failover)', cost: 349 }],
  'Dell Technologies': [{ sku: 'DELL-LAT-7450', name: 'Dell Latitude 7450 (i7/16GB/512GB)', cost: 1180 }, { sku: 'DELL-OPT-7020', name: 'Dell OptiPlex 7020 Micro', cost: 780 }, { sku: 'DELL-P2425', name: 'Dell 24" monitor P2425', cost: 165 }, { sku: 'DELL-WD22TB4', name: 'Dell Thunderbolt Dock WD22TB4', cost: 229 }],
  'HP Inc.': [{ sku: 'HP-M507', name: 'HP LaserJet Enterprise M507dn', cost: 520 }, { sku: 'HP-CF289A', name: 'HP 89A black toner', cost: 145 }, { sku: 'HP-EB840', name: 'HP EliteBook 840 G11', cost: 1090 }],
  'Cisco / Meraki': [{ sku: 'MR36', name: 'Meraki MR36 AP', cost: 520 }, { sku: 'MX68', name: 'Meraki MX68 security appliance', cost: 610 }],
  'CDW': [{ sku: 'CAT6-1000', name: 'Cat6 plenum cable 1000ft', cost: 165 }, { sku: 'APC-1500', name: 'APC Smart-UPS 1500VA', cost: 489 }, { sku: 'BRO-TN920', name: 'Brother TN920 toner', cost: 78 }],
  'Pax8 (licenses)': [{ sku: 'M365-BP', name: 'Microsoft 365 Business Premium (annual, per user)', cost: 264 }, { sku: 'M365-BS', name: 'Microsoft 365 Business Standard (annual, per user)', cost: 150 }],
}
const STATUSES: PurchaseOrder['status'][] = ['draft', 'pending_approval', 'ordered', 'shipped', 'received', 'backordered']
type Tab = 'orders' | 'quote' | 'catalogs'

export default function Procurement() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('orders')
  const [vendor, setVendor] = useState(Object.keys(VENDORS)[0])
  const [clientId, setClientId] = useState('')
  const [markup, setMarkup] = useState(25)
  const [laborHrs, setLaborHrs] = useState(2)
  const [items, setItems] = useState<{ sku: string; name: string; qty: number; cost: number }[]>([])

  const cost = sum(items, (i) => i.qty * i.cost)
  const price = cost * (1 + markup / 100)
  const labor = laborHrs * s.company.laborRate
  const tax = price * (s.company.taxRate / 100)
  const margin = price - cost + labor

  const createPO = () => {
    if (!items.length) return toast('Add items first', 'warn')
    const po: PurchaseOrder = { id: uid('po'), number: `PO-${2040 + s.purchaseOrders.length + 1}`, vendor, clientId: clientId || undefined, items: items.map((i) => ({ ...i, price: Math.round(i.cost * (1 + markup / 100)) })), status: 'pending_approval', createdAt: iso() }
    s.add('purchaseOrders', po)
    s.log(`Created ${po.number} (${vendor})`)
    setItems([]); setTab('orders'); toast(`${po.number} created — awaiting approval`)
  }

  const setStatus = (po: PurchaseOrder, status: PurchaseOrder['status']) => {
    s.update('purchaseOrders', po.id, { status, eta: status === 'ordered' ? isoDate(addDays(new Date(), 5)) : po.eta })
    if (status === 'received') {
      po.items.forEach((it) => {
        const ex = s.inventory.find((i) => i.sku === it.sku)
        if (ex) s.update('inventory', ex.id, { qty: ex.qty + it.qty, receivedAt: isoDate() })
        else s.add('inventory', { id: uid('i'), sku: it.sku, name: it.name, category: 'Network', qty: it.qty, reorderAt: 1, cost: it.cost, price: it.price, location: 'Receiving', warrantyMonths: 12, receivedAt: isoDate(), assignedClientId: po.clientId })
      })
      s.add('expenses', { id: uid('x'), date: isoDate(), vendor: po.vendor, category: 'Inventory purchases', amount: sum(po.items, (i) => i.qty * i.cost), status: 'unpaid', dueDate: isoDate(addDays(new Date(), 30)) })
      s.log(`Received ${po.number}; inventory and vendor bill updated`)
      toast('Received: inventory updated and vendor bill created')
    }
  }

  return (
    <div>
      <PageHeader title="Procurement" subtitle="Quote, order, track, receive — synced to inventory and QuickBooks" help="Build a quote from vendor catalogs, see your profit instantly, create a purchase order, and track it. When you mark it Received, stock goes into Inventory and the vendor bill goes to Finance." />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'orders', label: 'Order tracker', count: s.purchaseOrders.filter((p) => p.status !== 'received').length }, { id: 'quote', label: 'Quote builder' }, { id: 'catalogs', label: 'Vendor catalogs' }]} />
      {tab === 'orders' && (
        <Card>
          <div className="overflow-x-auto"><table className="table-base">
            <thead><tr><th>PO</th><th>Vendor</th><th>Client</th><th>Items</th><th>Cost</th><th>Sell</th><th>ETA</th><th>Status</th></tr></thead>
            <tbody>{s.purchaseOrders.map((po) => (
              <tr key={po.id}>
                <td className="font-medium">{po.number}<div className="text-xs text-muted">{fmtDate(po.createdAt)}</div></td><td>{po.vendor}</td><td>{po.clientId ? clientName(po.clientId) : 'Stock'}</td>
                <td className="text-xs">{po.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</td>
                <td>{money(sum(po.items, (i) => i.qty * i.cost))}</td><td>{money(sum(po.items, (i) => i.qty * i.price))}</td>
                <td>{fmtDate(po.eta)}{po.tracking && <div className="font-mono text-[10px] text-muted">{po.tracking}</div>}</td>
                <td><select className="input py-1 text-xs" value={po.status} onChange={(e) => setStatus(po, e.target.value as PurchaseOrder['status'])}>{STATUSES.map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select></td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
      {tab === 'quote' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Build a quote" className="xl:col-span-2">
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <Field label="Vendor"><select className="input" value={vendor} onChange={(e) => setVendor(e.target.value)}>{Object.keys(VENDORS).map((v) => <option key={v}>{v}</option>)}</select></Field>
              <Field label="For client"><select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Stock (no client)</option>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">{VENDORS[vendor].map((v) => <button key={v.sku} className="btn-ghost text-xs" onClick={() => setItems((x) => [...x, { ...v, qty: 1 }])}><Plus size={12} />{v.name} · {money(v.cost)}</button>)}</div>
            {items.map((it, k) => (
              <div key={k} className="mb-2 flex items-center gap-2 rounded-lg border border-line p-2 text-sm">
                <span className="flex-1">{it.name}</span>
                <input type="number" className="input w-16 py-1" value={it.qty} onChange={(e) => setItems((x) => x.map((y, j) => (j === k ? { ...y, qty: +e.target.value } : y)))} />
                <span className="w-24 text-right">{money(it.qty * it.cost)}</span>
                <button onClick={() => setItems((x) => x.filter((_, j) => j !== k))} className="text-muted hover:text-bad"><Trash2 size={14} /></button>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted">Click catalog items above to add them.</p>}
            <button className="btn-primary mt-3" onClick={createPO}><Truck size={15} /> Create purchase order</button>
          </Card>
          <Card title="Budget & margin calculator" icon={<Calculator size={16} />}>
            <Field label={`Markup: ${markup}%`}><input type="range" min={0} max={60} value={markup} onChange={(e) => setMarkup(+e.target.value)} className="w-full accent-[rgb(var(--accent))]" /></Field>
            <Field label="Install labor (hours)" className="mt-2"><input type="number" className="input" value={laborHrs} onChange={(e) => setLaborHrs(+e.target.value)} /></Field>
            <dl className="mt-4 space-y-1.5 text-sm">
              {[['Your cost', cost], ['Client price (hardware)', price], [`Labor (${laborHrs}h × ${money(s.company.laborRate)})`, labor], [`Sales tax (${s.company.taxRate}%)`, tax], ['Client total', price + labor + tax]].map(([k, v]) => <div key={k as string} className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{money(v as number, true)}</dd></div>)}
              <div className="flex justify-between border-t border-line pt-2 h-display text-lg text-ok"><dt>Your profit</dt><dd>{money(margin, true)}</dd></div>
              <div className="text-right text-xs text-muted">{Math.round((margin / Math.max(1, price + labor)) * 100)}% margin</div>
            </dl>
          </Card>
        </div>
      )}
      {tab === 'catalogs' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(VENDORS).map(([v, list]) => (
            <Card key={v} title={v} icon={<PackageCheck size={16} />}>
              {list.map((i) => <div key={i.sku} className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span>{i.name}<div className="font-mono text-[10px] text-muted">{i.sku}</div></span><Badge>{money(i.cost)}</Badge></div>)}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
