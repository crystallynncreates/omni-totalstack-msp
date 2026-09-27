import { Link } from 'react-router-dom'
import { FileSignature, Plus } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import { Badge, Card, Empty, PageHeader, Stat } from '../components/ui'
import { fmtDate, money, sum } from '../lib/format'
import { optionTotals } from '../lib/proposalEngine'

export default function Proposals() {
  const s = useStore()
  const accepted = s.proposals.filter((p) => p.status === 'accepted')
  return (
    <div>
      <PageHeader title="Proposals & RFS" subtitle="Needs assessment → 3 solutions → Request for Service PDF" actions={<Link to="/app/proposals/new" className="btn-primary"><Plus size={15} /> New proposal</Link>}
        help="Click 'New proposal', answer questions about the client's needs, and Omni creates three formal solutions. Every solution includes a mandatory Huntress subscription and addresses both cybersecurity and networking. Choose one to produce the RFS (Request for Service) PDF." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Open proposals" value={s.proposals.filter((p) => ['draft', 'sent'].includes(p.status)).length} />
        <Stat label="Accepted" value={accepted.length} tone="ok" />
        <Stat label="Won MRR" value={money(sum(accepted, (p) => (p.selected !== undefined ? optionTotals(p.options[p.selected]).monthly : 0)))} />
      </div>
      <Card>
        {s.proposals.length === 0 ? <Empty icon={<FileSignature />} title="No proposals yet" text="Your first proposal takes about 5 minutes." action={<Link to="/app/proposals/new" className="btn-primary">Create a proposal</Link>} /> : (
          <table className="table-base"><thead><tr><th>Number</th><th>Client</th><th>Created</th><th>Status</th><th>Options (monthly)</th><th>RFS</th><th /></tr></thead>
            <tbody>{s.proposals.map((p) => (
              <tr key={p.id}><td className="font-medium">{p.number}</td><td>{clientName(p.clientId)}</td><td>{fmtDate(p.createdAt)}</td><td><Badge tone={p.status === 'accepted' ? 'ok' : p.status === 'declined' ? 'bad' : 'info'}>{p.status}</Badge></td>
                <td className="text-xs">{p.options.map((o, i) => <span key={i} className={i === p.selected ? 'font-semibold text-accent' : 'text-muted'}>{o.tier} {money(optionTotals(o).monthly)}{i < 2 ? ' · ' : ''}</span>)}</td>
                <td>{p.rfsNumber ?? '—'}</td><td><Link to={`/app/proposals/${p.id}`} className="text-accent">Open</Link></td></tr>
            ))}</tbody></table>
        )}
      </Card>
    </div>
  )
}
