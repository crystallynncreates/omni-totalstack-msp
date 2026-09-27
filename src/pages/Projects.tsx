// Projects: cards + Gantt timeline, milestones, billable hours (feeds invoices).
import { useState } from 'react'
import { Plus, CalendarRange } from 'lucide-react'
import { useStore, clientName } from '../lib/store'
import type { Project } from '../lib/types'
import { Badge, Card, Field, Modal, PageHeader, Ring, Tabs, toast } from '../components/ui'
import { fmtDate, money, uid, isoDate, addDays, DAY } from '../lib/format'

type Tab = 'cards' | 'gantt'
const TONE = { on_track: 'ok', at_risk: 'warn', delayed: 'bad', done: 'info' } as const

export default function Projects() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('cards')
  const [add, setAdd] = useState(false)
  const toggle = (p: Project, i: number) => {
    const milestones = p.milestones.map((m, k) => (k === i ? { ...m, done: !m.done } : m))
    const progress = Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100)
    s.update('projects', p.id, { milestones, progress, status: progress === 100 ? 'done' : p.status })
  }
  const min = Math.min(...s.projects.map((p) => new Date(p.start).getTime()), Date.now())
  const max = Math.max(...s.projects.map((p) => new Date(p.end).getTime()), Date.now() + 7 * DAY)
  const span = max - min
  const pct = (d: string | number) => ((new Date(d).getTime() - min) / span) * 100

  return (
    <div>
      <PageHeader title="Projects" subtitle="Migrations, upgrades, onboarding and special initiatives" actions={<button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> New project</button>} help="Tick milestones to update progress. Billable hours logged here appear in the invoice builder automatically." />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'cards', label: 'Projects' }, { id: 'gantt', label: 'Timeline (Gantt)', icon: <CalendarRange size={14} /> }]} />
      {tab === 'cards' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {s.projects.map((p) => (
            <Card key={p.id} title={p.name} action={<select className="rounded-lg border border-line bg-panel px-2 py-1 text-xs" value={p.status} onChange={(e) => s.update('projects', p.id, { status: e.target.value as Project['status'] })}>{Object.keys(TONE).map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}</select>}>
              <div className="mb-2 flex items-center gap-2 text-xs text-muted"><Badge tone={TONE[p.status]}>{p.status.replace('_', ' ')}</Badge>{clientName(p.clientId)}</div>
              <div className="flex gap-4">
                <Ring value={p.progress} tone={p.status === 'at_risk' ? 'warn' : p.status === 'delayed' ? 'bad' : 'accent'} />
                <ul className="flex-1 space-y-1 text-sm">{p.milestones.map((m, i) => <li key={m.name}><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={m.done} onChange={() => toggle(p, i)} /><span className={m.done ? 'text-muted line-through' : ''}>{m.name}</span><span className="ml-auto text-xs text-muted">{fmtDate(m.due)}</span></label></li>)}</ul>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>{fmtDate(p.start)} → {fmtDate(p.end)}</span><span>Budget {money(p.budget)}</span>
                <label className="flex items-center gap-1">Hours <input type="number" className="w-16 rounded border border-line bg-panel px-1" value={p.billableHours} onChange={(e) => s.update('projects', p.id, { billableHours: +e.target.value })} /></label>
              </div>
            </Card>
          ))}
        </div>
      )}
      {tab === 'gantt' && (
        <Card>
          <div className="relative space-y-3">
            <div className="absolute bottom-0 top-0 w-px bg-bad/60" style={{ left: `calc(12rem + (100% - 12rem) * ${pct(Date.now()) / 100})` }} title="Today" />
            {s.projects.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-48 shrink-0 truncate text-sm">{p.name}<div className="text-xs text-muted">{clientName(p.clientId)}</div></div>
                <div className="relative h-8 flex-1 rounded-lg bg-ink/5">
                  <div className="absolute top-1 h-6 rounded-md bg-gradient-to-r from-accent/70 to-accent2/70" style={{ left: `${pct(p.start)}%`, width: `${Math.max(2, pct(p.end) - pct(p.start))}%` }}>
                    <div className="h-full rounded-md bg-accent" style={{ width: `${p.progress}%` }} />
                  </div>
                  {p.milestones.map((m) => <div key={m.name} title={`${m.name} · ${fmtDate(m.due)}`} className={`absolute top-2.5 h-3 w-3 -translate-x-1/2 rotate-45 border-2 border-panel ${m.done ? 'bg-ok' : 'bg-warn'}`} style={{ left: `${pct(m.due)}%` }} />)}
                </div>
              </div>
            ))}
            <div className="flex justify-between pl-48 text-xs text-muted"><span>{fmtDate(new Date(min).toISOString())}</span><span>{fmtDate(new Date(max).toISOString())}</span></div>
          </div>
        </Card>
      )}
      {add && <NewProject onClose={() => setAdd(false)} />}
    </div>
  )
}

function NewProject({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [p, setP] = useState<Project>({ id: uid('pj'), clientId: s.clients[0]?.id ?? '', name: '', status: 'on_track', progress: 0, start: isoDate(), end: isoDate(addDays(new Date(), 30)), budget: 0, billableHours: 0, milestones: [] })
  const [ms, setMs] = useState('Kickoff\nImplementation\nTesting\nHandoff')
  const save = () => {
    const names = ms.split('\n').map((x) => x.trim()).filter(Boolean)
    const len = (new Date(p.end).getTime() - new Date(p.start).getTime()) / names.length
    s.add('projects', { ...p, milestones: names.map((n, i) => ({ name: n, due: isoDate(new Date(new Date(p.start).getTime() + len * (i + 1))), done: false })) })
    onClose(); toast('Project created')
  }
  return (
    <Modal open onClose={onClose} title="New project" footer={<button className="btn-primary" disabled={!p.name} onClick={save}>Create</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
        <Field label="Client"><select className="input" value={p.clientId} onChange={(e) => setP({ ...p, clientId: e.target.value })}>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Budget ($)"><input type="number" className="input" value={p.budget} onChange={(e) => setP({ ...p, budget: +e.target.value })} /></Field>
        <Field label="Start"><input type="date" className="input" value={p.start} onChange={(e) => setP({ ...p, start: e.target.value })} /></Field>
        <Field label="End"><input type="date" className="input" value={p.end} onChange={(e) => setP({ ...p, end: e.target.value })} /></Field>
        <Field label="Milestones (one per line — dates spread automatically)" className="sm:col-span-2"><textarea className="input" rows={4} value={ms} onChange={(e) => setMs(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
