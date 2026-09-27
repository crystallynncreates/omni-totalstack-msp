// Team & Client Logins: invite technicians/admins/finance to the Command Center and client contacts to the portal.
import { useEffect, useState } from 'react'
import { UserPlus, Trash2, Copy, Mail, ShieldCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { Badge, Card, Field, PageHeader, toast } from '../components/ui'
import { PLANS, limitFor } from '../../shared/plans'
import { fmtDate } from '../lib/format'

interface Member { user_id: string; role: string; client_id?: string; name?: string; email?: string; created_at: string }
interface Pending { id: string; email: string; role: string; client_id?: string; created_at: string; expires_at: string }

const ROLES = [
  { v: 'admin', l: 'Admin', d: 'Everything except billing' },
  { v: 'technician', l: 'Technician', d: 'Clients, tickets, infrastructure — no finance' },
  { v: 'finance', l: 'Finance', d: 'Invoices, payments, payroll, reports' },
  { v: 'client', l: 'Client portal user', d: "Sees only their own company's portal" },
]

export default function Team() {
  const s = useStore()
  const session = s.session
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [f, setF] = useState({ email: '', name: '', role: 'technician', clientId: '' })
  const [lastLink, setLastLink] = useState('')
  const canManage = !session || ['owner', 'admin'].includes(session.role)

  const load = () => api<{ members: Member[]; pending: Pending[] }>('invites/list').then((r) => { if (r.ok && r.data) { setMembers(r.data.members); setPending(r.data.pending) } })
  useEffect(() => { if (session) load() }, [session])

  const staff = members.filter((m) => m.role !== 'client')
  const seats = session ? limitFor(session.plan, 'seats', session.comped) : Infinity

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return toast('Invitations work in a real workspace.', 'warn')
    if (f.role !== 'client' && staff.length + pending.filter((p) => p.role !== 'client').length >= seats) return toast(`Your ${PLANS[session.plan].name} plan includes ${seats} staff seat(s). Upgrade under Plan & Billing.`, 'warn')
    const r = await api<{ link: string; emailed: boolean }>('invites/create', f)
    if (!r.ok) return toast(r.error || 'Could not invite', 'bad')
    setLastLink(r.data!.link)
    toast(r.data!.emailed ? `Invitation emailed to ${f.email}` : 'Invitation created — copy the link below and send it')
    setF({ ...f, email: '', name: '' })
    load()
  }
  const revoke = async (body: { inviteId?: string; userId?: string }) => { const r = await api('invites/revoke', body); if (!r.ok) return toast(r.error || 'Failed', 'bad'); load() }
  const clientName = (id?: string) => s.clients.find((c) => c.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title="Team & Client Logins" subtitle={session ? `${staff.length} of ${seats === Infinity ? 'unlimited' : seats} staff seats used · client portal users are free` : 'Demo workspace'} help="Invite your technicians and staff to the Command Center, and your clients' contacts to your branded client portal. Each person gets an email with a link to set their password. Client users only ever see their own company." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Invite someone" icon={<UserPlus size={16} />}>
          {!canManage ? <p className="text-sm text-muted">Only owners and admins can invite people.</p> : (
            <form onSubmit={invite} className="space-y-3">
              <Field label="Email"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Name (optional)"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Access">
                <div className="space-y-1.5">{ROLES.map((r) => <label key={r.v} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-2 text-sm has-[:checked]:border-accent"><input type="radio" name="role" checked={f.role === r.v} onChange={() => setF({ ...f, role: r.v })} className="mt-1" /><span><b>{r.l}</b><span className="block text-xs text-muted">{r.d}</span></span></label>)}</div>
              </Field>
              {f.role === 'client' && <Field label="Which client?"><select className="input" required value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}><option value="">Choose…</option>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
              <button className="btn-primary w-full"><Mail size={15} /> Send invitation</button>
              {lastLink && <button type="button" className="btn-ghost w-full text-xs" onClick={() => { navigator.clipboard?.writeText(lastLink).then(() => toast('Link copied')).catch(() => toast(lastLink)) }}><Copy size={13} /> Copy invitation link</button>}
            </form>
          )}
        </Card>
        <Card title="People" className="xl:col-span-2">
          {!session ? (
            <table className="table-base"><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody>{s.employees.map((e) => <tr key={e.id}><td>{e.name}<div className="text-xs text-muted">{e.email}</div></td><td className="capitalize">{e.appRole}</td></tr>)}</tbody></table>
          ) : (
            <table className="table-base">
              <thead><tr><th>Person</th><th>Access</th><th>Client</th><th>Since</th><th /></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id}><td>{m.name || '—'}<div className="text-xs text-muted">{m.email}</div></td><td><Badge tone={m.role === 'owner' ? 'violet' : m.role === 'client' ? 'muted' : 'info'}>{m.role === 'owner' && <ShieldCheck size={11} />}{m.role}</Badge></td><td>{m.role === 'client' ? clientName(m.client_id) : ''}</td><td>{fmtDate(m.created_at)}</td>
                    <td className="text-right">{m.role !== 'owner' && canManage && <button className="rounded p-1.5 text-muted hover:text-bad" onClick={() => revoke({ userId: m.user_id })} aria-label="Remove"><Trash2 size={14} /></button>}</td></tr>
                ))}
                {pending.map((p) => (
                  <tr key={p.id} className="text-muted"><td>{p.email}<div className="text-xs">invitation pending · expires {fmtDate(p.expires_at)}</div></td><td><Badge>{p.role}</Badge></td><td>{p.role === 'client' ? clientName(p.client_id) : ''}</td><td>{fmtDate(p.created_at)}</td>
                    <td className="text-right">{canManage && <button className="rounded p-1.5 hover:text-bad" onClick={() => revoke({ inviteId: p.id })} aria-label="Cancel invite"><Trash2 size={14} /></button>}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}
