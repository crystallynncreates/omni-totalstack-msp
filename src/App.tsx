import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'

// VITE_HASH_ROUTER=1 builds a portable version (hash URLs) that runs from any static host or preview link.
const Router = import.meta.env.VITE_HASH_ROUTER === '1' ? HashRouter : BrowserRouter
import { useStore } from './lib/store'
import Layout from './components/Layout'

const Landing = lazy(() => import('./pages/Landing'))
const Platform = lazy(() => import('./pages/Platform'))
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

export default function App() {
  const theme = useStore((s) => s.ui.theme)
  const accent = useStore((s) => s.company.accent)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.dataset.accent = accent
  }, [theme, accent])

  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/platform" element={<Platform />} />
          <Route path="/login" element={<Login />} />
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
            <Route path="employees" element={<Employees />} />
            <Route path="procurement" element={<Procurement />} />
            <Route path="strategy" element={<Strategy />} />
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
            <Route path="assistant" element={<Assistant />} />
            <Route path="admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Router>
  )
}
