// First-login guided tour + "What's new" modal for system/site updates.
import { useEffect, useLayoutEffect, useState } from 'react'
import { Sparkles, ArrowRight, X, Play } from 'lucide-react'
import { releases } from '../lib/seed'
import { APP_VERSION } from '../lib/store'
import { Modal } from './ui'

export const TOUR_STEPS = [
  { target: 'nav-home', title: 'Your Command Center', text: 'Start every day here. One screen shows what needs attention: sites that are down, contracts expiring (in red), overdue invoices, tickets at risk and updates waiting.' },
  { target: 'nav-clients', title: 'Clients (Business Suite)', text: 'Every client is a folder. Open one to see their sites, contracts, documents, proposals, agreements, devices, users and invoices — all in one place, grouped by industry.' },
  { target: 'nav-leads', title: 'Leads & Bookings', text: 'Visitors who fill out your landing page, request an AI call or book a meeting land here automatically. One click turns a lead into a proposal.' },
  { target: 'nav-proposals', title: 'Proposals & RFS', text: 'Answer simple questions about the client. Omni builds three solutions (Essential, Advanced, Premium) — Huntress is always included. Pick one and download the RFS as a PDF.' },
  { target: 'nav-finance', title: 'Finance', text: 'QuickBooks numbers, invoices (drag-and-drop builder), payments, MRR/ARR and profit per client. Unpaid invoices automatically generate a Notice of Non-Payment.' },
  { target: 'nav-infrastructure', title: 'Sites & Infrastructure', text: 'Live status of every client site from UniFi and your RMM. Outages and "network down" show in red at the top.' },
  { target: 'nav-discovery', title: 'Network Discovery', text: 'Run the Omni Agent at a client site to find every device on the network. New or risky devices are flagged and can be added to inventory with one click.' },
  { target: 'nav-patching', title: 'Patching & Updates', text: 'Updates only deploy after 15 days with no reported bugs. Clients get an automatic email every week summarizing what was installed.' },
  { target: 'nav-integrations', title: 'Integrations', text: 'Connect Claude, your RMM, Huntress, Microsoft 365, Entra ID, UniFi, QuickBooks, Stripe and more. Each card has step-by-step instructions.' },
  { target: 'nav-team', title: 'Team & Client Logins', text: 'Invite your technicians to this Command Center and your clients to your branded client portal. Clients only ever see their own company.' },
  { target: 'nav-billing', title: 'Plan & Billing', text: 'See your plan and usage, upgrade any time, and update your card. If a payment fails you get a 7-day grace period before anything pauses.' },
  { target: 'help', title: 'Help is always here', text: 'Click this ? any time to replay the tour. Look for small ? icons on each page for plain-English explanations.' },
]

export function Tour({ onDone, steps = TOUR_STEPS }: { onDone: () => void; steps?: typeof TOUR_STEPS }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = steps[i]

  useLayoutEffect(() => {
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null
    if (el && el.offsetParent !== null) {
      el.scrollIntoView({ block: 'nearest' })
      const r = el.getBoundingClientRect()
      setRect(r.width > 0 && r.left >= 0 ? r : null)
    } else setRect(null)
  }, [step])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); if (e.key === 'ArrowRight') next() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const next = () => (i < steps.length - 1 ? setI(i + 1) : onDone())
  const pad = 6
  const cardStyle: React.CSSProperties = rect
    ? { top: Math.min(window.innerHeight - 230, Math.max(12, rect.top - 10)), left: Math.min(window.innerWidth - 360, rect.right + 18) }
    : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }

  return (
    <div className="fixed inset-0 z-[90]">
      {rect ? (
        <div className="pointer-events-none absolute rounded-xl ring-2 ring-accent transition-all duration-300" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(0,0,0,.62)' }} />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}
      <div className="glass absolute w-[340px] bg-panel p-5 animate-fadeUp" style={cardStyle}>
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>Step {i + 1} of {steps.length}</span>
          <button onClick={onDone} className="hover:text-ink" aria-label="Skip tour"><X size={16} /></button>
        </div>
        <h3 className="h-display text-lg">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.text}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">{steps.map((_, j) => <span key={j} className={`h-1.5 w-4 rounded-full ${j === i ? 'bg-accent' : 'bg-line'}`} />)}</div>
          <div className="flex gap-2">
            {i > 0 && <button className="btn-ghost" onClick={() => setI(i - 1)}>Back</button>}
            <button className="btn-primary" onClick={next}>{i === steps.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WhatsNew({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-accent" /> What's new in v{APP_VERSION}</span>} footer={<><button className="btn-ghost" onClick={onClose}>Got it</button><button className="btn-primary" onClick={onTour}><Play size={14} /> Show me what changed</button></>}>
      {releases.map((r) => (
        <div key={r.version} className="mb-4">
          <div className="flex items-baseline justify-between"><div className="font-semibold">{r.title}</div><div className="text-xs text-muted">v{r.version} · {r.date}</div></div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {r.items.map((it) => <li key={it} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{it}</li>)}
          </ul>
        </div>
      ))}
      <p className="rounded-xl bg-accent/5 p-3 text-xs text-muted">Every future update will appear here with a short guided tour of what moved or was added. Full history: Admin → Release notes.</p>
    </Modal>
  )
}
