// Central app state. Persisted to the browser in demo mode; when Supabase env vars are set,
// src/lib/sync.ts mirrors each collection to the database tables of the same name.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type * as T from './types'
import * as seed from './seed'
import { iso, uid } from './format'

export const APP_VERSION = '1.0.0'

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

interface State extends Collections {
  company: T.Company
  integrations: Record<T.IntegrationId, T.IntegrationState>
  ui: UI
  add: <K extends CollectionKey>(k: K, item: Collections[K][number]) => void
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

const emptyIntegrations = (): Record<T.IntegrationId, T.IntegrationState> => {
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

const emptyCollections = (): Collections => Object.fromEntries(Object.keys(seedCollections()).map((k) => [k, []])) as unknown as Collections

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...seedCollections(),
      patches: seed.patches,
      company: seed.defaultCompany,
      integrations: emptyIntegrations(),
      ui: { theme: 'dark', setupDone: false, tourDone: false, lastSeenVersion: '0.0.0', signedIn: false, userName: 'Crystal', role: 'owner', demoMode: true, weeklyEmailLog: [] },
      add: (k, item) => set({ [k]: [item, ...(get()[k] as unknown[])] } as Partial<State>),
      update: (k, id, patch) => set({ [k]: (get()[k] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) } as Partial<State>),
      remove: (k, id) => set({ [k]: (get()[k] as { id: string }[]).filter((x) => x.id !== id) } as Partial<State>),
      setCompany: (p) => set({ company: { ...get().company, ...p } }),
      setUI: (p) => set({ ui: { ...get().ui, ...p } }),
      setIntegration: (id, p) => set({ integrations: { ...get().integrations, [id]: { ...get().integrations[id], ...p } } }),
      log: (action) => set({ audit: [{ id: uid('au'), at: iso(), who: get().ui.userName, action }, ...get().audit].slice(0, 500) }),
      notify: (level, text, href) => set({ notifications: [{ id: uid('n'), at: iso(), level, text, href, read: false }, ...get().notifications].slice(0, 100) }),
      resetDemo: () => set({ ...seedCollections(), ui: { ...get().ui, demoMode: true } }),
      startFresh: () => set({ ...emptyCollections(), patches: seed.patches, ui: { ...get().ui, demoMode: false } }),
    }),
    { name: 'omni-totalstack-msp', version: 1 },
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
