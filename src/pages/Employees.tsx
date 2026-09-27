// Employees & Payroll console: pay periods, employees/contractors, hours, PTO, direct deposit, compliance alerts.
import { useState } from 'react'
import { UserPlus, CalendarDays, Play, ShieldAlert, BadgeCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Employee } from '../lib/types'
import { Badge, Card, Field, Modal, PageHeader, Stat, toast } from '../components/ui'
import { fmtDate, money, sum, uid, isoDate, daysUntil } from '../lib/format'
import { api } from '../lib/api'

const period = () => {
  const d = new Date()
  const start = d.getDate() <= 15 ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(d.getFullYear(), d.getMonth(), 16)
  const end = d.getDate() <= 15 ? new Date(d.getFullYear(), d.getMonth(), 15) : new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start, end, payday: new Date(end.getTime() + 2 * 86400000) }
}

export default function Employees() {
  const s = useStore()
  const [add, setAdd] = useState(false)
  const p = period()
  const gross = (e: Employee) => (e.type === 'W2' && e.rate === 0 ? 0 : e.rate * e.hoursThisPeriod + (e.type === 'W2' ? Math.max(0, e.hoursThisPeriod - 80) * e.rate * 0.5 : 0))
  const total = sum(s.employees, gross)
  const alerts = [
    ...s.employees.filter((e) => e.type === 'W2' && !e.i9OnFile).map((e) => `${e.name}: Form I-9 missing (due within 3 days of hire)`),
    ...s.employees.filter((e) => e.type === 'W2' && !e.w4OnFile).map((e) => `${e.name}: Form W-4 missing`),
    ...s.employees.filter((e) => e.directDeposit === 'pending').map((e) => `${e.name}: direct deposit pending verification — will receive a paper check`),
    ...s.employees.filter((e) => e.type === '1099').length ? [`Collect Form W-9 from all 1099 contractors; 1099-NEC filings due January 31`] : [],
    ...s.employees.filter((e) => e.type === 'W2' && e.hoursThisPeriod > 80).map((e) => `${e.name}: ${e.hoursThisPeriod - 80}h overtime this period (paid at 1.5x)`),
  ]

  const run = async () => {
    const r = await api('payroll/run', { periodStart: isoDate(p.start), periodEnd: isoDate(p.end) })
    s.add('expenses', { id: uid('x'), date: isoDate(), vendor: 'Payroll', category: 'Payroll: wages', amount: Math.round(total), status: 'paid' })
    s.log(`Ran payroll for ${fmtDate(p.start.toISOString())}–${fmtDate(p.end.toISOString())}`)
    toast(r.ok ? 'Payroll submitted to your payroll provider' : `Payroll of ${money(total)} recorded (connect Gusto / QuickBooks Payroll to pay automatically)`, r.ok ? 'ok' : 'warn')
  }

  return (
    <div>
      <PageHeader title="Employees & Payroll" subtitle={`Pay period ${fmtDate(p.start.toISOString())} – ${fmtDate(p.end.toISOString())} · payday ${fmtDate(p.payday.toISOString())}`}
        actions={<><button className="btn-ghost" onClick={() => setAdd(true)}><UserPlus size={15} /> Add person</button><button className="btn-primary" onClick={run}><Play size={15} /> Run payroll</button></>}
        help="Hours flow in from ticket and project time. Review, then click Run payroll — the payroll provider (Gusto or QuickBooks Payroll) handles taxes and direct deposit." />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Gross this period" value={money(total)} icon={<CalendarDays size={16} />} />
        <Stat label="Payday in" value={`${daysUntil(p.payday.toISOString())} days`} />
        <Stat label="W-2 / 1099" value={`${s.employees.filter((e) => e.type === 'W2').length} / ${s.employees.filter((e) => e.type === '1099').length}`} />
        <Stat label="Compliance alerts" value={alerts.length} tone={alerts.length ? 'warn' : 'ok'} icon={<ShieldAlert size={16} />} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Team" className="xl:col-span-2">
          <div className="overflow-x-auto"><table className="table-base">
            <thead><tr><th>Name</th><th>Type</th><th>Rate</th><th>Hours</th><th>PTO (h)</th><th>Gross</th><th>Direct deposit</th><th>App role</th></tr></thead>
            <tbody>{s.employees.map((e) => (
              <tr key={e.id}>
                <td><div className="font-medium">{e.name}</div><div className="text-xs text-muted">{e.role} · {e.certifications.join(', ')}</div></td>
                <td><Badge tone={e.type === 'W2' ? 'info' : 'violet'}>{e.type}</Badge></td>
                <td>{e.rate ? `${money(e.rate, true)}/h` : 'Owner draw'}</td>
                <td><input type="number" className="input w-20 py-1" value={e.hoursThisPeriod} onChange={(x) => s.update('employees', e.id, { hoursThisPeriod: +x.target.value })} /></td>
                <td>{e.type === 'W2' ? e.ptoBalance : '—'}</td>
                <td>{money(gross(e), true)}</td>
                <td><Badge tone={e.directDeposit === 'active' ? 'ok' : e.directDeposit === 'pending' ? 'warn' : 'muted'}>{e.directDeposit}</Badge></td>
                <td className="capitalize">{e.appRole}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
        <Card title="Compliance alerts" icon={<ShieldAlert size={16} />}>
          {alerts.length === 0 ? <p className="flex items-center gap-2 text-sm text-ok"><BadgeCheck size={16} /> All clear.</p> : <ul className="space-y-2 text-sm">{alerts.map((a) => <li key={a} className="rounded-lg bg-warn/10 p-2 text-warn">{a}</li>)}</ul>}
        </Card>
      </div>
      {add && <AddPerson onClose={() => setAdd(false)} />}
    </div>
  )
}

function AddPerson({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [e, setE] = useState<Employee>({ id: uid('e'), name: '', email: '', role: 'Technician', appRole: 'technician', type: 'W2', rate: 25, hoursThisPeriod: 0, ptoBalance: 0, directDeposit: 'none', startDate: isoDate(), certifications: [], w4OnFile: false, i9OnFile: false })
  return (
    <Modal open onClose={onClose} title="Add employee or contractor" footer={<button className="btn-primary" disabled={!e.name} onClick={() => { s.add('employees', e); s.log(`Added ${e.name}`); onClose(); toast('Added — invite email sent') }}>Save</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
        <Field label="Email"><input className="input" value={e.email} onChange={(x) => setE({ ...e, email: x.target.value })} /></Field>
        <Field label="Job title"><input className="input" value={e.role} onChange={(x) => setE({ ...e, role: x.target.value })} /></Field>
        <Field label="Worker type"><select className="input" value={e.type} onChange={(x) => setE({ ...e, type: x.target.value as Employee['type'] })}><option value="W2">W-2 employee</option><option value="1099">1099 contractor</option></select></Field>
        <Field label="Hourly rate"><input type="number" className="input" value={e.rate} onChange={(x) => setE({ ...e, rate: +x.target.value })} /></Field>
        <Field label="App access"><select className="input" value={e.appRole} onChange={(x) => setE({ ...e, appRole: x.target.value as Employee['appRole'] })}>{['admin', 'technician', 'finance'].map((r) => <option key={r}>{r}</option>)}</select></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={e.w4OnFile} onChange={(x) => setE({ ...e, w4OnFile: x.target.checked })} /> W-4 / W-9 on file</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={e.i9OnFile} onChange={(x) => setE({ ...e, i9OnFile: x.target.checked })} /> I-9 on file</label>
      </div>
    </Modal>
  )
}
