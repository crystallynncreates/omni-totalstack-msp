// Plan & Billing: the MSP's Omni subscription — plan, usage, upgrade/downgrade, payment method, invoices.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CreditCard, Crown, ExternalLink, Loader2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { Badge, Card, PageHeader, Stat, Bar, toast, cx } from '../components/ui'
import { PLANS, PLAN_ORDER, limitFor, orgIsLive, type PlanId } from '../../shared/plans'
import { fmtDate, daysUntil } from '../lib/format'

export default function Billing() {
  const s = useStore()
  const session = s.session
  const [params] = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)

  if (!session) return (
    <div><PageHeader title="Plan & Billing" subtitle="Demo workspace" help="In your real workspace this page shows your Omni plan, usage and payment method. Upgrades, downgrades and card updates happen here through Stripe." />
      <PlanGrid current="business" onPick={() => toast('Billing works in a real workspace — sign up from the Omni home page.', 'warn')} busy={null} /></div>
  )

  const plan = PLANS[session.plan]
  const live = orgIsLive({ status: session.status, comped: session.comped, grace_until: session.graceUntil })
  const statusTone = session.comped ? 'violet' : session.status === 'active' ? 'ok' : session.status === 'past_due' ? 'warn' : 'bad'
  const statusText = session.comped ? 'Complimentary' : session.status === 'past_due' ? `Payment failed · ${Math.max(0, daysUntil(session.graceUntil || ''))} days of grace left` : session.status === 'pending' ? 'Awaiting payment' : session.status
  const staff = s.employees.filter((e) => e.appRole !== 'client').length || 1

  const pick = async (p: PlanId) => {
    setBusy(p)
    const r = await api<{ url?: string; changed?: string; downgraded?: boolean }>('billing/checkout', { plan: p })
    setBusy(null)
    if (!r.ok) return toast(r.error || 'Could not start checkout', 'bad')
    if (r.data?.url) { window.location.href = r.data.url; return }
    toast(r.data?.downgraded ? 'Switched to Free Forever' : `Switched to ${PLANS[p].name}`)
    setTimeout(() => window.location.reload(), 800)
  }
  const portal = async () => {
    setBusy('portal')
    const r = await api<{ url: string }>('billing/portal', {})
    setBusy(null)
    if (r.ok && r.data?.url) window.location.href = r.data.url
    else toast(r.error || 'Could not open billing portal', 'bad')
  }

  return (
    <div>
      <PageHeader title="Plan & Billing" subtitle="Your Omni TotalStack MSP subscription" help={`If a payment fails, everything stays online for a 7-day grace period. After that the Command Center, your public website and client portal pause until payment is received. Your data is never deleted for non-payment.`} />
      {params.get('paid') && <div className="mb-4 rounded-xl bg-ok/10 p-3 text-sm text-ok">Payment received. Thank you! Your plan is active.</div>}
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card title="Current plan" icon={session.comped ? <Crown size={16} /> : <CreditCard size={16} />}>
          <div className="h-display text-2xl">{plan.name}</div>
          <div className="mt-1 flex items-center gap-2 text-sm"><Badge tone={statusTone}>{statusText}</Badge>{!session.comped && <span className="text-muted">${plan.price}/mo</span>}</div>
          {session.currentPeriodEnd && !session.comped && <div className="mt-2 text-xs text-muted">Renews {fmtDate(session.currentPeriodEnd)}</div>}
          {session.comped && <p className="mt-2 text-xs text-muted">This is the platform owner's account. It's never billed and always has every feature.</p>}
          {!session.comped && <button className="btn-ghost mt-3 w-full" onClick={portal} disabled={busy === 'portal'}>{busy === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />} Payment method & invoices</button>}
          {!live && !session.comped && <button className="btn-primary mt-2 w-full" onClick={() => pick(session.plan === 'free_forever' ? 'unlimited' : session.plan)}>Pay now & reactivate</button>}
        </Card>
        <Card title="Usage" className="md:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            {([['Clients', s.clients.length, limitFor(session.plan, 'clients', session.comped)], ['Devices', s.devices.length, limitFor(session.plan, 'devices', session.comped)], ['Staff seats', staff, limitFor(session.plan, 'seats', session.comped)]] as const).map(([k, used, max]) => (
              <div key={k}><Stat label={k} value={`${used}${max === Infinity ? '' : ` / ${max}`}`} sub={max === Infinity ? 'Unlimited' : `${Math.max(0, max - used)} left`} />{max !== Infinity && <div className="mt-2"><Bar value={(used / max) * 100} /></div>}</div>
            ))}
          </div>
        </Card>
      </div>
      {!session.comped && <PlanGrid current={session.plan} onPick={pick} busy={busy} />}
    </div>
  )
}

function PlanGrid({ current, onPick, busy }: { current: PlanId; onPick: (p: PlanId) => void; busy: string | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PLAN_ORDER.map((id) => {
        const p = PLANS[id]
        const isCur = id === current
        const up = PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(current)
        return (
          <div key={id} className={cx('glass flex flex-col p-5', isCur && 'ring-2 ring-accent')}>
            <div className="flex items-center justify-between"><div className="h-display text-lg">{p.name}</div>{isCur && <Badge tone="info">Current</Badge>}</div>
            <div className="mt-1"><span className="h-display text-3xl">${p.price}</span><span className="text-muted">/mo</span></div>
            <ul className="mt-3 flex-1 space-y-1.5 text-sm">{p.highlights.map((h) => <li key={h} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-ok" />{h}</li>)}</ul>
            <button className={cx('mt-4', up ? 'btn-primary' : 'btn-ghost')} disabled={isCur || !!busy} onClick={() => onPick(id)}>{busy === id ? <Loader2 size={14} className="animate-spin" /> : isCur ? 'Your plan' : up ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}</button>
          </div>
        )
      })}
    </div>
  )
}
