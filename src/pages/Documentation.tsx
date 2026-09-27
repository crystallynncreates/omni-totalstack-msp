// Documentation (Network Glue-style): SOPs/runbooks, network docs, Entra ID & M365 users/groups, password rotation.
import { useState } from 'react'
import { BookOpen, KeyRound, Users, Plus, FileText, RefreshCw } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import type { DocCategory } from '../lib/types'
import { Badge, Card, Field, Modal, PageHeader, Tabs, toast, cx } from '../components/ui'
import { CredentialsTable } from '../components/tables'
import { fmtDate, timeAgo, uid, iso, daysSince } from '../lib/format'
import { api } from '../lib/api'

type Tab = 'library' | 'directory' | 'passwords'

export default function Documentation() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('library')
  const [cat, setCat] = useState<'all' | DocCategory>('all')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<{ id?: string; clientId: string; name: string; category: DocCategory; body: string } | null>(null)
  const docs = s.documents.filter((d) => (cat === 'all' || d.category === cat) && (d.name + (d.body ?? '')).toLowerCase().includes(q.toLowerCase()))
  const groups = Array.from(new Set(s.directoryUsers.flatMap((u) => u.groups.map((g) => `${u.clientId}|${g}`))))
  const due = s.credentials.filter((c) => daysSince(c.lastRotated) >= c.rotateEveryDays)

  const save = () => {
    if (!edit) return
    if (edit.id) s.update('documents', edit.id, { name: edit.name, category: edit.category, body: edit.body, clientId: edit.clientId })
    else s.add('documents', { id: uid('doc'), clientId: edit.clientId, name: edit.name, category: edit.category, body: edit.body, createdAt: iso() })
    setEdit(null); toast('Saved')
  }

  return (
    <div>
      <PageHeader title="Documentation" subtitle="Automatically document devices, Entra ID, AD, M365 groups & users, network diagrams — plus password rotation"
        actions={<button className="btn-ghost" onClick={async () => { const r = await api('graph/sync', {}); toast(r.ok ? 'Synced users & groups from Microsoft Graph' : 'Connect Microsoft 365 / Entra ID to sync automatically', r.ok ? 'ok' : 'warn') }}><RefreshCw size={15} /> Sync directory</button>} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'library', label: 'SOPs & runbooks', icon: <BookOpen size={14} /> }, { id: 'directory', label: 'Users & groups', icon: <Users size={14} /> }, { id: 'passwords', label: 'Password rotation', icon: <KeyRound size={14} />, count: due.length }]} />
      {tab === 'library' && (
        <Card title="Library" action={<button className="btn-primary" onClick={() => setEdit({ clientId: s.clients[0]?.id ?? '', name: '', category: 'SOP', body: '' })}><Plus size={15} /> New doc</button>}>
          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input max-w-xs" placeholder="Search SOPs, configs, runbooks…" value={q} onChange={(e) => setQ(e.target.value)} />
            {(['all', 'SOP', 'Network', 'Agreement', 'Contract', 'QBR', 'Other'] as const).map((c) => <button key={c} onClick={() => setCat(c)} className={cx('chip border px-3 py-1.5', cat === c ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted')}>{c}</button>)}
          </div>
          <table className="table-base"><thead><tr><th>Document</th><th>Client</th><th>Category</th><th>Updated</th></tr></thead>
            <tbody>{docs.map((d) => <tr key={d.id} className="cursor-pointer" onClick={() => setEdit({ id: d.id, clientId: d.clientId, name: d.name, category: d.category, body: d.body ?? '' })}><td className="flex items-center gap-2"><FileText size={14} className="text-accent" />{d.name}</td><td>{clientName(d.clientId)}</td><td><Badge>{d.category}</Badge></td><td>{fmtDate(d.createdAt)}</td></tr>)}</tbody></table>
        </Card>
      )}
      {tab === 'directory' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Users (Entra ID / Microsoft 365 / AD)" className="xl:col-span-2">
            <table className="table-base"><thead><tr><th>User</th><th>Client</th><th>License</th><th>MFA</th><th>Last sign-in</th><th>Enabled</th></tr></thead>
              <tbody>{s.directoryUsers.map((u) => <tr key={u.id}><td>{u.displayName}<div className="text-xs text-muted">{u.upn}</div></td><td>{clientName(u.clientId)}</td><td className="text-xs">{u.license}</td><td>{u.mfa ? <Badge tone="ok">on</Badge> : <Badge tone="bad">off</Badge>}</td><td>{timeAgo(u.lastSignIn)}</td><td><button className="text-xs text-accent" onClick={() => { s.update('directoryUsers', u.id, { enabled: !u.enabled }); toast(`${u.displayName} ${u.enabled ? 'disabled' : 'enabled'} in Entra ID`) }}>{u.enabled ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table>
          </Card>
          <Card title="Groups">
            {groups.map((g) => { const [cid, name] = g.split('|'); return <div key={g} className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span>{name}</span><span className="text-xs text-muted">{clientName(cid)} · {s.directoryUsers.filter((u) => u.clientId === cid && u.groups.includes(name)).length} members</span></div> })}
          </Card>
        </div>
      )}
      {tab === 'passwords' && <Card title="Credential rotation" help="Omni never stores the actual passwords in the browser. Rotation is executed through your RMM (local admin / LAPS), UniFi, or Microsoft Graph, and the new secret is written to your password vault."><CredentialsTable /></Card>}
      {edit && (
        <Modal open wide onClose={() => setEdit(null)} title={edit.id ? 'Edit document' : 'New document'} footer={<button className="btn-primary" disabled={!edit.name} onClick={save}>Save</button>}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Title" className="sm:col-span-2"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Category"><select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as DocCategory })}>{['SOP', 'Network', 'Agreement', 'Contract', 'QBR', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Client" className="sm:col-span-3"><select className="input" value={edit.clientId} onChange={(e) => setEdit({ ...edit, clientId: e.target.value })}>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Content" className="sm:col-span-3"><textarea className="input font-mono text-xs" rows={14} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
