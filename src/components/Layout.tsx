import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, Magnet, FileSignature, Landmark, UserCog, Truck, Target, Building2, Radar, RefreshCw, ShieldCheck,
  Ticket, FolderKanban, Boxes, BookOpen, Wrench, Plug, Bot, Settings, Search, Bell, Sun, Moon, CircleHelp, Sparkles, Menu, X, LogOut, ExternalLink,
} from 'lucide-react'
import { useStore, APP_VERSION } from '../lib/store'
import { cx, Toaster } from './ui'
import { Tour, WhatsNew } from './Tour'
import SetupWizard from './SetupWizard'
import { timeAgo } from '../lib/format'
import Logo from './Logo'

export const NAV = [
  { group: 'Business Suite', items: [
    { to: '/app', label: 'Command Center', icon: LayoutDashboard, tour: 'nav-home', end: true },
    { to: '/app/clients', label: 'Clients', icon: Users, tour: 'nav-clients' },
    { to: '/app/leads', label: 'Leads & Bookings', icon: Magnet, tour: 'nav-leads' },
    { to: '/app/proposals', label: 'Proposals & RFS', icon: FileSignature, tour: 'nav-proposals' },
    { to: '/app/finance', label: 'Finance', icon: Landmark, tour: 'nav-finance' },
    { to: '/app/employees', label: 'Employees & Payroll', icon: UserCog, tour: 'nav-employees' },
    { to: '/app/procurement', label: 'Procurement', icon: Truck, tour: 'nav-procurement' },
    { to: '/app/strategy', label: 'IT Strategy & QBR', icon: Target, tour: 'nav-strategy' },
  ] },
  { group: 'Management Hub', items: [
    { to: '/app/infrastructure', label: 'Sites & Infrastructure', icon: Building2, tour: 'nav-infrastructure' },
    { to: '/app/discovery', label: 'Network Discovery', icon: Radar, tour: 'nav-discovery' },
    { to: '/app/patching', label: 'Patching & Updates', icon: RefreshCw, tour: 'nav-patching' },
    { to: '/app/security', label: 'Security (Huntress)', icon: ShieldCheck, tour: 'nav-security' },
    { to: '/app/operations', label: 'Tickets & SLA', icon: Ticket, tour: 'nav-operations' },
    { to: '/app/projects', label: 'Projects', icon: FolderKanban, tour: 'nav-projects' },
    { to: '/app/inventory', label: 'Inventory', icon: Boxes, tour: 'nav-inventory' },
    { to: '/app/documentation', label: 'Documentation', icon: BookOpen, tour: 'nav-documentation' },
    { to: '/app/tools', label: 'Tools', icon: Wrench, tour: 'nav-tools' },
  ] },
  { group: 'System', items: [
    { to: '/app/integrations', label: 'Integrations', icon: Plug, tour: 'nav-integrations' },
    { to: '/app/assistant', label: 'AI Assistant', icon: Bot, tour: 'nav-assistant' },
    { to: '/app/admin', label: 'Admin', icon: Settings, tour: 'nav-admin' },
  ] },
]

function GlobalSearch() {
  const [q, setQ] = useState('')
  const s = useStore()
  const nav = useNavigate()
  const results = useMemo(() => {
    if (q.trim().length < 2) return []
    const t = q.toLowerCase()
    const r: { label: string; sub: string; to: string }[] = []
    s.clients.forEach((c) => (c.name + c.group).toLowerCase().includes(t) && r.push({ label: c.name, sub: 'Client · ' + c.group, to: `/app/clients/${c.id}` }))
    s.devices.forEach((d) => (d.hostname + d.ip).toLowerCase().includes(t) && r.push({ label: d.hostname, sub: `Device · ${d.ip}`, to: `/app/clients/${d.clientId}?tab=assets` }))
    s.documents.forEach((d) => d.name.toLowerCase().includes(t) && r.push({ label: d.name, sub: 'Document · ' + d.category, to: `/app/clients/${d.clientId}?tab=documents` }))
    s.tickets.forEach((d) => (d.title + d.number).toLowerCase().includes(t) && r.push({ label: `#${d.number} ${d.title}`, sub: 'Ticket', to: `/app/operations` }))
    s.invoices.forEach((d) => d.number.toLowerCase().includes(t) && r.push({ label: d.number, sub: 'Invoice', to: `/app/finance?tab=invoices` }))
    s.contracts.forEach((d) => d.name.toLowerCase().includes(t) && r.push({ label: d.name, sub: 'Contract', to: `/app/clients/${d.clientId}?tab=contracts` }))
    return r.slice(0, 10)
  }, [q, s])
  return (
    <div className="relative w-full max-w-md" data-tour="search">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients, devices, docs, tickets…" className="input pl-9" />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-line bg-panel shadow-soft">
          {results.map((r, i) => (
            <button key={i} onClick={() => { nav(r.to); setQ('') }} className="block w-full px-3 py-2 text-left hover:bg-accent/10">
              <div className="text-sm">{r.label}</div><div className="text-xs text-muted">{r.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const items = useStore((s) => s.notifications)
  const update = useStore((s) => s.update)
  const unread = items.filter((n) => !n.read).length
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative rounded-xl p-2 hover:bg-ink/5" aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-line bg-panel shadow-soft">
          <div className="border-b border-line px-3 py-2 text-sm font-semibold">Alerts</div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <div className="p-4 text-sm text-muted">You're all caught up.</div>}
            {items.map((n) => (
              <Link key={n.id} to={n.href || '#'} onClick={() => { update('notifications', n.id, { read: true }); setOpen(false) }} className={cx('block border-b border-line/60 px-3 py-2.5 text-sm hover:bg-accent/5', !n.read && 'bg-accent/5')}>
                <span className={cx('mr-2 inline-block h-2 w-2 rounded-full', n.level === 'bad' ? 'bg-bad' : n.level === 'warn' ? 'bg-warn' : n.level === 'ok' ? 'bg-ok' : 'bg-accent')} />
                {n.text}<div className="mt-0.5 text-xs text-muted">{timeAgo(n.at)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const ui = useStore((s) => s.ui)
  const company = useStore((s) => s.company)
  const setUI = useStore((s) => s.setUI)
  const [mobile, setMobile] = useState(false)
  const [tour, setTour] = useState(false)
  const [whatsNew, setWhatsNew] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()

  useEffect(() => setMobile(false), [loc.pathname])
  useEffect(() => {
    if (!ui.signedIn) nav('/login')
  }, [ui.signedIn, nav])
  useEffect(() => {
    // First login → setup wizard → tour. Later versions → "What's new".
    if (ui.setupDone && !ui.tourDone) setTour(true)
    else if (ui.setupDone && ui.tourDone && ui.lastSeenVersion !== APP_VERSION) setWhatsNew(true)
  }, [ui.setupDone, ui.tourDone, ui.lastSeenVersion])

  return (
    <div className="flex min-h-full">
      <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-line bg-panel/80 backdrop-blur-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0', mobile ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center justify-between px-4 py-4">
          <Link to="/app" className="flex items-center gap-2"><Logo size={30} /><div className="leading-tight"><div className="h-display text-sm">{company.name}</div><div className="text-[10px] uppercase tracking-widest text-muted">Command Center</div></div></Link>
          <button className="lg:hidden" onClick={() => setMobile(false)}><X size={18} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.group} className="mt-3">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">{g.group}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} data-tour={i.tour} className={({ isActive }) => cx('group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition', isActive ? 'bg-gradient-to-r from-accent/20 to-accent2/10 font-medium text-ink shadow-glow' : 'text-muted hover:bg-ink/5 hover:text-ink')}>
                  <i.icon size={17} className="shrink-0" /> {i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3 text-xs text-muted">
          <Link to="/" target="_blank" className="mb-2 flex items-center gap-1.5 hover:text-accent"><ExternalLink size={13} /> View public landing page</Link>
          v{APP_VERSION} · {ui.demoMode ? 'Demo data' : 'Live workspace'}
        </div>
      </aside>
      {mobile && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/70 px-4 py-2.5 backdrop-blur-xl">
          <button className="lg:hidden" onClick={() => setMobile(true)} aria-label="Menu"><Menu size={20} /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setWhatsNew(true)} className="hidden items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm text-muted hover:bg-ink/5 sm:flex" title="What's new"><Sparkles size={16} /> What's new</button>
            <button onClick={() => setTour(true)} className="rounded-xl p-2 hover:bg-ink/5" title="Take the tour" aria-label="Help tour" data-tour="help"><CircleHelp size={18} /></button>
            <button onClick={() => setUI({ theme: ui.theme === 'dark' ? 'light' : 'dark' })} className="rounded-xl p-2 hover:bg-ink/5" title="Light / dark" aria-label="Toggle theme">{ui.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <Notifications />
            <button onClick={() => setUI({ signedIn: false })} className="rounded-xl p-2 hover:bg-ink/5" title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
          </div>
        </header>
        {ui.demoMode && (
          <div className="no-print border-b border-accent/20 bg-accent/5 px-4 py-1.5 text-center text-xs text-muted">
            You're exploring with <b className="text-ink">demo data</b> — nothing here is real. Go to <Link className="text-accent underline" to="/app/admin">Admin → Workspace</Link> to start fresh with your own clients.
          </div>
        )}
        <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 md:p-6"><Outlet /></main>
      </div>

      {!ui.setupDone && <SetupWizard />}
      {tour && <Tour onDone={() => { setTour(false); setUI({ tourDone: true, lastSeenVersion: APP_VERSION }) }} />}
      {whatsNew && <WhatsNew onClose={() => { setWhatsNew(false); setUI({ lastSeenVersion: APP_VERSION }) }} onTour={() => { setWhatsNew(false); setUI({ lastSeenVersion: APP_VERSION }); setTour(true) }} />}
      <Toaster />
    </div>
  )
}
