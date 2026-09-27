import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'

// VITE_HASH_ROUTER=1 builds a portable version (hash URLs) that runs from any static host or preview link.
const Router = import.meta.env.VITE_HASH_ROUTER === '1' ? HashRouter : BrowserRouter
import { useStore } from './lib/store'
import { supabase } from './lib/supabase'
import { bootstrap, cloudEnabled } from './lib/cloud'
import { FeatureGate } from './components/Gate'
import { setLimitHandler } from './lib/store'
import { onWriteError } from './lib/cloud'
import { toast } from './components/ui'
import Layout from './components/Layout'

const OmniHome = lazy(() => import('./pages/OmniHome'))
const TenantSite = lazy(() => import('./pages/TenantSite'))
const Signup = lazy(() => import('./pages/Signup'))
const Welcome = lazy(() => import('./pages/Welcome'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const Billing = lazy(() => import('./pages/Billing'))
const Team = lazy(() => import('./pages/Team'))
const OwnerConsole = lazy(() => import('./pages/OwnerConsole'))
const Login = lazy(() => import('./pages/Login'))
const Portal = lazy(() => import('./pages/Portal'))
const Home = lazy(() => import('./pages/Home'))
const Clients = lazy(() => import('./pages/Clients'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const Leads = lazy(() => import('./pages/Leads'))
const Proposals = lazy(() => import('./pages/Proposals'))
const ProposalWizard = lazy(() => import('./pages/ProposalWizard'))
const ProposalView = lazy(() => import('./pages/ProposalView'))
const Finance = lazy(() => import('./pages/Finance'))
const Employees = lazy(() => import('./pages/Employees'))
const Procurement = lazy(() => import('./pages/Procurement'))
const Strategy = lazy(() => import('./pages/Strategy'))
const Infrastructure = lazy(() => import('./pages/Infrastructure'))
const Discovery = lazy(() => import('./pages/Discovery'))
const Patching = lazy(() => import('./pages/Patching'))
const Security = lazy(() => import('./pages/Security'))
const Operations = lazy(() => import('./pages/Operations'))
const Projects = lazy(() => import('./pages/Projects'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Documentation = lazy(() => import('./pages/Documentation'))
const Tools = lazy(() => import('./pages/Tools'))
const Integrations = lazy(() => import('./pages/Integrations'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Admin = lazy(() => import('./pages/Admin'))

const Loading = () => <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>

// Is this request for an MSP's own domain / subdomain (their branded site) rather than Omni itself?
const PLATFORM_DOMAIN = ((import.meta.env.VITE_PLATFORM_DOMAIN as string) || '').toLowerCase()
const EXTRA_HOSTS = ((import.meta.env.VITE_PLATFORM_HOSTS as string) || '').toLowerCase().split(',').filter(Boolean)
function tenantHost(): string | null {
  if (!cloudEnabled || typeof window === 'undefined') return null
  const h = window.location.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.vercel.app') || h.startsWith('127.') || EXTRA_HOSTS.includes(h)) return null
  if (PLATFORM_DOMAIN && (h === PLATFORM_DOMAIN || h === 'www.' + PLATFORM_DOMAIN || h === 'app.' + PLATFORM_DOMAIN)) return null
  if (!PLATFORM_DOMAIN) return null
  return h
}

export default function App() {
  const theme = useStore((s) => s.ui.theme)
  const accent = useStore((s) => s.company.accent)
  const [booting, setBooting] = useState(cloudEnabled)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.dataset.accent = accent
  }, [theme, accent])
  // Restore the signed-in workspace on load, and react to sign-in / sign-out
  useEffect(() => {
    if (!supabase) return
    bootstrap().finally(() => setBooting(false))
    const { data } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_OUT') useStore.setState({ session: null, ui: { ...useStore.getState().ui, signedIn: false } })
    })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => { setLimitHandler((m) => toast(m, 'warn')); onWriteError((m) => toast(m, 'bad')) }, [])
  const host = tenantHost()
  const standalone = (import.meta.env.VITE_STANDALONE_SLUG as string) || ''
  if (booting) return <Loading />

  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          {standalone ? <Route path="/*" element={<TenantSite standaloneSlug={standalone} />} /> : host ? <Route path="/*" element={<TenantSite host={host} />} /> : <Route path="/" element={<OmniHome />} />}
          <Route path="/platform" element={<Navigate to="/#pricing" replace />} />
          <Route path="/signup" element={standalone ? <Navigate to="/login" replace /> : <Signup />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/login" element={<Login />} />
          <Route path="/m/:slug/*" element={<TenantSite />} />
          <Route path="/portal/:clientId?" element={<Portal />} />
          <Route path="/app" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="leads" element={<Leads />} />
            <Route path="proposals" element={<Proposals />} />
            <Route path="proposals/new" element={<ProposalWizard />} />
            <Route path="proposals/:id" element={<ProposalView />} />
            <Route path="finance" element={<Finance />} />
            <Route path="employees" element={<FeatureGate feature="payroll" name="Payroll"><Employees /></FeatureGate>} />
            <Route path="procurement" element={<FeatureGate feature="procurement" name="Procurement"><Procurement /></FeatureGate>} />
            <Route path="strategy" element={<FeatureGate feature="qbr" name="IT Strategy & QBR"><Strategy /></FeatureGate>} />
            <Route path="infrastructure" element={<Infrastructure />} />
            <Route path="discovery" element={<Discovery />} />
            <Route path="patching" element={<Patching />} />
            <Route path="security" element={<Security />} />
            <Route path="operations" element={<Operations />} />
            <Route path="projects" element={<Projects />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="documentation" element={<Documentation />} />
            <Route path="tools" element={<Tools />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="assistant" element={<FeatureGate feature="ai_assistant" name="The AI Assistant"><Assistant /></FeatureGate>} />
            <Route path="admin" element={<Admin />} />
            <Route path="billing" element={<Billing />} />
            <Route path="team" element={<Team />} />
            <Route path="owner" element={<OwnerConsole />} />
          </Route>
          {!host && !standalone && <Route path="*" element={<Navigate to="/" />} />}
        </Routes>
      </Suspense>
    </Router>
  )
}
