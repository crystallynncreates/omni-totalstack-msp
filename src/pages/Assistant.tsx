// AI Assistant (Claude): asks questions about the business with live workspace context.
import { useRef, useState, useEffect } from 'react'
import { Bot, Send, User } from 'lucide-react'
import { useStore, invoiceTotal, isOverdue } from '../lib/store'
import { PageHeader, cx } from '../components/ui'
import { askClaude } from '../lib/api'
import { money, sum, expiryState } from '../lib/format'

const PROMPTS = ['What needs my attention today?', 'Draft a friendly payment reminder for overdue invoices', 'Which clients are at risk of churning and why?', 'Write a client email explaining our 15-day patch policy', 'Suggest upsells for each client based on their gaps']

export default function Assistant() {
  const s = useStore()
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([{ role: 'ai', text: `Hi ${s.ui.userName}! I'm your Omni assistant, powered by Claude. Ask me about clients, finances, security or anything in your workspace.` }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs])

  const context = () => {
    const overdue = s.invoices.filter(isOverdue)
    return `Company: ${s.company.name}. Clients: ${s.clients.map((c) => `${c.name} (${c.status}, ${c.slaTier}, MRR ${c.mrr})`).join('; ')}.
Sites down/degraded: ${s.sites.filter((x) => x.status !== 'online').map((x) => `${x.name}: ${x.status}`).join('; ') || 'none'}.
Overdue invoices: ${overdue.map((i) => `${i.number} ${money(invoiceTotal(i))}`).join('; ') || 'none'}.
Expiring contracts: ${s.contracts.filter((k) => ['expired', 'soon'].includes(expiryState(k.endDate))).map((k) => `${k.name} (${k.endDate})`).join('; ') || 'none'}.
Open tickets: ${s.tickets.filter((t) => t.status !== 'resolved').map((t) => `#${t.number} ${t.priority} ${t.title}`).join('; ')}.
Devices missing Huntress: ${s.devices.filter((d) => d.rmmAgent && !d.huntressAgent).map((d) => d.hostname).join(', ') || 'none'}.`
  }

  const localAnswer = () => {
    const down = s.sites.filter((x) => x.status !== 'online')
    const overdue = s.invoices.filter(isOverdue)
    return `Here's today's snapshot (connect Claude in Integrations for full AI answers):\n\n• ${down.length} site(s) with problems: ${down.map((x) => x.name).join(', ') || 'none'}\n• ${overdue.length} overdue invoice(s) totaling ${money(sum(overdue, invoiceTotal))} — notices are ready in Finance\n• ${s.contracts.filter((k) => ['expired', 'soon'].includes(expiryState(k.endDate))).length} contracts expiring within 30 days\n• ${s.tickets.filter((t) => t.status !== 'resolved' && t.priority === 'P1').length} P1 ticket(s) open`
  }

  const send = async (text: string) => {
    if (!text.trim()) return
    setMsgs((m) => [...m, { role: 'user', text }])
    setInput(''); setBusy(true)
    const r = await askClaude(`${text}\n\n---\nWorkspace context:\n${context()}`, `You are the AI assistant inside Omni TotalStack MSP, helping ${s.ui.userName}, an MSP owner. Be concise, practical and friendly. Use plain English suitable for a novice business owner.`)
    setBusy(false)
    setMsgs((m) => [...m, { role: 'ai', text: r ?? localAnswer() }])
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <PageHeader title="AI Assistant" subtitle={s.integrations.claude.connected ? 'Connected to Claude' : 'Connect Claude in Integrations for full answers'} />
      <div className="glass flex-1 space-y-4 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={cx('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
            <div className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full', m.role === 'ai' ? 'bg-gradient-to-br from-accent to-accent2 text-white dark:text-black' : 'bg-ink/10')}>{m.role === 'ai' ? <Bot size={16} /> : <User size={16} />}</div>
            <div className={cx('max-w-2xl whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm', m.role === 'ai' ? 'bg-panel border border-line' : 'bg-accent/15')}>{m.text}</div>
          </div>
        ))}
        {busy && <div className="text-sm text-muted">Thinking…</div>}
        <div ref={end} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{PROMPTS.map((p) => <button key={p} onClick={() => send(p)} className="chip border border-line px-3 py-1 text-muted hover:border-accent hover:text-accent">{p}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="mt-3 flex gap-2">
        <input className="input" placeholder="Ask anything about your MSP…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn-primary" disabled={busy}><Send size={15} /></button>
      </form>
    </div>
  )
}
