// Plan & Billing: the MSP's Omni subscription (Unlimited / Business monthly) or their Enterprise lifetime purchase,
// including the standalone-copy handoff checklist and full data export.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CreditCard, Crown, ExternalLink, Loader2, Download, Globe, Server, Database, KeyRound, Users, Rocket } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { Badge, Card, PageHeader, Stat, Bar, toast, cx } from '../components/ui'
import { PLANS, PLAN_ORDER, HANDOFF_DAYS, limitFor, orgIsLive, type PlanId } from '../../shared/plans'
import { fmtDate, daysUntil, download } from '../lib/format'

export const priceLabel = (id: PlanId) => PLANS[id].billing === 'one_time' ? `$${PLANS[id].price.toLocaleString()} one-time` : `$${PLANS[id].price}/mo`

export default function Billing() {
  const s = useStore()
  const session = s.session
  const [params] = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)

  if (!session) return (
    <div><PageHeader title="Plan & Billing" subtitle="Demo workspace" help="In your real workspace this page shows your Omni plan, usage and payment method. Monthly plans are managed through Stripe; Enterprise is a one-time purchase of your own standalone copy." />
      <PlanGrid current="business" onPick={() => toast('Billing works in a real workspace — sign up from the Omni home page.', 'warn')} busy={null} /></div>
  )

  const lifetime = session.license === 'lifetime'
  const plan = PLANS[session.plan]
  const live = orgIsLive({ status: session.status, comped: session.comped, grace_until: session.graceUntil, license: session.license, handoff_by: session.handoffBy })
  const statusTone = session.comped ? 'violet' : lifetime ? 'violet' : session.status === 'active' ? 'ok' : session.status === 'past_due' ? 'warn' : 'bad'
  const statusText = session.comped ? 'Complimentary' : lifetime ? (session.status === 'disconnected' ? 'Handed off to your standalone copy' : 'Owned — lifetime license') : session.status === 'past_due' ? `Payment failed · ${Math.max(0, daysUntil(session.graceUntil || ''))} days of grace left` : session.status === 'pending' ? 'Awaiting payment' : session.status
  const staff = s.employees.filter((e) => e.appRole !== 'client').length || 1

  const pick = async (p: PlanId) => {
    setBusy(p)
    const r = await api<{ url?: string; changed?: string }>('billing/checkout', { plan: p })
    setBusy(null)
    if (!r.ok) return toast(r.error || 'Could not start checkout', 'bad')
    if (r.data?.url) { window.location.href = r.data.url; return }
    toast(`Switched to ${PLANS[p].name}`)
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
      <PageHeader title="Plan & Billing" subtitle="Your Omni TotalStack MSP plan" help={lifetime ? `You own Omni Enterprise. Your hosted workspace stays online for ${HANDOFF_DAYS} days after purchase while your standalone copy is set up on your own domain, then it disconnects from the Omni platform.` : 'If a monthly payment fails, everything stays online for a 7-day grace period. After that the Command Center, your public website and client portal pause until payment is received. Your data is never deleted for non-payment.'} />
      {params.get('paid') === 'enterprise' && <div className="mb-4 rounded-xl bg-ok/10 p-3 text-sm text-ok">Payment received — you now own Omni Enterprise. Your monthly subscription has been canceled. Follow the standalone setup steps below.</div>}
      {params.get('paid') === '1' && <div className="mb-4 rounded-xl bg-ok/10 p-3 text-sm text-ok">Payment received. Thank you! Your plan is active.</div>}
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card title="Current plan" icon={session.comped || lifetime ? <Crown size={16} /> : <CreditCard size={16} />}>
          <div className="h-display text-2xl">{plan.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm"><Badge tone={statusTone}>{statusText}</Badge>{!session.comped && <span className="text-muted">{priceLabel(session.plan)}</span>}</div>
          {session.currentPeriodEnd && !session.comped && !lifetime && <div className="mt-2 text-xs text-muted">Renews {fmtDate(session.currentPeriodEnd)}</div>}
          {lifetime && session.handoffBy && session.status !== 'disconnected' && <div className="mt-2 text-xs text-muted">Hosted workspace stays online until <b>{fmtDate(session.handoffBy)}</b> ({Math.max(0, daysUntil(session.handoffBy))} days)</div>}
          {session.comped && <p className="mt-2 text-xs text-muted">This is the platform owner's account. It's never billed and always has every feature.</p>}
          {!session.comped && !lifetime && <button className="btn-ghost mt-3 w-full" onClick={portal} disabled={busy === 'portal'}>{busy === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />} Payment method & invoices</button>}
          {!live && !session.comped && !lifetime && <button className="btn-primary mt-2 w-full" onClick={() => pick(session.plan)}>Pay now & reactivate</button>}
        </Card>
        <Card title="Usage" className="md:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            {([['Clients', s.clients.length, limitFor(session.plan, 'clients', session.comped)], ['Devices', s.devices.length, limitFor(session.plan, 'devices', session.comped)], ['Staff seats', staff, limitFor(session.plan, 'seats', session.comped)]] as const).map(([k, used, max]) => (
              <div key={k}><Stat label={k} value={`${used}${max === Infinity ? '' : ` / ${max}`}`} sub={max === Infinity ? 'Unlimited' : `${Math.max(0, max - used)} left`} />{max !== Infinity && <div className="mt-2"><Bar value={(used / max) * 100} /></div>}</div>
            ))}
          </div>
        </Card>
      </div>
      {lifetime ? <StandaloneSetup /> : !session.comped && <PlanGrid current={session.plan} onPick={pick} busy={busy} />}
      {!lifetime && !session.comped && ['owner', 'admin'].includes(session.role) && <div className="mt-4 text-right"><ExportButton /></div>}
    </div>
  )
}

export function ExportButton() {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    const r = await api<{ org: { slug: string } }>('export')
    setBusy(false)
    if (!r.ok || !r.data) return toast(r.error || 'Export failed', 'bad')
    download(`omni-${r.data.org.slug}-export.json`, JSON.stringify(r.data, null, 2))
    toast('Export downloaded')
  }
  return <button className="btn-ghost" onClick={run} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download all my data</button>
}

function StandaloneSetup() {
  const session = useStore((s) => s.session)!
  const steps = [
    { icon: Globe, t: 'Buy your domain', d: 'Purchase the domain you want (for example it.yourcompany.com or yourcompany-it.com) from Cloudflare, GoDaddy or Namecheap. The domain is yours and paid for by you.' },
    { icon: Server, t: 'Create your hosting accounts', d: 'Free accounts at vercel.com (website) and supabase.com (database) in your company name. You own them and pay their providers directly if you ever outgrow the free tiers.' },
    { icon: Rocket, t: 'Deploy your copy', d: 'Your copy of the Omni code is deployed to your Vercel account in standalone mode (STANDALONE=true, VITE_STANDALONE_SLUG=' + session.slug + '), with your email as the owner. Your domain is then pointed at it.' },
    { icon: Database, t: 'Move your data', d: 'Download your data below. It is imported into your new database with scripts/import-workspace.mjs: clients, sites, contracts, documents, proposals, invoices, everything.' },
    { icon: KeyRound, t: 'Reconnect your integrations', d: 'For security, API keys never leave the platform. Re-enter your RMM, Huntress, Microsoft 365, UniFi, Stripe and other keys in your new copy.' },
    { icon: Users, t: 'Re-invite your team & clients', d: 'The import prints a fresh invitation link for each technician and client portal user.' },
  ]
  return (
    <Card title="Standalone setup" icon={<Server size={16} />} help={`Enterprise is a one-time purchase: you get your own copy of Omni, running on your own domain and hosting accounts, fully disconnected from the Omni platform. There are no further fees to Omni. Your hosted workspace here stays online until ${session.handoffBy ? fmtDate(session.handoffBy) : 'the handoff'} so nothing goes offline while you switch.`}>
      <ol className="grid gap-3 md:grid-cols-2">
        {steps.map((x, i) => (
          <li key={x.t} className="flex gap-3 rounded-xl border border-line p-3">
            <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-xs font-bold text-white dark:text-black')}>{i + 1}</span>
            <div><div className="flex items-center gap-1.5 font-medium"><x.icon size={14} className="text-accent" />{x.t}</div><p className="mt-0.5 text-sm text-muted">{x.d}</p></div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3"><ExportButton /><span className="text-xs text-muted">Step-by-step guide for your IT person: docs/STANDALONE.md in the Omni code.</span></div>
    </Card>
  )
}

function PlanGrid({ current, onPick, busy }: { current: PlanId; onPick: (p: PlanId) => void; busy: string | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PLAN_ORDER.map((id) => {
        const p = PLANS[id]
        const isCur = id === current
        const up = PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(current)
        const oneTime = p.billing === 'one_time'
        return (
          <div key={id} className={cx('glass flex flex-col p-5', isCur && 'ring-2 ring-accent')}>
            <div className="flex items-center justify-between"><div className="h-display text-lg">{p.name}</div>{isCur ? <Badge tone="info">Current</Badge> : oneTime && <Badge tone="violet">Own it forever</Badge>}</div>
            <div className="mt-1"><span className="h-display text-3xl">${p.price.toLocaleString()}</span><span className="text-muted">{oneTime ? ' one-time' : '/mo'}</span></div>
            <p className="mt-1 text-sm text-muted">{p.blurb}</p>
            <ul className="mt-3 flex-1 space-y-1.5 text-sm">{p.highlights.map((h) => <li key={h} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-ok" />{h}</li>)}</ul>
            <button className={cx('mt-4', up ? 'btn-primary' : 'btn-ghost')} disabled={isCur || !!busy} onClick={() => onPick(id)}>{busy === id ? <Loader2 size={14} className="animate-spin" /> : isCur ? 'Your plan' : oneTime ? `Buy Enterprise · $${p.price.toLocaleString()}` : up ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}</button>
          </div>
        )
      })}
    </div>
  )
}
