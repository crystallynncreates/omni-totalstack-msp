// IT Strategy & QBR (myITprocess-style): alignment scorecard, quarterly roadmap and budget, QBR PDF.
import { useState } from 'react'
import { Download, Plus, Target, Sparkles } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useStore } from '../lib/store'
import type { RoadmapItem } from '../lib/types'
import { Badge, Card, Field, Modal, PageHeader, Ring, toast } from '../components/ui'
import { money, sum, uid, fmtDate, iso } from '../lib/format'
import { askClaude } from '../lib/api'

const CATS: RoadmapItem['category'][] = ['Security', 'Network', 'Hardware', 'Cloud', 'Backup', 'Compliance', 'Process']

export default function Strategy() {
  const s = useStore()
  const [clientId, setClientId] = useState(s.clients.find((c) => c.status === 'active')?.id ?? '')
  const [add, setAdd] = useState(false)
  const [summary, setSummary] = useState('')
  const client = s.clients.find((c) => c.id === clientId)
  const items = s.roadmap.filter((r) => r.clientId === clientId)
  const devices = s.devices.filter((d) => d.clientId === clientId)
  const users = s.directoryUsers.filter((u) => u.clientId === clientId)

  // Alignment score: start at 100 per category, subtract for open findings and live telemetry gaps
  const score = (cat: RoadmapItem['category']) => {
    let v = 100 - items.filter((r) => r.category === cat && r.status !== 'done').reduce((a, r) => a + (r.priority === 'high' ? 30 : r.priority === 'medium' ? 15 : 8), 0)
    if (cat === 'Security') v -= devices.filter((d) => !d.huntressAgent && d.rmmAgent).length * 10 + users.filter((u) => !u.mfa).length * 10
    if (cat === 'Backup') v -= devices.filter((d) => d.backupStatus === 'failed').length * 20
    if (cat === 'Hardware') v -= devices.filter((d) => d.warrantyEnd && new Date(d.warrantyEnd) < new Date()).length * 10
    return Math.max(0, Math.min(100, v))
  }
  const overall = Math.round(sum(CATS, score) / CATS.length)
  const quarters = Array.from(new Set(items.map((i) => i.quarter))).sort()

  const qbrPdf = () => {
    if (!client) return
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(`${client.name} — Quarterly Business Review`, 40, 60)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`Prepared by ${s.company.name} · ${fmtDate(iso())}`, 40, 78)
    doc.setFontSize(13); doc.text(`Technology alignment score: ${overall}/100`, 40, 110)
    autoTable(doc, { startY: 124, head: [['Category', 'Score']], body: CATS.map((c) => [c, `${score(c)}/100`]), headStyles: { fillColor: [37, 99, 235] } })
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
    autoTable(doc, { startY: y, head: [['Quarter', 'Category', 'Finding', 'Recommendation', 'Priority', 'Est. cost']], body: items.map((r) => [r.quarter, r.category, r.finding, r.recommendation, r.priority, money(r.estCost)]), styles: { fontSize: 8.5 }, headStyles: { fillColor: [37, 99, 235] } })
    if (summary) { const yy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24; doc.setFontSize(10); doc.text(doc.splitTextToSize(summary, 530), 40, yy) }
    doc.save(`QBR-${client.name.replace(/\W+/g, '_')}.pdf`)
    s.add('documents', { id: uid('doc'), clientId: client.id, name: `QBR ${fmtDate(iso())}`, category: 'QBR', createdAt: iso() })
  }

  const aiSummary = async () => {
    const t = await askClaude(`Write a friendly 120-word QBR executive summary for ${client?.name}. Alignment score ${overall}/100. Category scores: ${CATS.map((c) => `${c} ${score(c)}`).join(', ')}. Roadmap: ${items.map((r) => `${r.quarter} ${r.recommendation} (${r.priority})`).join('; ')}.`)
    if (t) setSummary(t); else toast('Connect Claude in Integrations to generate summaries', 'warn')
  }

  return (
    <div>
      <PageHeader title="IT Strategy & QBR" subtitle="Demonstrate value and build trust at every quarterly business review"
        actions={<><select className="input w-56" value={clientId} onChange={(e) => setClientId(e.target.value)}>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn-primary" onClick={qbrPdf}><Download size={15} /> QBR report</button></>}
        help="Scores update automatically from live data (Huntress coverage, MFA, failed backups, warranties) plus open roadmap items. Use the roadmap to plan and budget upgrades by quarter." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Alignment scorecard" icon={<Target size={16} />}>
          <div className="flex justify-center"><Ring value={overall} size={120} tone={overall > 75 ? 'ok' : overall > 50 ? 'warn' : 'bad'} /></div>
          <div className="mt-4 grid grid-cols-2 gap-2">{CATS.map((c) => { const v = score(c); return <div key={c} className="flex items-center justify-between rounded-lg bg-ink/5 px-2.5 py-1.5 text-sm"><span>{c}</span><b className={v > 75 ? 'text-ok' : v > 50 ? 'text-warn' : 'text-bad'}>{v}</b></div> })}</div>
        </Card>
        <Card title="Roadmap by quarter" className="lg:col-span-2" action={<button className="btn-ghost" onClick={() => setAdd(true)}><Plus size={14} /> Add item</button>}>
          <div className="grid gap-3 md:grid-cols-2">
            {quarters.map((q) => (
              <div key={q} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex justify-between text-sm font-semibold">{q}<span className="text-muted">{money(sum(items.filter((i) => i.quarter === q), (i) => i.estCost))}</span></div>
                {items.filter((i) => i.quarter === q).map((r) => (
                  <div key={r.id} className="mb-2 rounded-lg bg-ink/5 p-2 text-sm">
                    <div className="flex items-center gap-2"><Badge tone={r.priority === 'high' ? 'bad' : r.priority === 'medium' ? 'warn' : 'muted'}>{r.category}</Badge><span className="flex-1 font-medium">{r.recommendation}</span></div>
                    <div className="mt-1 text-xs text-muted">{r.finding}</div>
                    <div className="mt-1 flex items-center justify-between text-xs"><span>{money(r.estCost)}</span>
                      <select className="rounded border border-line bg-panel px-1 text-xs" value={r.status} onChange={(e) => s.update('roadmap', r.id, { status: e.target.value as RoadmapItem['status'] })}><option>open</option><option>planned</option><option>done</option></select></div>
                  </div>
                ))}
              </div>
            ))}
            {quarters.length === 0 && <p className="text-sm text-muted">No roadmap items yet.</p>}
          </div>
        </Card>
        <Card title="QBR executive summary" className="lg:col-span-3" action={<button className="btn-ghost text-xs" onClick={aiSummary}><Sparkles size={13} /> Draft with Claude</button>}>
          <textarea className="input" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summarize wins, risks and next quarter's priorities. This text appears on the QBR PDF." />
        </Card>
      </div>
      {add && <AddItem clientId={clientId} onClose={() => setAdd(false)} />}
    </div>
  )
}

function AddItem({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const s = useStore()
  const [r, setR] = useState<RoadmapItem>({ id: uid('r'), clientId, category: 'Security', finding: '', recommendation: '', priority: 'medium', quarter: 'Q1 2027', status: 'open', estCost: 0 })
  return (
    <Modal open onClose={onClose} title="Add roadmap item" footer={<button className="btn-primary" disabled={!r.recommendation} onClick={() => { s.add('roadmap', r); onClose() }}>Save</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category"><select className="input" value={r.category} onChange={(e) => setR({ ...r, category: e.target.value as RoadmapItem['category'] })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Priority"><select className="input" value={r.priority} onChange={(e) => setR({ ...r, priority: e.target.value as RoadmapItem['priority'] })}><option>high</option><option>medium</option><option>low</option></select></Field>
        <Field label="Finding" className="sm:col-span-2"><input className="input" value={r.finding} onChange={(e) => setR({ ...r, finding: e.target.value })} /></Field>
        <Field label="Recommendation" className="sm:col-span-2"><input className="input" value={r.recommendation} onChange={(e) => setR({ ...r, recommendation: e.target.value })} /></Field>
        <Field label="Quarter"><input className="input" value={r.quarter} onChange={(e) => setR({ ...r, quarter: e.target.value })} /></Field>
        <Field label="Estimated cost"><input type="number" className="input" value={r.estCost} onChange={(e) => setR({ ...r, estCost: +e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
