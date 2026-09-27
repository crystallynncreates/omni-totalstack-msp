// Client folder — everything about one client, including all documents, proposals, RFS and agreements.
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ShieldCheck, ExternalLink, FileText, FileSignature, Plus, Building2, Monitor, Ticket, FolderKanban, Receipt, Target, Pencil, Upload, Network, Users, Siren, Mail, Phone,
} from 'lucide-react'
import { useStore, invoiceTotal, isOverdue } from '../lib/store'
import type { ClientDocument, DocCategory } from '../lib/types'
import { Badge, Card, Empty, Expiry, Field, Modal, StatusDot, Tabs, Stat, Ring, toast, cx } from '../components/ui'
import { ContractsTable, AddContract, DevicesTable, CredentialsTable, ClientForm, DeleteButton } from '../components/tables'
import Topology from '../components/Topology'
import { daysUntil, fmtDate, fmtDateTime, money, sum, timeAgo, uid, iso, expiryState } from '../lib/format'
import { optionTotals } from '../lib/proposalEngine'

type Tab = 'overview' | 'sites' | 'contracts' | 'documents' | 'proposals' | 'network' | 'tickets' | 'projects' | 'invoices' | 'strategy'
const DOC_CATS: DocCategory[] = ['Proposal', 'RFS', 'Agreement', 'Contract', 'SOP', 'Network', 'QBR', 'Invoice', 'Notice', 'Other']

export default function ClientDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const s = useStore()
  const c = s.clients.find((x) => x.id === id)
  const tab = (params.get('tab') as Tab) || 'overview'
  const setTab = (t: Tab) => setParams({ tab: t })
  const [edit, setEdit] = useState(false)
  const [addContract, setAddContract] = useState(false)
  const [docOpen, setDocOpen] = useState<ClientDocument | null>(null)
  const [newDoc, setNewDoc] = useState(false)
  const [site, setSite] = useState<string | null>(null)

  if (!c) return <Empty title="Client not found" action={<Link to="/app/clients" className="btn-ghost">Back to clients</Link>} />

  const sites = s.sites.filter((x) => x.clientId === c.id)
  const contracts = s.contracts.filter((x) => x.clientId === c.id)
  const devices = s.devices.filter((x) => x.clientId === c.id)
  const docs = s.documents.filter((x) => x.clientId === c.id)
  const proposals = s.proposals.filter((x) => x.clientId === c.id)
  const tickets = s.tickets.filter((x) => x.clientId === c.id)
  const projects = s.projects.filter((x) => x.clientId === c.id)
  const invoices = s.invoices.filter((x) => x.clientId === c.id)
  const roadmap = s.roadmap.filter((x) => x.clientId === c.id)
  const users = s.directoryUsers.filter((x) => x.clientId === c.id)
  const outstanding = sum(invoices.filter((i) => i.status !== 'paid' && i.status !== 'void'), invoiceTotal)
  const msa = contracts.find((k) => k.type === 'MSA' || k.type === 'SLA')
  const red = contracts.filter((k) => ['expired', 'soon'].includes(expiryState(k.endDate)))
  const huntressCov = devices.filter((d) => !['ap', 'switch', 'firewall', 'printer'].includes(d.type))
  const huntressPct = huntressCov.length ? (huntressCov.filter((d) => d.huntressAgent).length / huntressCov.length) * 100 : 0
  const cost = sum(s.contracts.filter((k) => k.clientId === c.id && k.vendor !== s.company.name), (k) => k.value / 12) * 0.6
  const profitScore = c.mrr ? Math.max(0, Math.min(100, ((c.mrr - cost) / c.mrr) * 100)) : 0
  const selSite = sites.find((x) => x.id === site) ?? sites[0]

  // Every document for this client, including generated proposals/RFS and invoices
  const allDocs: (ClientDocument & { href?: string })[] = [
    ...docs,
    ...proposals.map((p) => ({ id: p.id, clientId: c.id, name: `Proposal ${p.number}`, category: 'Proposal' as const, createdAt: p.createdAt, status: p.status, href: `/app/proposals/${p.id}` })),
    ...proposals.filter((p) => p.rfsNumber).map((p) => ({ id: p.id + 'r', clientId: c.id, name: `Request for Service ${p.rfsNumber}`, category: 'RFS' as const, createdAt: p.rfsDate!, status: 'issued', href: `/app/proposals/${p.id}` })),
    ...invoices.map((i) => ({ id: i.id, clientId: c.id, name: `Invoice ${i.number}`, category: 'Invoice' as const, createdAt: i.issueDate, status: isOverdue(i) ? 'overdue' : i.status, href: '/app/finance?tab=invoices' })),
  ]

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <Link to="/app/clients" className="text-xs text-muted hover:text-accent">← Clients / {c.group}</Link>
          <h1 className="h-display text-2xl md:text-3xl">{c.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={c.status === 'active' ? 'ok' : 'info'}>{c.status}</Badge><Badge>{c.slaTier} SLA</Badge>
            <span className="flex items-center gap-1"><Mail size={13} />{c.primaryContact.email}</span><span className="flex items-center gap-1"><Phone size={13} />{c.primaryContact.phone}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={c.huntressOrgId ? `${s.integrations.huntress.config.portalUrl || s.company.huntressPortalUrl}` : s.company.huntressPortalUrl} target="_blank" rel="noreferrer" className="btn-ghost"><ShieldCheck size={15} className="text-accent2" /> Huntress account <ExternalLink size={12} /></a>
          <Link to={`/m/${s.session?.slug ?? 'demo'}/portal/${c.id}`} target="_blank" className="btn-ghost">Client portal <ExternalLink size={12} /></Link>
          <Link to={`/app/proposals/new?client=${c.id}`} className="btn-primary"><FileSignature size={15} /> New proposal</Link>
          <button onClick={() => setEdit(true)} className="btn-ghost"><Pencil size={14} /></button>
        </div>
      </div>

      {sites.some((x) => x.status !== 'online') && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-bad/40 bg-bad/10 p-3 text-sm">
          <Siren className="text-bad" size={18} />
          <b className="text-bad">Outage:</b> {sites.filter((x) => x.status !== 'online').map((x) => `${x.name} is ${x.status.toUpperCase()} — ${x.outages.find((o) => !o.end)?.cause ?? ''}`).join(' · ')}
        </div>
      )}

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'sites', label: 'Sites', icon: <Building2 size={14} />, count: sites.length },
        { id: 'contracts', label: 'Contracts', count: contracts.length },
        { id: 'documents', label: 'Documents', icon: <FileText size={14} />, count: allDocs.length },
        { id: 'proposals', label: 'Proposals & RFS', icon: <FileSignature size={14} />, count: proposals.length },
        { id: 'network', label: 'Network docs', icon: <Network size={14} /> },
        { id: 'tickets', label: 'Tickets', icon: <Ticket size={14} />, count: tickets.filter((t) => t.status !== 'resolved').length },
        { id: 'projects', label: 'Projects', icon: <FolderKanban size={14} />, count: projects.length },
        { id: 'invoices', label: 'Billing', icon: <Receipt size={14} /> },
        { id: 'strategy', label: 'Roadmap / QBR', icon: <Target size={14} /> },
      ]} />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Client overview">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Primary contact</dt><dd>{c.primaryContact.name}{c.primaryContact.title && `, ${c.primaryContact.title}`}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Address</dt><dd className="text-right">{c.address}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Property owner</dt><dd className="text-right">{c.ownerName}</dd></div>
              {c.primeContractor && <div className="flex justify-between"><dt className="text-muted">Prime contractor</dt><dd>{c.primeContractor.name}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">M365 tenant</dt><dd>{c.m365TenantId || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Client since</dt><dd>{fmtDate(c.createdAt)}</dd></div>
              {msa && <div className="flex justify-between"><dt className="text-muted">Renewal</dt><dd><Expiry date={msa.endDate} /></dd></div>}
            </dl>
            {c.notes && <p className="mt-3 rounded-xl bg-ink/5 p-2.5 text-xs">{c.notes}</p>}
          </Card>
          <Card title="Financial card">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-muted">Contract value</div><div className="h-display text-xl">{money(c.mrr * 12)}</div></div>
              <div><div className="text-xs text-muted">MRR</div><div className="h-display text-xl">{money(c.mrr)}</div></div>
              <div><div className="text-xs text-muted">Outstanding</div><div className={cx('h-display text-xl', outstanding && 'text-warn')}>{money(outstanding)}</div></div>
              <div><div className="text-xs text-muted">Auto-pay</div><div className="mt-1">{c.autopay ? <Badge tone="ok">On · {c.paymentMethod?.toUpperCase()}</Badge> : <Badge tone="warn">Off</Badge>}</div></div>
            </div>
            <div className="mt-3 flex items-center gap-3"><Ring value={profitScore} size={56} tone={profitScore > 50 ? 'ok' : 'warn'} /><div className="text-xs text-muted">Profitability score — gross margin after vendor costs.</div></div>
          </Card>
          <Card title="Health at a glance">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Sites up" value={`${sites.filter((x) => x.status === 'online').length}/${sites.length}`} tone={sites.every((x) => x.status === 'online') ? 'ok' : 'bad'} />
              <Stat label="Huntress" value={`${Math.round(huntressPct)}%`} tone={huntressPct === 100 ? 'ok' : 'warn'} />
              <Stat label="Devices" value={devices.length} sub={`${devices.filter((d) => d.status === 'offline').length} offline`} />
              <Stat label="Expiring" value={red.length} tone={red.length ? 'bad' : 'ok'} sub="contracts ≤ 30d" />
            </div>
          </Card>
          <Card title="Recent activity" className="lg:col-span-3">
            <ul className="space-y-1.5 text-sm">
              {[...tickets.map((t) => ({ at: t.createdAt, text: `Ticket #${t.number}: ${t.title} (${t.status.replace('_', ' ')})` })), ...invoices.map((i) => ({ at: i.issueDate, text: `Invoice ${i.number} ${i.status} — ${money(invoiceTotal(i), true)}` })), ...proposals.map((p) => ({ at: p.createdAt, text: `Proposal ${p.number} ${p.status}` }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8).map((a, i) => (
                <li key={i} className="flex gap-3"><span className="w-24 shrink-0 text-xs text-muted">{timeAgo(a.at)}</span>{a.text}</li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'sites' && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((x) => (
              <button key={x.id} onClick={() => setSite(x.id)} className={cx('glass p-4 text-left', selSite?.id === x.id && 'ring-1 ring-accent', x.status === 'down' && 'border-bad/60 bg-bad/5')}>
                <div className="flex items-center gap-2 font-semibold"><StatusDot status={x.status} />{x.name}<Badge tone={x.status === 'online' ? 'ok' : x.status === 'down' ? 'bad' : 'warn'} className="ml-auto">{x.status === 'down' ? 'NETWORK DOWN' : x.status}</Badge></div>
                <div className="mt-1 text-xs text-muted">{x.address} · {x.isp} · 30-day uptime {x.uptime30d}%</div>
                {x.outages.filter((o) => !o.end).map((o) => <div key={o.id} className="mt-2 rounded-lg bg-bad/10 px-2 py-1 text-xs text-bad">Since {fmtDateTime(o.start)}: {o.cause}</div>)}
                <div className="mt-2 text-xs text-muted">Contracts at this site: {contracts.filter((k) => k.siteId === x.id).map((k) => <span key={k.id} className={cx('mr-2', ['expired', 'soon'].includes(expiryState(k.endDate)) && 'font-medium text-bad')}>{k.name} ({fmtDate(k.endDate)})</span>)}</div>
              </button>
            ))}
            {sites.length === 0 && <Empty title="No sites yet" text="Connect UniFi or add a site from Sites & Infrastructure." />}
          </div>
          {selSite && <Card title={`Network diagram — ${selSite.name}`} help="Generated automatically from RMM, UniFi and network discovery data."><Topology site={selSite} devices={devices.filter((d) => d.siteId === selSite.id)} /></Card>}
          {selSite && <Card title="Outage history">{selSite.outages.length === 0 ? <p className="text-sm text-muted">No outages in the last 90 days.</p> : selSite.outages.map((o) => <div key={o.id} className="flex justify-between border-b border-line/60 py-2 text-sm"><span>{o.cause}</span><span className={o.end ? 'text-muted' : 'text-bad'}>{fmtDateTime(o.start)} {o.end ? '· resolved' : '· ONGOING'}</span></div>)}</Card>}
        </div>
      )}

      {tab === 'contracts' && <Card title="Site contracts & subscriptions" help="Expired contracts and anything expiring within 30 days appear in red." action={<button className="btn-primary" onClick={() => setAddContract(true)}><Plus size={15} /> Add</button>}><ContractsTable contracts={contracts} /></Card>}

      {tab === 'documents' && (
        <Card title="All documents" action={<button className="btn-primary" onClick={() => setNewDoc(true)}><Upload size={15} /> Add document</button>} help="Every proposal, RFS, agreement, invoice, SOP and diagram for this client lives here automatically.">
          {DOC_CATS.map((cat) => {
            const list = allDocs.filter((d) => d.category === cat)
            if (!list.length) return null
            return (
              <div key={cat} className="mb-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">{cat} ({list.length})</div>
                {list.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 border-b border-line/50 py-2 text-sm">
                    <FileText size={15} className="text-accent" />
                    {d.href ? <Link to={d.href} className="hover:text-accent">{d.name}</Link> : <button onClick={() => setDocOpen(d)} className="text-left hover:text-accent">{d.name}</button>}
                    {d.status && <Badge tone={d.status === 'overdue' ? 'bad' : d.status === 'signed' || d.status === 'paid' || d.status === 'accepted' ? 'ok' : 'muted'}>{d.status}</Badge>}
                    <span className="ml-auto text-xs text-muted">{fmtDate(d.createdAt)}</span>
                    {!d.href && <DeleteButton onClick={() => s.remove('documents', d.id)} />}
                  </div>
                ))}
              </div>
            )
          })}
        </Card>
      )}

      {tab === 'proposals' && (
        <Card title="Proposals & Requests for Service" action={<Link to={`/app/proposals/new?client=${c.id}`} className="btn-primary"><Plus size={15} /> New proposal</Link>}>
          {proposals.length === 0 ? <Empty icon={<FileSignature />} title="No proposals yet" text="Answer a few questions about this client's needs and get three ready-to-send solutions." /> : (
            <table className="table-base"><thead><tr><th>Proposal</th><th>Created</th><th>Status</th><th>Selected</th><th>RFS</th><th /></tr></thead>
              <tbody>{proposals.map((p) => <tr key={p.id}><td>{p.number}</td><td>{fmtDate(p.createdAt)}</td><td><Badge tone={p.status === 'accepted' ? 'ok' : 'info'}>{p.status}</Badge></td><td>{p.selected !== undefined ? `${p.options[p.selected].tier} · ${money(optionTotals(p.options[p.selected]).monthly)}/mo` : '—'}</td><td>{p.rfsNumber ?? '—'}</td><td><Link to={`/app/proposals/${p.id}`} className="text-accent">Open</Link></td></tr>)}</tbody></table>
          )}
        </Card>
      )}

      {tab === 'network' && (
        <div className="space-y-4">
          <PageHint text="Automated network documentation: devices from RMM & discovery, Entra ID / Microsoft 365 users and groups, network diagrams (Sites tab) and credential rotation — all in one place." />
          <Card title={`Devices (${devices.length})`} icon={<Monitor size={16} />}><DevicesTable devices={devices} /></Card>
          <Card title={`Entra ID / Microsoft 365 users (${users.length})`} icon={<Users size={16} />} help="Synced from Microsoft Graph. Red rows are security gaps: no MFA or no sign-in for 45+ days (stale account).">
            <table className="table-base"><thead><tr><th>User</th><th>UPN</th><th>License</th><th>MFA</th><th>Groups</th><th>Last sign-in</th></tr></thead>
              <tbody>{users.map((u) => { const stale = daysUntil(u.lastSignIn) < -45; return <tr key={u.id} className={cx((!u.mfa || stale) && 'text-bad')}><td>{u.displayName}</td><td className="text-xs">{u.upn}</td><td className="text-xs">{u.license}</td><td>{u.mfa ? <Badge tone="ok">On</Badge> : <Badge tone="bad">Off</Badge>}</td><td className="text-xs">{u.groups.join(', ')}</td><td>{timeAgo(u.lastSignIn)}{stale && ' · stale'}</td></tr> })}</tbody></table>
            {users.length === 0 && <p className="text-sm text-muted">Connect Microsoft 365 / Entra ID in Integrations to sync users and groups.</p>}
          </Card>
          <Card title="Credentials & password rotation" help="Passwords live in your vault; Omni tracks rotation policy and triggers rotation through the RMM or Graph."><CredentialsTable clientId={c.id} /></Card>
        </div>
      )}

      {tab === 'tickets' && <Card title="Tickets"><table className="table-base"><thead><tr><th>#</th><th>Title</th><th>Priority</th><th>Status</th><th>Assignee</th><th>SLA due</th><th>Billable</th></tr></thead><tbody>{tickets.map((t) => <tr key={t.id}><td>{t.number}</td><td>{t.title}</td><td><Badge tone={t.priority === 'P1' ? 'bad' : t.priority === 'P2' ? 'warn' : 'muted'}>{t.priority}</Badge></td><td>{t.status.replace('_', ' ')}</td><td>{t.assignee || '—'}</td><td className={cx(t.status !== 'resolved' && new Date(t.slaDueAt) < new Date() && 'text-bad')}>{fmtDateTime(t.slaDueAt)}</td><td>{t.billable ? `${t.hours}h` : '—'}</td></tr>)}</tbody></table></Card>}

      {tab === 'projects' && <div className="grid gap-4 md:grid-cols-2">{projects.map((p) => <Card key={p.id} title={p.name}><div className="flex gap-4"><Ring value={p.progress} /><ul className="space-y-1 text-sm">{p.milestones.map((m) => <li key={m.name} className={m.done ? 'text-ok' : ''}>{m.done ? '✓' : '○'} {m.name} <span className="text-muted">{fmtDate(m.due)}</span></li>)}</ul></div></Card>)}{projects.length === 0 && <Empty title="No projects" />}</div>}

      {tab === 'invoices' && <Card title="Invoices" action={<Link to={`/app/finance?tab=builder&client=${c.id}`} className="btn-primary"><Plus size={15} /> New invoice</Link>}><table className="table-base"><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Total</th><th>Status</th></tr></thead><tbody>{invoices.map((i) => <tr key={i.id}><td>{i.number}</td><td>{fmtDate(i.issueDate)}</td><td>{fmtDate(i.dueDate)}</td><td>{money(invoiceTotal(i), true)}</td><td><Badge tone={i.status === 'paid' ? 'ok' : isOverdue(i) ? 'bad' : 'warn'}>{isOverdue(i) ? 'overdue' : i.status}</Badge></td></tr>)}</tbody></table></Card>}

      {tab === 'strategy' && <Card title="IT roadmap" action={<Link to="/app/strategy" className="btn-ghost">Open strategy workspace</Link>}><table className="table-base"><thead><tr><th>Category</th><th>Finding</th><th>Recommendation</th><th>Priority</th><th>Quarter</th><th>Est.</th><th>Status</th></tr></thead><tbody>{roadmap.map((r) => <tr key={r.id}><td>{r.category}</td><td>{r.finding}</td><td>{r.recommendation}</td><td><Badge tone={r.priority === 'high' ? 'bad' : r.priority === 'medium' ? 'warn' : 'muted'}>{r.priority}</Badge></td><td>{r.quarter}</td><td>{money(r.estCost)}</td><td>{r.status}</td></tr>)}</tbody></table></Card>}

      {edit && <ClientForm open initial={c} onClose={() => setEdit(false)} onSave={(n) => { s.update('clients', c.id, n); s.log(`Edited client ${n.name}`); toast('Saved') }} />}
      {addContract && <AddContract clientId={c.id} open onClose={() => setAddContract(false)} />}
      <Modal open={!!docOpen} onClose={() => setDocOpen(null)} title={docOpen?.name}>{docOpen?.body ? <pre className="whitespace-pre-wrap font-sans text-sm">{docOpen.body}</pre> : <p className="text-sm text-muted">This document is stored in your document library. {docOpen?.category} · added {fmtDate(docOpen?.createdAt)}.</p>}</Modal>
      {newDoc && <NewDoc clientId={c.id} onClose={() => setNewDoc(false)} />}
    </div>
  )
}

const PageHint = ({ text }: { text: string }) => <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs text-muted">{text}</div>

function NewDoc({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const s = useStore()
  const [d, setD] = useState({ name: '', category: 'Agreement' as DocCategory, body: '' })
  return (
    <Modal open onClose={onClose} title="Add document" footer={<button className="btn-primary" disabled={!d.name} onClick={() => { s.add('documents', { id: uid('doc'), clientId, name: d.name, category: d.category, body: d.body, createdAt: iso() }); s.log(`Added document ${d.name}`); onClose(); toast('Document saved') }}>Save</button>}>
      <div className="space-y-3">
        <Field label="Title"><input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="Category"><select className="input" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as DocCategory })}>{DOC_CATS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Upload file (optional)"><input type="file" className="input" onChange={(e) => { const f = e.target.files?.[0]; if (f) setD({ ...d, name: d.name || f.name }) }} /></Field>
        <Field label="Notes / content"><textarea className="input" rows={6} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
