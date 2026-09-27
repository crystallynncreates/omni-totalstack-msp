// Shared tables & forms used across Business Suite and Management Hub.
import { useState } from 'react'
import { Plus, Trash2, ExternalLink, KeyRound } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import type { Contract, Device, Client } from '../lib/types'
import { Badge, Expiry, Field, Modal, StatusDot, Bar, toast, cx } from './ui'
import { daysSince, fmtDate, isoDate, money, timeAgo, uid, iso, addDays } from '../lib/format'

export function ContractsTable({ contracts, showClient }: { contracts: Contract[]; showClient?: boolean }) {
  const s = useStore()
  const sorted = [...contracts].sort((a, b) => a.endDate.localeCompare(b.endDate))
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead><tr>{showClient && <th>Client</th>}<th>Contract / subscription</th><th>Type</th><th>Site</th><th>Vendor</th><th>Value</th><th>Expires</th><th>Auto-renew</th><th /></tr></thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id}>
              {showClient && <td>{clientName(c.clientId)}</td>}
              <td className="font-medium">{c.name}</td>
              <td><Badge tone={c.type === 'Huntress' ? 'violet' : 'muted'}>{c.type}</Badge></td>
              <td className="text-muted">{s.sites.find((x) => x.id === c.siteId)?.name ?? 'All sites'}</td>
              <td>{c.vendor}</td>
              <td>{money(c.value)}<div className="text-xs text-muted">billed {c.billing}</div></td>
              <td><Expiry date={c.endDate} /></td>
              <td>{c.autoRenew ? <Badge tone="ok">Yes</Badge> : <Badge>No</Badge>}</td>
              <td className="text-right">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { s.update('contracts', c.id, { endDate: isoDate(addDays(c.endDate, 365)), startDate: c.endDate }); s.log(`Renewed ${c.name}`); toast('Renewed for 12 months') }}>Renew</button>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-muted">No contracts yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export function AddContract({ clientId, open, onClose }: { clientId: string; open: boolean; onClose: () => void }) {
  const s = useStore()
  const [c, setC] = useState<Omit<Contract, 'id'>>({ clientId, name: '', type: 'Subscription', vendor: '', startDate: isoDate(), endDate: isoDate(addDays(new Date(), 365)), value: 0, billing: 'annual', autoRenew: true })
  const save = () => { s.add('contracts', { ...c, id: uid('k') }); s.log(`Added contract ${c.name}`); onClose(); toast('Contract added') }
  return (
    <Modal open={open} onClose={onClose} title="Add contract or subscription" footer={<button className="btn-primary" disabled={!c.name} onClick={save}>Save</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><input className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="e.g. Huntress Managed EDR" /></Field>
        <Field label="Type"><select className="input" value={c.type} onChange={(e) => setC({ ...c, type: e.target.value as Contract['type'] })}>{['MSA', 'SLA', 'Subscription', 'License', 'Warranty', 'ISP', 'Domain', 'Huntress'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Site"><select className="input" value={c.siteId ?? ''} onChange={(e) => setC({ ...c, siteId: e.target.value || undefined })}><option value="">All sites</option>{s.sites.filter((x) => x.clientId === clientId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Vendor"><input className="input" value={c.vendor} onChange={(e) => setC({ ...c, vendor: e.target.value })} /></Field>
        <Field label="Annual value ($)"><input type="number" className="input" value={c.value} onChange={(e) => setC({ ...c, value: +e.target.value })} /></Field>
        <Field label="Start date"><input type="date" className="input" value={c.startDate} onChange={(e) => setC({ ...c, startDate: e.target.value })} /></Field>
        <Field label="Expiration date" hint="Turns red 30 days before"><input type="date" className="input" value={c.endDate} onChange={(e) => setC({ ...c, endDate: e.target.value })} /></Field>
        <Field label="Billing"><select className="input" value={c.billing} onChange={(e) => setC({ ...c, billing: e.target.value as Contract['billing'] })}><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="one-time">One-time</option></select></Field>
        <Field label="Auto-renew"><select className="input" value={String(c.autoRenew)} onChange={(e) => setC({ ...c, autoRenew: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></Field>
      </div>
    </Modal>
  )
}

export function DevicesTable({ devices, showClient }: { devices: Device[]; showClient?: boolean }) {
  const s = useStore()
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead><tr><th>Device</th>{showClient && <th>Client</th>}<th>Type</th><th>OS</th><th>IP</th><th>Status</th><th className="w-24">CPU</th><th className="w-24">Disk</th><th>Patches</th><th>Agents</th><th>Warranty</th><th /></tr></thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.id}>
              <td><div className="font-medium">{d.hostname}</div><div className="text-xs text-muted">{d.assignedUser || d.vendor}</div></td>
              {showClient && <td className="text-muted">{clientName(d.clientId)}</td>}
              <td className="capitalize">{d.type}</td>
              <td className="text-xs">{d.os}</td>
              <td className="font-mono text-xs">{d.ip}</td>
              <td><span className="flex items-center gap-1.5"><StatusDot status={d.status} /> <span className="text-xs">{d.status === 'offline' ? timeAgo(d.lastSeen) : d.status}</span></span></td>
              <td>{d.rmmAgent ? <><Bar value={d.cpu} /><span className="text-[10px] text-muted">{d.cpu}%</span></> : '—'}</td>
              <td>{d.rmmAgent ? <><Bar value={d.disk} /><span className="text-[10px] text-muted">{d.disk}%</span></> : '—'}</td>
              <td>{d.pendingPatches ? <Badge tone="warn">{d.pendingPatches}</Badge> : <Badge tone="ok">0</Badge>}</td>
              <td className="space-x-1">{d.rmmAgent && <Badge tone="info">RMM</Badge>}{d.huntressAgent ? <Badge tone="violet">Huntress</Badge> : !['ap', 'switch', 'firewall', 'printer'].includes(d.type) && <Badge tone="bad">No EDR</Badge>}</td>
              <td>{d.warrantyEnd ? <Expiry date={d.warrantyEnd} compact /> : '—'}</td>
              <td className="text-right"><button className="btn-ghost px-2 py-1 text-xs" onClick={() => { s.log(`Remote session to ${d.hostname}`); toast(s.integrations.rmm.connected ? `Opening remote session to ${d.hostname}…` : 'Connect your RMM in Integrations to launch remote sessions', s.integrations.rmm.connected ? 'ok' : 'warn') }}><ExternalLink size={12} /> Remote</button></td>
            </tr>
          ))}
          {devices.length === 0 && <tr><td colSpan={12} className="py-6 text-center text-muted">No devices yet — run a network discovery or connect your RMM.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export function CredentialsTable({ clientId }: { clientId?: string }) {
  const s = useStore()
  const creds = s.credentials.filter((c) => !clientId || c.clientId === clientId)
  return (
    <table className="table-base">
      <thead><tr><th>System</th>{!clientId && <th>Client</th>}<th>Username</th><th>Last rotated</th><th>Policy</th><th>Vault</th><th /></tr></thead>
      <tbody>
        {creds.map((c) => {
          const due = daysSince(c.lastRotated) >= c.rotateEveryDays
          return (
            <tr key={c.id}>
              <td className="font-medium"><KeyRound size={13} className="mr-1.5 inline text-accent" />{c.system}</td>
              {!clientId && <td>{clientName(c.clientId)}</td>}
              <td className="font-mono text-xs">{c.username}</td>
              <td className={cx(due && 'font-medium text-bad')}>{fmtDate(c.lastRotated)} ({daysSince(c.lastRotated)}d)</td>
              <td>every {c.rotateEveryDays}d</td>
              <td className="font-mono text-xs text-muted">{c.vaultRef}</td>
              <td className="text-right"><button className={cx(due ? 'btn-primary' : 'btn-ghost', 'px-2 py-1 text-xs')} onClick={() => { s.update('credentials', c.id, { lastRotated: isoDate() }); s.log(`Rotated password for ${c.system}`); toast(`Password rotated for ${c.system} and saved to vault`) }}>Rotate now</button></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function ClientForm({ initial, onSave, onClose, open }: { initial?: Client; onSave: (c: Client) => void; onClose: () => void; open: boolean }) {
  const blank: Client = { id: uid('c'), name: '', group: 'General', status: 'prospect', primaryContact: { name: '', email: '', phone: '' }, address: '', ownerName: '', ownerAddress: '', slaTier: 'Essential', mrr: 0, autopay: false, notes: '', createdAt: iso() }
  const [c, setC] = useState<Client>(initial ?? blank)
  const [prime, setPrime] = useState(!!initial?.primeContractor)
  const groups = Array.from(new Set(useStore.getState().clients.map((x) => x.group)))
  return (
    <Modal open={open} onClose={onClose} wide title={initial ? 'Edit client' : 'Add client'} footer={<button className="btn-primary" disabled={!c.name} onClick={() => { onSave({ ...c, ownerName: c.ownerName || c.name, ownerAddress: c.ownerAddress || c.address, primeContractor: prime ? c.primeContractor : undefined }); onClose() }}>Save client</button>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Business name" className="sm:col-span-2"><input className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
        <Field label="Client group" hint="Groups organize clients & their documents"><input className="input" list="groups" value={c.group} onChange={(e) => setC({ ...c, group: e.target.value })} /><datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></Field>
        <Field label="Status"><select className="input" value={c.status} onChange={(e) => setC({ ...c, status: e.target.value as Client['status'] })}>{['prospect', 'onboarding', 'active', 'inactive'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="SLA tier"><select className="input" value={c.slaTier} onChange={(e) => setC({ ...c, slaTier: e.target.value as Client['slaTier'] })}>{['Essential', 'Advanced', 'Premium'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Monthly recurring ($)"><input type="number" className="input" value={c.mrr} onChange={(e) => setC({ ...c, mrr: +e.target.value })} /></Field>
        <Field label="Contact name"><input className="input" value={c.primaryContact.name} onChange={(e) => setC({ ...c, primaryContact: { ...c.primaryContact, name: e.target.value } })} /></Field>
        <Field label="Contact email"><input className="input" value={c.primaryContact.email} onChange={(e) => setC({ ...c, primaryContact: { ...c.primaryContact, email: e.target.value } })} /></Field>
        <Field label="Contact phone"><input className="input" value={c.primaryContact.phone} onChange={(e) => setC({ ...c, primaryContact: { ...c.primaryContact, phone: e.target.value } })} /></Field>
        <Field label="Service address" className="sm:col-span-3"><input className="input" value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
        <Field label="Property owner name" hint="Used on non-payment notices"><input className="input" value={c.ownerName} onChange={(e) => setC({ ...c, ownerName: e.target.value })} /></Field>
        <Field label="Property owner address" className="sm:col-span-2"><input className="input" value={c.ownerAddress} onChange={(e) => setC({ ...c, ownerAddress: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={prime} onChange={(e) => setPrime(e.target.checked)} /> There is a prime contractor in contractual relation</label>
        {prime && <>
          <Field label="Prime contractor name"><input className="input" value={c.primeContractor?.name ?? ''} onChange={(e) => setC({ ...c, primeContractor: { name: e.target.value, address: c.primeContractor?.address ?? '' } })} /></Field>
          <Field label="Prime contractor address" className="sm:col-span-2"><input className="input" value={c.primeContractor?.address ?? ''} onChange={(e) => setC({ ...c, primeContractor: { address: e.target.value, name: c.primeContractor?.name ?? '' } })} /></Field>
        </>}
        <Field label="Huntress organization ID"><input className="input" value={c.huntressOrgId ?? ''} onChange={(e) => setC({ ...c, huntressOrgId: e.target.value })} /></Field>
        <Field label="Microsoft 365 tenant"><input className="input" value={c.m365TenantId ?? ''} placeholder="contoso.onmicrosoft.com" onChange={(e) => setC({ ...c, m365TenantId: e.target.value })} /></Field>
        <Field label="Notes" className="sm:col-span-3"><textarea className="input" rows={2} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

export const AddButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button className="btn-primary" onClick={onClick}><Plus size={15} />{children}</button>
export const DeleteButton = ({ onClick }: { onClick: () => void }) => <button className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad" onClick={onClick} aria-label="Delete"><Trash2 size={14} /></button>
