// Leads & Bookings — everything captured by the landing page, AI calls and the booking calendar.
import { Link, useNavigate } from 'react-router-dom'
import { PhoneCall, CalendarCheck, FileSignature, UserPlus, Magnet, ExternalLink } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, Card, Empty, PageHeader, Stat, toast } from '../components/ui'
import { fmtDateTime, timeAgo, uid, iso } from '../lib/format'
import { api } from '../lib/api'
import type { Lead } from '../lib/types'

const STAGES: Lead['status'][] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']

export default function Leads() {
  const s = useStore()
  const nav = useNavigate()
  const upcoming = s.appointments.filter((a) => a.status === 'booked').sort((a, b) => a.start.localeCompare(b.start))

  const convert = (l: Lead, thenPropose = false) => {
    let client = s.clients.find((c) => c.primaryContact.email && c.primaryContact.email === l.email)
    if (!client) {
      client = { id: uid('c'), name: l.company || l.name, group: 'Prospects', status: 'prospect', primaryContact: { name: l.name, email: l.email, phone: l.phone }, address: '', ownerName: l.company || l.name, ownerAddress: '', slaTier: 'Essential', mrr: 0, autopay: false, notes: l.message, createdAt: iso() }
      s.add('clients', client)
      s.log(`Converted lead ${l.name} to client`)
    }
    s.update('leads', l.id, { status: thenPropose ? 'proposal' : 'qualified' })
    if (thenPropose) nav(`/app/proposals/new?client=${client.id}`)
    else toast(`${client.name} added to Clients`)
  }

  const aiCall = async (l: Lead) => {
    const r = await api('voice/call', { name: l.name, phone: l.phone, company: l.company, leadId: l.id })
    s.update('leads', l.id, { status: 'contacted' })
    toast(r.ok ? `AI assistant is calling ${l.name}` : 'Voice provider not connected — call queued (connect it in Integrations)', r.ok ? 'ok' : 'warn')
  }

  return (
    <div>
      <PageHeader title="Leads & Bookings" subtitle="From your website, AI calls and online booking" actions={<Link to="/" target="_blank" className="btn-ghost">View landing page <ExternalLink size={13} /></Link>}
        help="New leads appear here automatically. Use 'AI call' to have the voice assistant call them, or 'Start proposal' to turn them into a client and build a 3-option proposal." />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="New leads" value={s.leads.filter((l) => l.status === 'new').length} icon={<Magnet size={16} />} />
        <Stat label="Upcoming meetings" value={upcoming.length} icon={<CalendarCheck size={16} />} />
        <Stat label="In proposal" value={s.leads.filter((l) => l.status === 'proposal').length} />
        <Stat label="Win rate" value={`${Math.round((s.leads.filter((l) => l.status === 'won').length / Math.max(1, s.leads.filter((l) => ['won', 'lost'].includes(l.status)).length)) * 100)}%`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Pipeline" className="xl:col-span-2">
          {s.leads.length === 0 ? <Empty icon={<Magnet />} title="No leads yet" text="Share your landing page — leads flow in here automatically." /> : (
            <div className="overflow-x-auto"><table className="table-base">
              <thead><tr><th>Lead</th><th>Source</th><th>Interest</th><th>Stage</th><th>When</th><th /></tr></thead>
              <tbody>{s.leads.map((l) => (
                <tr key={l.id}>
                  <td><div className="font-medium">{l.name}{l.callRequested && <Badge tone="violet" className="ml-2">wants a call</Badge>}</div><div className="text-xs text-muted">{l.company} · {l.email} {l.phone}</div>{l.message && <div className="mt-0.5 max-w-sm text-xs text-muted">“{l.message}”</div>}</td>
                  <td><Badge tone="info">{l.source.replace('_', ' ')}</Badge></td>
                  <td className="text-xs">{l.interest.join(', ') || '—'}</td>
                  <td><select className="input py-1 text-xs" value={l.status} onChange={(e) => s.update('leads', l.id, { status: e.target.value as Lead['status'] })}>{STAGES.map((x) => <option key={x}>{x}</option>)}</select></td>
                  <td className="text-xs text-muted">{timeAgo(l.createdAt)}</td>
                  <td><div className="flex justify-end gap-1">
                    {l.phone && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => aiCall(l)} title="AI call"><PhoneCall size={13} /></button>}
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => convert(l)} title="Add as client"><UserPlus size={13} /></button>
                    <button className="btn-primary px-2 py-1 text-xs" onClick={() => convert(l, true)}><FileSignature size={13} /> Proposal</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="Appointments" icon={<CalendarCheck size={16} />}>
          {upcoming.length === 0 && <p className="text-sm text-muted">No upcoming meetings.</p>}
          {upcoming.map((a) => (
            <div key={a.id} className="mb-2 rounded-xl border border-line p-3 text-sm">
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-muted">{fmtDateTime(a.start)} · {a.topic}</div>
              <div className="mt-2 flex gap-2"><button className="btn-ghost px-2 py-1 text-xs" onClick={() => s.update('appointments', a.id, { status: 'done' })}>Mark done</button><button className="btn-ghost px-2 py-1 text-xs" onClick={() => s.update('appointments', a.id, { status: 'cancelled' })}>Cancel</button></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
