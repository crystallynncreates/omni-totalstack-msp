// Central app state. Persisted to the browser in demo mode; when Supabase env vars are set,
// src/lib/sync.ts mirrors each collection to the database tables of the same name.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type * as T from './types'
import * as seed from './seed'
import { iso, uid } from './format'
import { PLANS, limitFor, type OrgStatus, type PlanId } from '../../shared/plans'

export const APP_VERSION = '1.2.0'

type Collections = {
  clients: T.Client[]
  sites: T.Site[]
  contracts: T.Contract[]
  documents: T.ClientDocument[]
  proposals: T.Proposal[]
  devices: T.Device[]
  patches: T.Patch[]
  tickets: T.Ticket[]
  projects: T.Project[]
  inventory: T.InventoryItem[]
  purchaseOrders: T.PurchaseOrder[]
  invoices: T.Invoice[]
  payments: T.Payment[]
  employees: T.Employee[]
  expenses: T.Expense[]
  leads: T.Lead[]
  appointments: T.Appointment[]
  scans: T.DiscoveryScan[]
  roadmap: T.RoadmapItem[]
  credentials: T.Credential[]
  directoryUsers: T.DirectoryUser[]
  audit: T.AuditEntry[]
  notifications: T.Notification[]
}
export type CollectionKey = keyof Collections

interface UI {
  theme: 'dark' | 'light'
  setupDone: boolean
  tourDone: boolean
  lastSeenVersion: string
  signedIn: boolean
  userName: string
  role: T.Role
  demoMode: boolean
  weeklyEmailLog: { at: string; clients: number; patches: number }[]
}

/** The signed-in workspace when running against Supabase ("cloud" mode). null = local demo mode. */
export interface Session {
  orgId: string
  slug: string
  plan: PlanId
  status: OrgStatus
  comped: boolean
  graceUntil?: string | null
  currentPeriodEnd?: string | null
  customDomain?: string | null
  license?: 'subscription' | 'lifetime'
  handoffBy?: string | null
  role: T.Role
  clientId?: string | null
  email: string
  platformOwner: boolean
}

interface State extends Collections {
  company: T.Company
  integrations: Record<T.IntegrationId, T.IntegrationState>
  ui: UI
  session: Session | null
  add: <K extends CollectionKey>(k: K, item: Collections[K][number]) => boolean
  update: <K extends CollectionKey>(k: K, id: string, patch: Partial<Collections[K][number]>) => void
  remove: <K extends CollectionKey>(k: K, id: string) => void
  setCompany: (p: Partial<T.Company>) => void
  setUI: (p: Partial<UI>) => void
  setIntegration: (id: T.IntegrationId, p: Partial<T.IntegrationState>) => void
  log: (action: string) => void
  notify: (level: T.Notification['level'], text: string, href?: string) => void
  resetDemo: () => void
  startFresh: () => void
}

// ── Cloud sync hook (set by lib/cloud.ts when signed in to Supabase) ─────────
export interface Syncer {
  put: (k: CollectionKey, item: { id: string }) => void
  del: (k: CollectionKey, id: string) => void
  company: (c: T.Company) => void
  integrations: (i: Record<string, T.IntegrationState>) => void
}
let syncer: Syncer | null = null
export const setSyncer = (s: Syncer | null) => { syncer = s }
const LIMITED: Partial<Record<CollectionKey, 'clients' | 'devices'>> = { clients: 'clients', devices: 'devices' }
let onLimit: (msg: string) => void = () => {}
export const setLimitHandler = (fn: (msg: string) => void) => { onLimit = fn }

export const emptyIntegrations = (): Record<T.IntegrationId, T.IntegrationState> => {
  const ids: T.IntegrationId[] = ['claude', 'rmm', 'huntress', 'm365', 'entra', 'unifi', 'inventory', 'quickbooks', 'stripe', 'gusto', 'voice', 'resend', 'calendar', 'backup', 'print']
  return Object.fromEntries(ids.map((i) => [i, { connected: false, config: {} }])) as Record<T.IntegrationId, T.IntegrationState>
}

const seedCollections = (): Collections => ({
  clients: seed.clients, sites: seed.sites, contracts: seed.contracts, documents: seed.documents, proposals: [],
  devices: seed.devices, patches: seed.patches, tickets: seed.tickets, projects: seed.projects, inventory: seed.inventory,
  purchaseOrders: seed.purchaseOrders, invoices: seed.invoices, payments: seed.payments, employees: seed.employees,
  expenses: seed.expenses, leads: seed.leads, appointments: seed.appointments, scans: seed.scans, roadmap: seed.roadmap,
  credentials: seed.credentials, directoryUsers: seed.directoryUsers,
  audit: [{ id: 'au0', at: iso(), who: 'system', action: 'Workspace created with demo data' }],
  notifications: [
    { id: 'n1', at: iso(), level: 'bad', text: 'Copperline — Decatur is DOWN (gateway unreachable)', href: '/app/infrastructure', read: false },
    { id: 'n2', at: iso(), level: 'warn', text: '2 invoices are past due — non-payment notices are ready', href: '/app/finance?tab=notices', read: false },
    { id: 'n3', at: iso(), level: 'warn', text: 'Huntress subscription for Northgate expires in 18 days', href: '/app/clients/c4', read: false },
  ],
})

export const COLLECTION_KEYS = Object.keys(seedCollections()) as CollectionKey[]
export const emptyCollections = (): Collections => Object.fromEntries(COLLECTION_KEYS.map((k) => [k, []])) as unknown as Collections

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...seedCollections(),
      patches: seed.patches,
      company: seed.defaultCompany,
      integrations: emptyIntegrations(),
      session: null,
      ui: { theme: 'dark', setupDone: false, tourDone: false, lastSeenVersion: '0.0.0', signedIn: false, userName: 'there', role: 'owner', demoMode: true, weeklyEmailLog: [] },
      add: (k, item) => {
        const sess = get().session
        const lim = LIMITED[k]
        if (sess && lim) {
          const max = limitFor(sess.plan, lim, sess.comped)
          if ((get()[k] as unknown[]).length >= max) {
            onLimit(`Your ${PLANS[sess.plan].name} plan includes up to ${max} ${lim}. Upgrade to add more.`)
            return false
          }
        }
        set({ [k]: [item, ...(get()[k] as unknown[])] } as Partial<State>)
        syncer?.put(k, item as { id: string })
        return true
      },
      update: (k, id, patch) => {
        set({ [k]: (get()[k] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) } as Partial<State>)
        const item = (get()[k] as { id: string }[]).find((x) => x.id === id)
        if (item) syncer?.put(k, item)
      },
      remove: (k, id) => {
        set({ [k]: (get()[k] as { id: string }[]).filter((x) => x.id !== id) } as Partial<State>)
        syncer?.del(k, id)
      },
      setCompany: (p) => { set({ company: { ...get().company, ...p } }); syncer?.company(get().company) },
      setUI: (p) => set({ ui: { ...get().ui, ...p } }),
      setIntegration: (id, p) => { set({ integrations: { ...get().integrations, [id]: { ...get().integrations[id], ...p } } }); syncer?.integrations(get().integrations) },
      log: (action) => get().add('audit', { id: uid('au'), at: iso(), who: get().ui.userName, action }),
      notify: (level, text, href) => get().add('notifications', { id: uid('n'), at: iso(), level, text, href, read: false }),
      resetDemo: () => set({ ...seedCollections(), ui: { ...get().ui, demoMode: true } }),
      startFresh: () => set({ ...emptyCollections(), patches: seed.patches, ui: { ...get().ui, demoMode: false } }),
    }),
    {
      name: 'omni-totalstack-msp',
      version: 2,
      // In cloud mode the database is the source of truth — only UI preferences are kept in the browser.
      partialize: (s) => (s.session ? { ui: s.ui } : Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function'))) as unknown as State,
    },
  ),
)

// Convenience selectors
export const useClient = (id?: string) => useStore((s) => s.clients.find((c) => c.id === id))
export const clientName = (id?: string) => useStore.getState().clients.find((c) => c.id === id)?.name ?? '—'

export const invoiceTotal = (inv: T.Invoice) => {
  const sub = inv.lines.reduce((a, l) => a + l.qty * l.rate, 0)
  return sub + sub * (inv.taxRate / 100)
}
export const isOverdue = (inv: T.Invoice) => inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'draft' && new Date(inv.dueDate).getTime() < Date.now()
