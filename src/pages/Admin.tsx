// Admin: branding, billing rules & pricing, users & roles, SLA templates, audit log, release notes, workspace data.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, Download, RotateCcw, Trash2, Play } from 'lucide-react'
import { useStore, APP_VERSION } from '../lib/store'
import { CATALOG } from '../lib/proposalEngine'
import { releases } from '../lib/seed'
import { Badge, Card, Field, PageHeader, Tabs, toast, cx } from '../components/ui'
import { download, fmtDateTime, money } from '../lib/format'

type Tab = 'company' | 'pricing' | 'roles' | 'sla' | 'audit' | 'releases' | 'workspace'
const PERMS: [string, Record<string, boolean>][] = [
  ['Clients & documents', { owner: true, admin: true, technician: true, finance: true }],
  ['Proposals & RFS', { owner: true, admin: true, technician: false, finance: true }],
  ['Finance & payroll', { owner: true, admin: false, technician: false, finance: true }],
  ['Infrastructure, patching, discovery', { owner: true, admin: true, technician: true, finance: false }],
  ['Integrations & API keys', { owner: true, admin: true, technician: false, finance: false }],
  ['Admin & audit log', { owner: true, admin: true, technician: false, finance: false }],
]

export default function Admin() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('company')
  const c = s.company
  const onLogo = (f?: File) => { if (!f) return; const r = new FileReader(); r.onload = () => s.setCompany({ logoDataUrl: String(r.result) }); r.readAsDataURL(f) }

  const exportData = () => { const { add, update, remove, setCompany, setUI, setIntegration, log, notify, resetDemo, startFresh, ...data } = s; void add; void update; void remove; void setCompany; void setUI; void setIntegration; void log; void notify; void resetDemo; void startFresh; download(`omni-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2)) }
  const importData = (f?: File) => f?.text().then((t) => { try { useStore.setState(JSON.parse(t)); toast('Backup restored') } catch { toast('Invalid backup file', 'bad') } })

  return (
    <div>
      <PageHeader title="Admin" subtitle={`Omni TotalStack MSP v${APP_VERSION}`} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'company', label: 'Company & branding' }, { id: 'pricing', label: 'Billing rules & pricing' }, { id: 'roles', label: 'Users & roles' }, { id: 'sla', label: 'SLA templates' }, { id: 'audit', label: 'Audit log' }, { id: 'releases', label: 'Release notes' }, { id: 'workspace', label: 'Workspace' }]} />
      {tab === 'company' && (
        <Card>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="MSP name"><input className="input" value={c.name} onChange={(e) => s.setCompany({ name: e.target.value })} /></Field>
            <Field label="Legal name"><input className="input" value={c.legalName} onChange={(e) => s.setCompany({ legalName: e.target.value })} /></Field>
            <Field label="Website"><input className="input" value={c.website} onChange={(e) => s.setCompany({ website: e.target.value })} /></Field>
            <Field label="Address" className="md:col-span-2"><input className="input" value={c.address} onChange={(e) => s.setCompany({ address: e.target.value })} /></Field>
            <Field label="City"><input className="input" value={c.city} onChange={(e) => s.setCompany({ city: e.target.value })} /></Field>
            <Field label="State"><input className="input" value={c.state} onChange={(e) => s.setCompany({ state: e.target.value })} /></Field>
            <Field label="ZIP"><input className="input" value={c.zip} onChange={(e) => s.setCompany({ zip: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={c.phone} onChange={(e) => s.setCompany({ phone: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={c.email} onChange={(e) => s.setCompany({ email: e.target.value })} /></Field>
            <Field label="Huntress partner portal"><input className="input" value={c.huntressPortalUrl} onChange={(e) => s.setCompany({ huntressPortalUrl: e.target.value })} /></Field>
            <Field label="Logo"><label className="btn-ghost w-full cursor-pointer"><Upload size={14} /> Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} /></label></Field>
            <Field label="Accent"><div className="flex gap-2">{(['blue', 'purple', 'gold'] as const).map((a) => <button key={a} onClick={() => s.setCompany({ accent: a })} className={cx('chip border px-3 py-1.5 capitalize', c.accent === a ? 'border-accent text-accent' : 'border-line text-muted')}>{a}</button>)}</div></Field>
            <Field label="Theme"><div className="flex gap-2">{(['dark', 'light'] as const).map((t) => <button key={t} onClick={() => s.setUI({ theme: t })} className={cx('chip border px-3 py-1.5 capitalize', s.ui.theme === t ? 'border-accent text-accent' : 'border-line text-muted')}>{t}</button>)}</div></Field>
          </div>
        </Card>
      )}
      {tab === 'pricing' && (
        <div className="space-y-4">
          <Card title="Billing rules">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Labor rate ($/h)"><input type="number" className="input" value={c.laborRate} onChange={(e) => s.setCompany({ laborRate: +e.target.value })} /></Field>
              <Field label="After-hours ($/h)"><input type="number" className="input" value={c.afterHoursRate} onChange={(e) => s.setCompany({ afterHoursRate: +e.target.value })} /></Field>
              <Field label="Payment terms (days)"><input type="number" className="input" value={c.paymentTermsDays} onChange={(e) => s.setCompany({ paymentTermsDays: +e.target.value })} /></Field>
              <Field label="Sales tax %"><input type="number" className="input" value={c.taxRate} onChange={(e) => s.setCompany({ taxRate: +e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Service catalog (used by the proposal engine)" help="Edit prices in src/lib/proposalEngine.ts (or the price_catalog table once Supabase is connected). Items marked Huntress are mandatory in every proposal.">
            <table className="table-base"><thead><tr><th>SKU</th><th>Item</th><th>Category</th><th>Price</th><th>Unit</th><th>Billing</th></tr></thead>
              <tbody>{Object.values(CATALOG).map((i) => <tr key={i.sku}><td className="font-mono text-xs">{i.sku}</td><td>{i.name}{i.sku.startsWith('HUN') && <Badge tone="violet" className="ml-2">required</Badge>}</td><td>{i.category}</td><td>{money(i.price)}</td><td>{i.unit}</td><td>{i.recurring ? 'Monthly' : 'One-time'}</td></tr>)}</tbody></table>
          </Card>
        </div>
      )}
      {tab === 'roles' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Permissions by role"><table className="table-base"><thead><tr><th>Area</th>{['owner', 'admin', 'technician', 'finance'].map((r) => <th key={r} className="capitalize">{r}</th>)}</tr></thead><tbody>{PERMS.map(([area, p]) => <tr key={area}><td>{area}</td>{['owner', 'admin', 'technician', 'finance'].map((r) => <td key={r}>{p[r] ? '✓' : '—'}</td>)}</tr>)}</tbody></table><p className="mt-2 text-xs text-muted">Clients get read-only access to their own portal (tickets, invoices, payments, projects, documents).</p></Card>
          <Card title="Team members"><table className="table-base"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{s.employees.map((e) => <tr key={e.id}><td>{e.name}</td><td className="text-xs">{e.email}</td><td><select className="input py-1 text-xs" value={e.appRole} onChange={(x) => s.update('employees', e.id, { appRole: x.target.value as typeof e.appRole })}>{['owner', 'admin', 'technician', 'finance'].map((r) => <option key={r}>{r}</option>)}</select></td></tr>)}</tbody></table></Card>
        </div>
      )}
      {tab === 'sla' && (
        <Card title="SLA templates (response / resolution targets)">
          <table className="table-base"><thead><tr><th>Priority</th><th>Essential</th><th>Advanced</th><th>Premium</th></tr></thead>
            <tbody>{[['P1 — business down', '1h / 8h', '30m / 4h', '15m / 4h (24x7)'], ['P2 — several users', '4h / 1 day', '2h / 8h', '1h / 8h'], ['P3 — one user', '8h / 3 days', '4h / 1 day', '2h / 1 day'], ['P4 — request', '1 day / 5 days', '1 day / 3 days', '8h / 2 days']].map((r) => <tr key={r[0]}>{r.map((x, i) => <td key={i}>{x}</td>)}</tr>)}</tbody></table>
          <p className="mt-2 text-xs text-muted">Business hours: Mon–Fri 8 AM–6 PM local. Premium includes 24x7 for P1/P2.</p>
        </Card>
      )}
      {tab === 'audit' && <Card title="Audit log"><div className="max-h-[60vh] overflow-y-auto">{s.audit.map((a) => <div key={a.id} className="flex gap-3 border-b border-line/60 py-1.5 text-sm"><span className="w-40 shrink-0 text-xs text-muted">{fmtDateTime(a.at)}</span><span className="w-24 shrink-0 text-xs">{a.who}</span>{a.action}</div>)}</div></Card>}
      {tab === 'releases' && <Card title="Release notes">{releases.map((r) => <div key={r.version}><div className="font-semibold">v{r.version} — {r.title} <span className="text-xs text-muted">{r.date}</span></div><ul className="mt-1 list-disc pl-5 text-sm">{r.items.map((i) => <li key={i}>{i}</li>)}</ul></div>)}<button className="btn-ghost mt-4" onClick={() => s.setUI({ tourDone: false })}><Play size={14} /> Replay first-login tour</button></Card>}
      {tab === 'workspace' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Your data">
            <p className="mb-3 text-sm text-muted">Currently using: <b>{s.ui.demoMode ? 'Demo data' : 'Your live workspace'}</b>. Connect Supabase (docs/SETUP.md) to store data in the cloud and share it across devices and team members.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={exportData}><Download size={14} /> Export backup</button>
              <label className="btn-ghost cursor-pointer"><Upload size={14} /> Restore backup<input type="file" accept=".json" className="hidden" onChange={(e) => importData(e.target.files?.[0])} /></label>
            </div>
          </Card>
          <Card title="Reset">
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => { s.resetDemo(); toast('Demo data restored') }}><RotateCcw size={14} /> Reload demo data</button>
              <button className="btn-danger" onClick={() => { if (window.confirm('Remove all demo data and start with an empty workspace?')) { s.startFresh(); toast('Workspace cleared — add your first client!') } }}><Trash2 size={14} /> Start fresh (clear demo)</button>
              <button className="btn-ghost" onClick={() => s.setUI({ setupDone: false })}>Re-run setup wizard</button>
            </div>
            <p className="mt-3 text-xs text-muted">API keys are managed in <Link to="/app/integrations" className="text-accent">Integrations</Link>.</p>
          </Card>
        </div>
      )}
    </div>
  )
}
