// Omni TotalStack MSP — public sales site aimed at MSP owners. They pick a plan, pay, and get their own branded platform.
import { Link } from 'react-router-dom'
import {
  Check, ArrowRight, Plug, Bot, Landmark, ShieldCheck, Radar, FileSignature, Globe, Palette, Users, RefreshCw, Siren, PhoneCall,
  Target, Boxes, Receipt, Sun, Moon, Building2, Sparkles, Lock,
} from 'lucide-react'
import { OmniMark } from '../components/Logo'
import { PLANS, PLAN_ORDER, GRACE_DAYS, HANDOFF_DAYS } from '../../shared/plans'
import { MARKETPLACE_COUNT } from '../lib/integrations'
import { useStore } from '../lib/store'
import { cx } from '../components/ui'

const GROUPS = [
  { title: 'Win clients', icon: Sparkles, items: [
    [Globe, 'Your own branded website', 'Lead capture, online booking, pricing and a services map, live the minute you sign up.'],
    [PhoneCall, 'AI voice calls', 'Visitors tap "Call me now" and your AI assistant calls them within seconds and books the meeting.'],
    [FileSignature, 'Proposals that close', 'Answer plain-English questions and get three priced solutions. Huntress is built into every one. Then one click makes the RFS PDF.'],
  ] },
  { title: 'Run every network', icon: Radar, items: [
    [Siren, 'Outages & site health', 'UniFi and RMM status for every client site. "Network down" and expiring contracts show in red.'],
    [RefreshCw, 'Safe patching', 'Updates deploy only after 15 bug-free days, and clients get an automatic weekly update email.'],
    [ShieldCheck, 'Huntress, M365 & Entra ID', 'Agent coverage, incidents, MFA gaps, stale accounts and password rotation in one place.'],
  ] },
  { title: 'Get paid', icon: Landmark, items: [
    [Receipt, 'Drag-and-drop invoicing', 'Auto-fill agreements, billable tickets, project hours and hardware. Clients pay by ACH, card, Apple Pay or Google Pay.'],
    [Lock, 'Automatic non-payment notices', 'Late invoices generate a notice with contractor, owner, prime contractor, work, amount owed and last service date.'],
    [Landmark, 'QuickBooks & payroll', 'Profit per client and per service, MRR and ARR, payroll and compliance alerts.'],
  ] },
  { title: 'Grow with confidence', icon: Target, items: [
    [Target, 'QBRs & IT roadmaps', 'Alignment scores and a quarter-by-quarter plan your clients can see.'],
    [Users, 'Client portal', 'Your clients open tickets, pay invoices, track projects and download documents under your brand.'],
    [Bot, 'Claude AI assistant', 'Ask anything about your business; draft emails, QBR summaries and ticket fixes.'],
  ] },
] as const

export default function OmniHome() {
  const theme = useStore((s) => s.ui.theme)
  const setUI = useStore((s) => s.setUI)
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2"><OmniMark size={32} /><span className="h-display">Omni TotalStack <span className="text-muted">MSP</span></span></Link>
          <nav className="ml-4 hidden gap-5 text-sm text-muted md:flex"><a href="#features" className="hover:text-ink">Features</a><a href="#brand" className="hover:text-ink">Your brand</a><a href="#pricing" className="hover:text-ink">Pricing</a><a href="#faq" className="hover:text-ink">FAQ</a></nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setUI({ theme: theme === 'dark' ? 'light' : 'dark' })} className="rounded-xl p-2 hover:bg-ink/5" aria-label="Theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
            <Link to="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>
            <Link to="/signup?plan=business" className="btn-primary">Get started</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div className="animate-fadeUp">
          <span className="chip bg-accent/15 text-accent">For MSP owners · {MARKETPLACE_COUNT}+ integrations · AI built in</span>
          <h1 className="mt-4 h-display text-4xl leading-[1.08] md:text-6xl">Run your entire MSP from <span className="gradient-text">one command center.</span></h1>
          <p className="mt-5 max-w-xl text-lg text-muted">Omni TotalStack MSP gives you a branded website that wins clients, proposals that close, RMM, Huntress, Microsoft 365, UniFi, invoicing, payroll and a client portal, all in one place. It's simple enough for your first technician.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/signup?plan=business" className="btn-primary px-5 py-3 text-base">Get started <ArrowRight size={17} /></Link>
            <a href="#pricing" className="btn-ghost px-5 py-3 text-base">See pricing</a>
            <Link to="/m/demo" className="btn-ghost px-5 py-3 text-base">View a sample MSP site</Link>
          </div>
          <p className="mt-4 text-sm text-muted">Monthly plans from $99. Or own it outright with Enterprise. Your workspace activates the moment you check out.</p>
        </div>
        <AppPreview />
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="mb-2 text-center h-display text-3xl md:text-4xl">Everything a new MSP needs, <span className="gradient-text">already connected</span></h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-muted">Stop stitching together ten subscriptions. Omni ties them into one workflow: a ticket marked billable lands on the next invoice, a received order becomes inventory, and a new device on the network shows up in your documentation.</p>
        <div className="grid gap-6 lg:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title} className="glass p-6">
              <div className="mb-4 flex items-center gap-2 font-semibold"><g.icon size={18} className="text-accent" />{g.title}</div>
              <div className="space-y-4">
                {g.items.map(([I, t, d]) => { const Icon = I as typeof Plug; return (
                  <div key={t as string} className="flex gap-3"><div className="h-fit rounded-xl bg-accent/10 p-2 text-accent"><Icon size={17} /></div><div><div className="font-medium">{t as string}</div><p className="text-sm text-muted">{d as string}</p></div></div>
                ) })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="brand" className="mx-auto max-w-7xl px-4 py-16">
        <div className="glass grid gap-8 p-8 md:grid-cols-2 md:p-10">
          <div>
            <span className="chip bg-accent2/15 text-accent2"><Palette size={13} /> White-label</span>
            <h2 className="mt-3 h-display text-3xl">Your brand. Your clients. Not ours.</h2>
            <p className="mt-3 text-muted">Every Omni account gets its own branded platform. Your clients see your name, logo and colors on your website, client portal, proposals, RFS, invoices, receipts, weekly update emails and notices. Omni stays behind the scenes.</p>
            <ul className="mt-5 space-y-2 text-sm">
              {['Your web address: yourcompany.omnitotalstack.com', 'Or connect your own domain (Business), or run your own standalone copy (Enterprise)', 'Your rates, payment terms, tax and patch policy', 'Your own Stripe account, so client payments go straight to you', 'Your own RMM, Huntress, Microsoft 365 and QuickBooks keys, never shared'].map((x) => <li key={x} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-ok" />{x}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted">How rollout works</div>
            <ol className="mt-3 space-y-4">
              {[
                ['Choose a plan and check out', 'Stripe handles payment securely: monthly for Unlimited and Business, one payment for Enterprise.'],
                ['Your workspace goes live instantly', 'Your Command Center, public website and client portal are created the moment payment clears.'],
                ['Brand it in the setup wizard', 'Upload your logo, pick colors, and set your address, rates and policies. It takes about 2 minutes.'],
                ['Invite your team and clients', 'Technicians get the Command Center; clients get the portal with their tickets, invoices and documents.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-xs font-bold text-white dark:text-black">{i + 1}</span><div><div className="font-medium">{t}</div><p className="text-sm text-muted">{d}</p></div></li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="mb-2 text-center h-display text-3xl md:text-4xl">Simple pricing that grows with you</h2>
        <p className="mb-10 text-center text-muted">Rent it monthly and cancel anytime, or buy Enterprise once and own your own copy forever.</p>
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id]
            const pop = id === 'business'
            return (
              <div key={id} className={cx('glass relative flex flex-col p-6', pop && 'shadow-glow ring-1 ring-accent')}>
                {pop && <span className="absolute -top-3 left-1/2 -translate-x-1/2 chip bg-accent text-white dark:text-black">Most popular</span>}
                {p.billing === 'one_time' && <span className="absolute -top-3 left-1/2 -translate-x-1/2 chip bg-accent2 text-white dark:text-black">Own it forever</span>}
                <div className="h-display text-xl">{p.name}</div>
                <div className="mt-2"><span className="h-display text-4xl">${p.price.toLocaleString()}</span><span className="text-muted">{p.billing === 'one_time' ? ' one-time' : '/mo'}</span></div>
                <p className="mt-1 text-sm text-muted">{p.blurb}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">{p.highlights.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-ok" />{f}</li>)}</ul>
                <Link to={`/signup?plan=${id}`} className={cx('mt-5', pop ? 'btn-primary' : 'btn-ghost')}>{p.billing === 'one_time' ? `Buy Enterprise` : `Start ${p.name}`}</Link>
              </div>
            )
          })}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-6 text-center h-display text-3xl">Questions</h2>
        {[
          ['What happens right after I pay?', 'Your workspace, branded website and client portal are created automatically. Sign in and the setup wizard walks you through your logo, colors, business details and first client.'],
          ['How is Enterprise different?', `Enterprise is a one-time $${PLANS.enterprise.price.toLocaleString()} purchase with no monthly fees. You get your own standalone copy of Omni on your own domain and your own hosting accounts, fully disconnected from the Omni platform. You buy the domain; your data is moved over, and your hosted workspace stays online for ${HANDOFF_DAYS} days while you switch.`],
          ['What if a payment fails?', `We email you right away, and everything keeps working for ${GRACE_DAYS} days while you update your card. After that, your Command Center, website and client portal pause until payment goes through. Your data is kept safe, and paying reactivates everything instantly.`],
          ['Do my clients see the Omni name?', 'No. Your website, portal, proposals, invoices and emails carry your brand. A small "Powered by Omni" note appears in the website footer.'],
          ['Whose Stripe, RMM and Huntress accounts are used?', "Yours. Each MSP connects its own accounts, and keys are encrypted and never shared between businesses. Client payments go straight to your Stripe account."],
          ['Can my technicians and clients log in?', 'Yes. Invite technicians, admins and finance staff to the Command Center (seat limits depend on your plan), and invite client contacts to your branded portal at no extra cost.'],
          ['Can I switch plans or cancel?', 'Any time, from Billing inside the app. Upgrades are prorated automatically.'],
        ].map(([q, a]) => <details key={q} className="glass mb-3 p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm text-muted">{a}</p></details>)}
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="glass flex flex-col items-center gap-4 p-10 text-center">
          <Building2 className="text-accent" size={32} />
          <h2 className="h-display text-3xl">Launch your MSP this week.</h2>
          <Link to="/signup?plan=business" className="btn-primary px-6 py-3 text-base">Get started <ArrowRight size={17} /></Link>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        <div className="mb-2 flex items-center justify-center gap-2"><OmniMark size={20} /> Omni TotalStack MSP</div>
        <Link to="/login" className="hover:text-accent">Sign in</Link> · <a href="#pricing" className="hover:text-accent">Pricing</a> · <Link to="/m/demo" className="hover:text-accent">Sample MSP site</Link>
      </footer>
    </div>
  )
}

function AppPreview() {
  return (
    <div className="glass relative overflow-hidden p-4 shadow-glow" aria-hidden>
      <div className="mb-3 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-bad/70" /><span className="h-2.5 w-2.5 rounded-full bg-warn/70" /><span className="h-2.5 w-2.5 rounded-full bg-ok/70" /><span className="ml-3 text-xs text-muted">yourmsp.omnitotalstack.com/app</span></div>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-bad/40 bg-bad/10 p-2.5 text-xs"><Siren size={14} className="text-bad" /><b className="text-bad">1 site DOWN</b><span className="text-muted">Copperline — Decatur · gateway unreachable</span></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['MRR', '$12,725'], ['Overdue', '$7,855'], ['Open tickets', '5'], ['Patches ready', '1']].map(([k, v], i) => (
          <div key={k} className="rounded-xl border border-line bg-panel p-2.5"><div className="text-[10px] uppercase tracking-wide text-muted">{k}</div><div className={cx('h-display text-lg', i === 1 && 'text-bad')}>{v}</div></div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-3 text-xs">
          <div className="mb-2 font-semibold">Proposal · 3 options</div>
          {[['Essential', '$1,179/mo'], ['Advanced', '$2,007/mo'], ['Premium', '$2,824/mo']].map(([t, p], i) => <div key={t} className={cx('mb-1 flex justify-between rounded-lg px-2 py-1', i === 1 && 'bg-accent/15 text-accent')}><span>{t}</span><span>{p}</span></div>)}
          <div className="mt-2 flex items-center gap-1 text-accent2"><ShieldCheck size={12} /> Huntress included (required)</div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-3 text-xs">
          <div className="mb-2 font-semibold">Contracts expiring</div>
          {[['Huntress EDR + SAT', '18d left'], ['harborpine.com domain', '9d left'], ['Comcast Business', 'expired']].map(([t, d]) => <div key={t} className="mb-1 flex justify-between text-bad"><span className="text-ink">{t}</span><span>{d}</span></div>)}
          <div className="mt-2 flex items-center gap-1 text-muted"><Boxes size={12} /> 4 low-stock items</div>
        </div>
      </div>
    </div>
  )
}
