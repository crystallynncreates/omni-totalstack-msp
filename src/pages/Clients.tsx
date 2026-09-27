// Clients — grouped by client group; each card is the front door to that client's folder.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, CalendarClock, Ticket, ShieldCheck, Building2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, Empty, PageHeader, StatusDot, cx } from '../components/ui'
import { ClientForm, AddButton } from '../components/tables'
import { expiryState, money, initials } from '../lib/format'

export default function Clients() {
  const s = useStore()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [add, setAdd] = useState(false)
  const grouped = useMemo(() => {
    const list = s.clients.filter((c) => (status === 'all' || c.status === status) && (c.name + c.group + c.primaryContact.name).toLowerCase().includes(q.toLowerCase()))
    return list.reduce<Record<string, typeof list>>((acc, c) => ((acc[c.group] ||= []).push(c), acc), {})
  }, [s.clients, q, status])

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${s.clients.length} clients in ${new Set(s.clients.map((c) => c.group)).size} groups`} actions={<AddButton onClick={() => setAdd(true)}>Add client</AddButton>}
        help="Each client is a folder holding everything about them: sites, contracts, proposals, RFS, agreements, documents, devices and invoices. Clients are grouped (e.g. Healthcare, Legal) so similar clients stay together." />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Filter clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        {['all', 'active', 'onboarding', 'prospect', 'inactive'].map((x) => <button key={x} onClick={() => setStatus(x)} className={cx('chip border px-3 py-1.5 capitalize', status === x ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted')}>{x}</button>)}
      </div>
      {Object.keys(grouped).length === 0 && <Empty icon={<Users />} title="No clients yet" text="Add your first client to start building their folder." action={<AddButton onClick={() => setAdd(true)}>Add client</AddButton>} />}
      {Object.entries(grouped).sort().map(([group, list]) => (
        <section key={group} className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted"><Building2 size={14} />{group} <span className="rounded-full bg-ink/10 px-1.5">{list.length}</span></h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => {
              const sites = s.sites.filter((x) => x.clientId === c.id)
              const red = s.contracts.filter((k) => k.clientId === c.id && ['expired', 'soon'].includes(expiryState(k.endDate)))
              const open = s.tickets.filter((t) => t.clientId === c.id && t.status !== 'resolved').length
              const docs = s.documents.filter((d) => d.clientId === c.id).length + s.proposals.filter((p) => p.clientId === c.id).length
              return (
                <Link key={c.id} to={`/app/clients/${c.id}`} className="glass group block p-4 transition hover:-translate-y-0.5 hover:shadow-glow">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/25 to-accent2/25 font-display font-semibold">{initials(c.name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{c.name}</div>
                      <div className="text-xs text-muted">{c.primaryContact.name} · {c.primaryContact.email}</div>
                    </div>
                    <Badge tone={c.status === 'active' ? 'ok' : c.status === 'prospect' ? 'info' : c.status === 'onboarding' ? 'violet' : 'muted'}>{c.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className="font-medium text-ink">{money(c.mrr)}/mo</span>
                    <Badge>{c.slaTier}</Badge>
                    <span className="flex items-center gap-1">{sites.map((x) => <StatusDot key={x.id} status={x.status} />)} {sites.length} site(s)</span>
                    <span className="flex items-center gap-1"><Ticket size={12} />{open}</span>
                    <span>{docs} docs</span>
                    {c.huntressOrgId && <span className="flex items-center gap-1 text-accent2"><ShieldCheck size={12} />Huntress</span>}
                  </div>
                  {red.length > 0 && <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-bad/10 px-2 py-1 text-xs font-medium text-bad"><CalendarClock size={12} /> {red.length} contract/subscription(s) expiring or expired</div>}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
      {add && <ClientForm open onClose={() => setAdd(false)} onSave={(c) => { s.add('clients', c); s.log(`Added client ${c.name}`) }} />}
    </div>
  )
}
