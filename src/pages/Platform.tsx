// Public page selling the Omni TotalStack MSP platform itself to other MSP owners (SaaS tiers).
import { Link } from 'react-router-dom'
import { Check, ArrowRight, Plug, Bot, Landmark, ShieldCheck, Radar, FileSignature } from 'lucide-react'
import Logo from '../components/Logo'
import { MARKETPLACE, MARKETPLACE_COUNT } from '../lib/integrations'
import { cx } from '../components/ui'

const TIERS = [
  { name: 'Free Forever', price: '$0', per: '', blurb: 'For brand-new MSPs landing their first clients.', features: ['Up to 3 clients & 50 devices', 'Proposals & RFS PDFs', 'Landing page + lead capture', 'Client portal', '5 core integrations'] },
  { name: 'Unlimited', price: '$99', per: '/mo', blurb: 'Solo operators who want everything.', features: ['Unlimited clients & devices', 'All 15 core integrations', 'Invoice builder + Stripe payments', 'Weekly update emails', 'Network discovery agent'] },
  { name: 'Business', price: '$249', per: '/mo', blurb: 'Growing teams with technicians.', features: ['Everything in Unlimited', 'Up to 10 staff seats + roles', 'Payroll console & QuickBooks sync', 'AI voice calls & Claude assistant', 'QBR / IT strategy module'] },
  { name: 'Enterprise', price: 'Custom', per: '', blurb: 'Multi-location MSPs & MSSPs.', features: ['Unlimited seats', `All ${MARKETPLACE_COUNT}+ integrations`, 'SSO / SCIM, audit exports', 'Dedicated success manager', 'Private cloud option'] },
]

export default function Platform() {
  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
        <Link to="/" className="flex items-center gap-2"><Logo size={30} /><span className="h-display">Omni TotalStack MSP</span></Link>
        <Link to="/login" className="btn-primary ml-auto">Start free <ArrowRight size={15} /></Link>
      </header>
      <section className="mx-auto max-w-5xl px-4 py-16 text-center">
        <span className="chip bg-accent/15 text-accent">{MARKETPLACE_COUNT}+ integrations · AI built in</span>
        <h1 className="mt-4 h-display text-4xl md:text-6xl">Run your entire MSP from <span className="gradient-text">one pane of glass.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">Clients, proposals, RMM, Huntress, Microsoft 365, UniFi, billing, payroll and a client portal — unified, and simple enough for your first hire.</p>
        <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
          {[[FileSignature, 'Proposals that close', '3-option proposals and RFS PDFs in minutes.'], [ShieldCheck, 'Security-first', 'Huntress baked into every deal.'], [Radar, 'See every network', 'Discovery, outages and topology.'], [Landmark, 'Get paid', 'Invoices, auto-pay, non-payment notices.'], [Bot, 'AI everywhere', 'Claude + AI voice calls for leads.'], [Plug, 'Plug in anything', 'RMM, PSA, M365, QuickBooks, Stripe…']].map(([I, t, d]) => {
            const Icon = I as typeof Plug
            return <div key={t as string} className="glass p-5"><Icon className="text-accent" size={20} /><div className="mt-2 font-semibold">{t as string}</div><p className="text-sm text-muted">{d as string}</p></div>
          })}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t, i) => (
            <div key={t.name} className={cx('glass flex flex-col p-6', i === 2 && 'shadow-glow ring-1 ring-accent')}>
              <div className="h-display text-xl">{t.name}</div>
              <div className="mt-2"><span className="h-display text-4xl">{t.price}</span><span className="text-muted">{t.per}</span></div>
              <p className="mt-1 text-sm text-muted">{t.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">{t.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 text-ok" />{f}</li>)}</ul>
              <Link to="/login" className={cx('mt-5', i === 2 ? 'btn-primary' : 'btn-ghost')}>{t.price === 'Custom' ? 'Contact sales' : 'Get started'}</Link>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <h2 className="mb-6 text-center h-display text-3xl">Integration marketplace</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(MARKETPLACE).map(([cat, list]) => (
            <div key={cat} className="glass p-4"><div className="mb-2 text-sm font-semibold">{cat} <span className="text-muted">({list.length})</span></div><div className="flex flex-wrap gap-1.5">{list.map((n) => <span key={n} className="chip bg-ink/5 text-muted">{n}</span>)}</div></div>
          ))}
        </div>
      </section>
    </div>
  )
}
