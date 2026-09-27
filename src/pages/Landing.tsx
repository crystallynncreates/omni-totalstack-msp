// Public marketing site for the MSP: lead capture, AI voice call, appointment booking, pricing, services map.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, Headphones, Wifi, Cloud, HardDrive, Scale, Phone, Truck, Target, Workflow, HeartPulse, Printer, Cable, GraduationCap,
  PhoneCall, CalendarCheck, Check, ArrowRight, Sun, Moon, Menu, X, Star, Bot, Lock,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useBrand } from '../lib/brand'
import { api } from '../lib/api'
import { uid, iso, addDays, money } from '../lib/format'
import { CATALOG } from '../lib/proposalEngine'
import { Modal, Toaster, toast, cx } from '../components/ui'
import Logo from '../components/Logo'

export const SERVICES = [
  { icon: Headphones, name: 'Managed IT & Helpdesk', text: 'Unlimited remote support, proactive monitoring and a real person who answers.' },
  { icon: ShieldCheck, name: 'Cybersecurity (24/7 SOC)', text: 'Huntress managed detection & response on every device and Microsoft 365 account.' },
  { icon: Wifi, name: 'Network & Wi-Fi', text: 'Business firewalls, fast segmented Wi-Fi and instant outage alerts.' },
  { icon: Cloud, name: 'Microsoft 365 & Cloud', text: 'Licensing, email, Teams, SharePoint, Intune and secure migrations.' },
  { icon: HardDrive, name: 'Backup & Disaster Recovery', text: 'Tested backups and instant recovery so ransomware never wins.' },
  { icon: Scale, name: 'Compliance', text: 'HIPAA, PCI, FTC Safeguards and cyber-insurance readiness.' },
  { icon: Phone, name: 'VoIP & Communications', text: 'Cloud phones, Teams calling and reliable conferencing.' },
  { icon: Truck, name: 'Hardware & Procurement', text: 'Right-sized equipment at fair prices, delivered and set up.' },
  { icon: Target, name: 'IT Strategy (vCIO)', text: 'Quarterly business reviews and a clear technology roadmap.' },
  { icon: Workflow, name: 'Process Improvement', text: 'We map your workflows and automate the busywork away.' },
  { icon: HeartPulse, name: 'Business Health', text: 'A scorecard of your security, uptime, spend and risk — every quarter.' },
  { icon: Printer, name: 'Print Services', text: 'Managed printers, automatic toner delivery and fast repairs.' },
  { icon: Cable, name: 'Projects & Cabling', text: 'Office moves, structured cabling, rack cleanups and upgrades.' },
  { icon: GraduationCap, name: 'Security Training', text: 'Short, engaging training and phishing tests for your team.' },
]

const PLANS = [
  { name: 'Essential', sku: 'MSP-ESS', tag: 'Secure foundation', features: ['Remote helpdesk (business hours)', 'Monitoring & patching (15-day stability rule)', 'Huntress 24/7 EDR + ITDR', 'Security awareness training', 'Microsoft 365 backup', 'Network outage alerts'] },
  { name: 'Advanced', sku: 'MSP-ADV', tag: 'Most popular', features: ['Everything in Essential', 'Onsite support included', 'Email & web filtering', 'Managed firewall & Wi-Fi', 'Endpoint backup', 'Quarterly business reviews', 'Managed print'] },
  { name: 'Premium', sku: 'MSP-PRE', tag: 'Total resilience', features: ['Everything in Advanced', '24x7 helpdesk & unlimited onsite', 'Huntress SIEM for compliance', 'BCDR with instant recovery', 'Internet failover', 'Monthly vCIO & process improvement'] },
]

const INTERESTS = ['Managed IT', 'Cybersecurity', 'Network & Wi-Fi', 'Microsoft 365', 'Backup', 'Compliance', 'Process Improvement', 'Business Health', 'Print Services', 'Hardware']

export default function Landing() {
  const { company, base, slug, demo } = useBrand()
  const theme = useStore((s) => s.ui.theme)
  const setUI = useStore((s) => s.setUI)
  const add = useStore((s) => s.add)
  const notify = useStore((s) => s.notify)
  const [menu, setMenu] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [lead, setLead] = useState({ name: '', email: '', phone: '', company: '', employees: '1-10', message: '', interest: [] as string[] })
  const [sent, setSent] = useState(false)

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault()
    const l = { id: uid('l'), ...lead, source: 'website' as const, status: 'new' as const, createdAt: iso() }
    if (demo) {
      add('leads', l)
      notify('info', `New website lead: ${lead.name} (${lead.company})`, '/app/leads')
    } else {
      const r = await api('leads', { ...l, slug })
      if (!r.ok) return toast(r.error || 'Something went wrong — please call us instead.', 'bad')
    }
    setSent(true)
    toast('Thanks! We will be in touch within one business day.')
  }

  return (
    <div className="min-h-full">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <a href="#top" className="flex items-center gap-2"><Logo size={32} /><span className="h-display">{company.name}</span></a>
          <nav className="ml-6 hidden gap-5 text-sm text-muted md:flex">
            <a href="#services" className="hover:text-ink">Services</a><a href="#how" className="hover:text-ink">How it works</a><a href="#pricing" className="hover:text-ink">Pricing</a><a href="#book" className="hover:text-ink">Book a call</a>
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <button onClick={() => setUI({ theme: theme === 'dark' ? 'light' : 'dark' })} className="rounded-xl p-2 hover:bg-ink/5" aria-label="Theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
            <Link to={`${base}/portal`} className="btn-ghost">Client portal</Link>
            <button onClick={() => setCallOpen(true)} className="btn-primary"><PhoneCall size={15} /> Call me now</button>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X /> : <Menu />}</button>
        </div>
        {menu && (
          <div className="flex flex-col gap-2 border-t border-line px-4 py-3 text-sm md:hidden">
            <a href="#services" onClick={() => setMenu(false)}>Services</a><a href="#pricing" onClick={() => setMenu(false)}>Pricing</a><a href="#book" onClick={() => setMenu(false)}>Book a call</a>
            <Link to={`${base}/portal`}>Client portal</Link>
            <button onClick={() => setCallOpen(true)} className="btn-primary">Call me now</button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fadeUp">
            <span className="chip bg-accent/15 text-accent"><ShieldCheck size={13} /> 24/7 Huntress SOC included on every plan</span>
            <h1 className="mt-4 h-display text-4xl leading-[1.1] md:text-6xl">IT that runs itself.<br /><span className="gradient-text">Security that never sleeps.</span></h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{company.name} manages your computers, network, Microsoft 365 and cybersecurity for one predictable monthly price — so you can run your business, not your tech.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#assessment" className="btn-primary px-5 py-3 text-base">Get a free assessment <ArrowRight size={17} /></a>
              <button onClick={() => setCallOpen(true)} className="btn-ghost px-5 py-3 text-base"><Bot size={17} /> Have our AI call you in 60s</button>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-muted">
              <div className="flex text-warn">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} fill="currentColor" />)}</div>
              Local, responsive, and proactive support
            </div>
          </div>
          <ServicesMap />
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-10 text-center">
          <h2 className="h-display text-3xl md:text-4xl">Everything your business needs. <span className="gradient-text">One partner.</span></h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">From the helpdesk to the boardroom — including process improvement, business health reviews and print services.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <div key={s.name} className="glass group p-5 transition hover:-translate-y-1 hover:shadow-glow">
              <div className="mb-3 w-fit rounded-xl bg-gradient-to-br from-accent/20 to-accent2/20 p-2.5 text-accent"><s.icon size={20} /></div>
              <div className="font-semibold">{s.name}</div>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="mb-10 text-center h-display text-3xl">How it works</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['Free assessment', 'We scan your network and review security, backups and Microsoft 365 — no cost, no obligation.'],
            ['Three clear options', 'You get a formal proposal with Essential, Advanced and Premium solutions and exact pricing.'],
            ['Onboard in ~2 weeks', 'We document everything, deploy protection and fix the urgent issues first.'],
            ['Proactive management', 'Monitoring, safe updates (15-day stability rule), weekly update emails and quarterly reviews.'],
          ].map(([t, d], i) => (
            <div key={t} className="glass p-5">
              <div className="h-display text-3xl gradient-text">0{i + 1}</div>
              <div className="mt-2 font-semibold">{t}</div>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-10 text-center">
          <h2 className="h-display text-3xl md:text-4xl">Simple, per-user pricing</h2>
          <p className="mt-3 text-muted">Every plan includes Huntress 24/7 managed security. No surprise bills.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <div key={p.name} className={cx('glass relative flex flex-col p-6', i === 1 && 'shadow-glow ring-1 ring-accent')}>
              {i === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 chip bg-accent text-white dark:text-black">Most popular</span>}
              <div className="text-sm text-muted">{p.tag}</div>
              <div className="h-display text-2xl">{p.name}</div>
              <div className="mt-3"><span className="h-display text-4xl">{money(CATALOG[p.sku].price)}</span><span className="text-muted"> /user/mo</span></div>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-ok" />{f}</li>)}
              </ul>
              <a href="#assessment" className={cx('mt-6', i === 1 ? 'btn-primary' : 'btn-ghost')}>Get started</a>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted">Servers, hardware and projects quoted separately.</p>
      </section>

      {/* Assessment + Booking */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 lg:grid-cols-2">
        <div id="assessment" className="glass p-6">
          <h2 className="h-display text-2xl">Free security & network assessment</h2>
          <p className="mt-1 text-sm text-muted">Tell us a little about your business. We'll reply within one business day.</p>
          {sent ? (
            <div className="mt-6 rounded-xl bg-ok/10 p-5 text-ok"><Check className="mb-2" /> Request received! Want to talk sooner? Book a time on the right or tap "Call me now".</div>
          ) : (
            <form onSubmit={submitLead} className="mt-5 grid gap-3 sm:grid-cols-2">
              <input required className="input" placeholder="Your name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
              <input required className="input" placeholder="Company" value={lead.company} onChange={(e) => setLead({ ...lead, company: e.target.value })} />
              <input required type="email" className="input" placeholder="Email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
              <input className="input" placeholder="Phone" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
              <select className="input sm:col-span-2" value={lead.employees} onChange={(e) => setLead({ ...lead, employees: e.target.value })}>
                {['1-10', '11-25', '26-50', '51-100', '100+'].map((x) => <option key={x}>{x} employees</option>)}
              </select>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {INTERESTS.map((i) => {
                  const on = lead.interest.includes(i)
                  return <button type="button" key={i} onClick={() => setLead({ ...lead, interest: on ? lead.interest.filter((x) => x !== i) : [...lead.interest, i] })} className={cx('chip border px-3 py-1', on ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted')}>{i}</button>
                })}
              </div>
              <textarea className="input sm:col-span-2" rows={3} placeholder="What's going on? (optional)" value={lead.message} onChange={(e) => setLead({ ...lead, message: e.target.value })} />
              <button className="btn-primary sm:col-span-2 py-3">Request my free assessment</button>
              <p className="flex items-center gap-1.5 text-xs text-muted sm:col-span-2"><Lock size={12} /> We never sell your information.</p>
            </form>
          )}
        </div>
        <Booking />
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-6 text-center h-display text-3xl">Questions</h2>
        {[
          ['Why is Huntress required?', 'Antivirus alone no longer stops modern attacks. Huntress puts a 24/7 human-staffed Security Operations Center behind every device and Microsoft 365 login. We include it in every plan because we will not manage an unprotected network.'],
          ['Will updates break my computers?', 'We wait until every update has been bug-free for 15 days before installing it, then email you a weekly summary of what was updated.'],
          ['Do I have to sign a long contract?', 'Plans are month-to-month after a short initial term. We earn your business every month.'],
          ['What if my internet goes down?', 'We are alerted instantly and start working on it, often before you notice. Premium plans include automatic 5G/LTE failover.'],
        ].map(([q, a]) => (
          <details key={q} className="glass mb-3 p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm text-muted">{a}</p></details>
        ))}
      </section>

      <footer className="border-t border-line py-10 text-center text-sm text-muted">
        <div className="mb-2 flex items-center justify-center gap-2"><Logo size={22} /> {company.legalName}</div>
        {company.address}, {company.city}, {company.state} {company.zip} · {company.phone} · {company.email}
        <div className="mt-3"><Link to={`${base}/portal`} className="hover:text-accent">Client portal</Link> · <Link to="/login" className="hover:text-accent">Team sign-in</Link></div>
        <div className="mt-2 text-xs">Powered by <Link to="/" className="hover:text-accent">Omni TotalStack MSP</Link></div>
      </footer>

      {/* Floating AI call button */}
      <button onClick={() => setCallOpen(true)} className="btn-primary fixed bottom-5 right-5 z-40 rounded-full px-5 py-3 shadow-glow"><PhoneCall size={17} /> Talk to us now</button>
      <AICallModal open={callOpen} onClose={() => setCallOpen(false)} />
      <Toaster />
    </div>
  )
}

function ServicesMap() {
  const ring = SERVICES.slice(0, 12)
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <defs><radialGradient id="glow"><stop offset="0" stopColor="rgb(var(--accent))" stopOpacity=".35" /><stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" /></radialGradient></defs>
        <circle cx="200" cy="200" r="190" fill="url(#glow)" />
        <circle cx="200" cy="200" r="150" fill="none" stroke="rgb(var(--line))" strokeDasharray="4 6" />
        {ring.map((_, i) => {
          const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2
          return <line key={i} x1="200" y1="200" x2={200 + Math.cos(a) * 150} y2={200 + Math.sin(a) * 150} stroke="rgb(var(--accent) / .25)" />
        })}
      </svg>
      <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-center text-xs font-semibold text-white shadow-glow dark:text-black">
        <div><Logo size={30} /><div className="mt-1">Your business</div></div>
      </div>
      {ring.map((s, i) => {
        const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2
        return (
          <div key={s.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${50 + Math.cos(a) * 37.5}%`, top: `${50 + Math.sin(a) * 37.5}%` }}>
            <div className="glass flex w-[92px] flex-col items-center gap-1 bg-panel p-2 text-center text-[10px] font-medium leading-tight transition hover:scale-110 hover:shadow-glow">
              <s.icon size={16} className="text-accent" />{s.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Booking() {
  const { slug, demo } = useBrand()
  const add = useStore((s) => s.add)
  const notify = useStore((s) => s.notify)
  const days = useMemo(() => {
    const out: Date[] = []
    let d = addDays(new Date(), 1)
    while (out.length < 10) { if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d)); d = addDays(d, 1) }
    return out
  }, [])
  const [day, setDay] = useState(0)
  const [slot, setSlot] = useState<string>('')
  const [f, setF] = useState({ name: '', email: '', phone: '', topic: 'Free IT consultation (30 min)' })
  const [done, setDone] = useState(false)
  const slots = ['9:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']

  const book = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slot) return toast('Pick a time first', 'warn')
    const [h, m] = slot.split(':').map(Number)
    const start = new Date(days[day]); start.setHours(h, m, 0, 0)
    const leadId = uid('l')
    if (demo) {
      add('leads', { id: leadId, name: f.name, email: f.email, phone: f.phone, company: '', interest: [], message: f.topic, source: 'booking', status: 'new', createdAt: iso() })
      add('appointments', { id: uid('a'), leadId, name: f.name, email: f.email, phone: f.phone, start: start.toISOString(), topic: f.topic, status: 'booked' })
      notify('info', `New appointment booked: ${f.name} on ${start.toLocaleString()}`, '/app/leads')
    } else {
      const r = await api('book', { ...f, slug, start: start.toISOString() })
      if (!r.ok) return toast(r.error || 'Booking failed — please call us.', 'bad')
    }
    setDone(true)
  }

  return (
    <div id="book" className="glass p-6">
      <h2 className="flex items-center gap-2 h-display text-2xl"><CalendarCheck className="text-accent" /> Book a consultation</h2>
      <p className="mt-1 text-sm text-muted">30 minutes. No pressure. Pick a time that works.</p>
      {done ? (
        <div className="mt-6 rounded-xl bg-ok/10 p-5 text-ok"><Check className="mb-2" /> You're booked! A calendar invite is on its way to {f.email}.</div>
      ) : (
        <form onSubmit={book}>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {days.map((d, i) => (
              <button type="button" key={i} onClick={() => { setDay(i); setSlot('') }} className={cx('shrink-0 rounded-xl border px-3 py-2 text-center text-xs', i === day ? 'border-accent bg-accent/10 text-accent' : 'border-line')}>
                <div className="font-semibold">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {slots.map((s) => {
              const [h] = s.split(':').map(Number)
              return <button type="button" key={s} onClick={() => setSlot(s)} className={cx('rounded-lg border py-2 text-xs', slot === s ? 'border-accent bg-accent text-white dark:text-black' : 'border-line hover:border-accent')}>{((h + 11) % 12) + 1}:00 {h < 12 ? 'AM' : 'PM'}</button>
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input required className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input required type="email" className="input" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className="input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <select className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
              {['Free IT consultation (30 min)', 'Cybersecurity review', 'Network / Wi-Fi problems', 'Microsoft 365 help', 'Process improvement', 'Print services'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn-primary mt-4 w-full py-3">Confirm booking</button>
        </form>
      )}
    </div>
  )
}

function AICallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { slug, demo } = useBrand()
  const add = useStore((s) => s.add)
  const notify = useStore((s) => s.notify)
  const [f, setF] = useState({ name: '', phone: '', company: '', consent: false })
  const [state, setState] = useState<'form' | 'calling' | 'queued'>('form')
  const call = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('calling')
    const lead = { id: uid('l'), name: f.name, email: '', phone: f.phone, company: f.company, interest: [], message: 'Requested an AI call from the website', source: 'ai_call' as const, status: 'new' as const, createdAt: iso(), callRequested: true }
    if (demo) {
      add('leads', lead)
      notify('info', `AI call requested by ${f.name} (${f.phone})`, '/app/leads')
    } else await api('leads', { ...lead, slug })
    const r = await api('voice/call', { name: f.name, phone: f.phone, company: f.company, slug })
    setState(r.ok ? 'calling' : 'queued')
  }
  return (
    <Modal open={open} onClose={() => { onClose(); setState('form') }} title={<span className="flex items-center gap-2"><Bot size={18} className="text-accent" /> Get a call in 60 seconds</span>}>
      {state === 'form' && (
        <form onSubmit={call} className="space-y-3">
          <p className="text-sm text-muted">Our AI assistant will call you, answer questions about our services, and book a time with a technician if you'd like.</p>
          <input required className="input" placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input required className="input" placeholder="Mobile number" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <input className="input" placeholder="Company (optional)" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
          <label className="flex gap-2 text-xs text-muted"><input type="checkbox" required checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} /> I agree to receive an automated call from an AI assistant at this number. Message & data rates may apply.</label>
          <button className="btn-primary w-full py-3"><PhoneCall size={16} /> Call me now</button>
        </form>
      )}
      {state === 'calling' && <div className="py-6 text-center"><PhoneCall className="mx-auto animate-pulse text-accent" size={40} /><p className="mt-3 font-medium">Calling {f.phone}…</p><p className="text-sm text-muted">Pick up — it's us!</p></div>}
      {state === 'queued' && <div className="py-6 text-center"><Check className="mx-auto text-ok" size={40} /><p className="mt-3 font-medium">You're in the queue, {f.name}.</p><p className="text-sm text-muted">We'll call {f.phone} shortly.</p></div>}
    </Modal>
  )
}
