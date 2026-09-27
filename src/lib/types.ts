// Omni TotalStack MSP — core domain types.
// These mirror the Supabase schema in supabase/migrations/0001_init.sql.

export type ID = string

export type Role = 'owner' | 'admin' | 'technician' | 'finance' | 'client'

export interface Company {
  name: string
  legalName: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  website: string
  logoDataUrl?: string
  accent: 'blue' | 'purple' | 'gold'
  taxRate: number // percent
  paymentTermsDays: number
  laborRate: number // $/hr
  afterHoursRate: number
  huntressPortalUrl: string
  weeklyEmailDay: number // 0=Sun..6
  weeklyEmailHour: number
  patchSoakDays: number // default 15
}

export interface Contact { name: string; title?: string; email: string; phone: string }

export interface Client {
  id: ID
  name: string
  group: string // e.g. "Healthcare", "Legal", "Retail" — client grouping
  status: 'active' | 'onboarding' | 'prospect' | 'inactive'
  primaryContact: Contact
  address: string
  ownerName: string // property owner (for non-payment notice)
  ownerAddress: string
  primeContractor?: { name: string; address: string }
  slaTier: 'Essential' | 'Advanced' | 'Premium'
  mrr: number
  autopay: boolean
  paymentMethod?: 'ach' | 'card' | 'wallet'
  huntressOrgId?: string
  m365TenantId?: string
  notes: string
  createdAt: string
}

export type SiteStatus = 'online' | 'degraded' | 'down'
export interface Outage { id: ID; start: string; end?: string; cause: string }
export interface Site {
  id: ID
  clientId: ID
  name: string
  address: string
  status: SiteStatus
  isp: string
  wanIp: string
  unifiSiteId?: string
  lastCheck: string
  uptime30d: number
  outages: Outage[]
}

export type ContractType = 'MSA' | 'SLA' | 'Subscription' | 'License' | 'Warranty' | 'ISP' | 'Domain' | 'Huntress'
export interface Contract {
  id: ID
  clientId: ID
  siteId?: ID
  name: string
  type: ContractType
  vendor: string
  startDate: string
  endDate: string
  value: number
  billing: 'monthly' | 'annual' | 'one-time'
  autoRenew: boolean
}

export type DocCategory = 'Proposal' | 'RFS' | 'Agreement' | 'SOP' | 'Network' | 'Contract' | 'QBR' | 'Invoice' | 'Notice' | 'Other'
export interface ClientDocument {
  id: ID
  clientId: ID
  name: string
  category: DocCategory
  createdAt: string
  status?: string
  refId?: ID // links back to proposal/invoice/etc.
  body?: string
}

export type LineCategory = 'Security' | 'Network' | 'Managed Services' | 'Hardware' | 'Labor' | 'Cloud' | 'Backup' | 'Print' | 'Consulting'
export interface LineItem {
  sku: string
  description: string
  category: LineCategory
  qty: number
  unitPrice: number
  recurring: boolean
  mandatory?: boolean
}

export interface Intake {
  clientId: ID
  industry: string
  users: number
  devices: number
  servers: number
  sites: number
  printers: number
  compliance: string[]
  emailPlatform: 'Microsoft 365' | 'Google Workspace' | 'On-prem Exchange' | 'Other / None'
  hasFirewall: 'business' | 'consumer' | 'none'
  wifiQuality: 'good' | 'spotty' | 'poor'
  internetRedundancy: boolean
  backupStatus: 'tested' | 'untested' | 'none'
  mfaEnabled: 'all' | 'some' | 'none'
  securityTraining: boolean
  pastIncidents: string
  painPoints: string[]
  goals: string
  budgetMonthly: number
  timeline: 'ASAP' | '30 days' | '90 days' | 'Planning'
  notes: string
}

export interface ProposalOption {
  tier: 'Essential' | 'Advanced' | 'Premium'
  title: string
  summary: string
  addresses: string[] // needs addressed
  lineItems: LineItem[]
}

export interface Proposal {
  id: ID
  number: string
  clientId: ID
  createdAt: string
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  intake: Intake
  executiveSummary: string
  findings: { area: 'Cybersecurity' | 'Networking' | 'Operations' | 'Compliance'; severity: 'high' | 'medium' | 'low'; text: string }[]
  options: ProposalOption[]
  selected?: number
  rfsNumber?: string
  rfsDate?: string
}

export interface Device {
  id: ID
  clientId: ID
  siteId: ID
  hostname: string
  type: 'workstation' | 'laptop' | 'server' | 'firewall' | 'switch' | 'ap' | 'printer' | 'phone' | 'iot' | 'unknown'
  os: string
  ip: string
  mac: string
  vendor: string
  status: 'online' | 'offline' | 'warning'
  cpu: number
  ram: number
  disk: number
  lastSeen: string
  pendingPatches: number
  huntressAgent: boolean
  rmmAgent: boolean
  backupStatus?: 'ok' | 'failed' | 'none'
  warrantyEnd?: string
  assignedUser?: string
  toner?: number // printers
}

export interface Patch {
  id: ID
  kb: string
  title: string
  product: string
  severity: 'critical' | 'important' | 'moderate' | 'low'
  releaseDate: string
  lastIssueReported?: string // resets the soak clock
  openIssues: number
  deployedAt?: string
  deployedCount: number
  blocked?: boolean
}

export interface Ticket {
  id: ID
  number: number
  clientId: ID
  title: string
  description: string
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  status: 'new' | 'in_progress' | 'waiting' | 'resolved'
  category: string
  assignee?: string
  createdAt: string
  slaDueAt: string
  billable: boolean
  hours: number
  invoiced?: boolean
}

export interface Milestone { name: string; due: string; done: boolean }
export interface Project {
  id: ID
  clientId: ID
  name: string
  status: 'on_track' | 'at_risk' | 'delayed' | 'done'
  progress: number
  start: string
  end: string
  budget: number
  billableHours: number
  milestones: Milestone[]
}

export interface InventoryItem {
  id: ID
  sku: string
  name: string
  category: 'Network' | 'Computer' | 'Peripheral' | 'Printer' | 'Consumable' | 'License' | 'Cable'
  qty: number
  reorderAt: number
  cost: number
  price: number
  location: string
  warrantyMonths: number
  assignedClientId?: ID
  serial?: string
  receivedAt: string
}

export interface PurchaseOrder {
  id: ID
  number: string
  vendor: string
  clientId?: ID
  items: { name: string; sku: string; qty: number; cost: number; price: number }[]
  status: 'draft' | 'pending_approval' | 'ordered' | 'shipped' | 'received' | 'backordered'
  eta?: string
  tracking?: string
  createdAt: string
}

export interface InvoiceLine { id: ID; description: string; qty: number; rate: number; source?: 'sla' | 'ticket' | 'project' | 'hardware' | 'manual'; refId?: ID }
export interface Invoice {
  id: ID
  number: string
  clientId: ID
  issueDate: string
  dueDate: string
  lines: InvoiceLine[]
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void'
  paidDate?: string
  recurring?: 'monthly' | 'quarterly' | 'annual'
  lastServiceDate: string
  workDescription: string
  taxRate: number
}

export interface Payment { id: ID; invoiceId: ID; clientId: ID; amount: number; date: string; method: 'ach' | 'card' | 'wallet' | 'check' }

export interface Employee {
  id: ID
  name: string
  email: string
  role: string
  appRole: Role
  type: 'W2' | '1099'
  rate: number
  hoursThisPeriod: number
  ptoBalance: number
  directDeposit: 'active' | 'pending' | 'none'
  startDate: string
  certifications: string[]
  w4OnFile: boolean
  i9OnFile: boolean
}

export interface Expense { id: ID; date: string; vendor: string; category: string; amount: number; status: 'paid' | 'unpaid'; dueDate?: string }

export interface Lead {
  id: ID
  name: string
  email: string
  phone: string
  company: string
  employees?: string
  interest: string[]
  message: string
  source: 'website' | 'ai_call' | 'booking' | 'manual'
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
  createdAt: string
  callRequested?: boolean
}

export interface Appointment { id: ID; leadId?: ID; name: string; email: string; phone?: string; start: string; topic: string; status: 'booked' | 'done' | 'cancelled' }

export interface DiscoveredHost {
  ip: string
  mac: string
  hostname: string
  vendor: string
  guessedType: Device['type']
  openPorts: number[]
  isNew: boolean
  risk?: string
}
export interface DiscoveryScan { id: ID; siteId: ID; clientId: ID; range: string; startedAt: string; source: 'agent' | 'demo' | 'import'; hosts: DiscoveredHost[] }

export interface RoadmapItem {
  id: ID
  clientId: ID
  category: 'Security' | 'Network' | 'Hardware' | 'Cloud' | 'Backup' | 'Compliance' | 'Process'
  finding: string
  recommendation: string
  priority: 'high' | 'medium' | 'low'
  quarter: string
  status: 'open' | 'planned' | 'done'
  estCost: number
}

export interface Credential { id: ID; clientId: ID; system: string; username: string; lastRotated: string; rotateEveryDays: number; vaultRef: string }

export interface DirectoryUser { id: ID; clientId: ID; displayName: string; upn: string; license: string; mfa: boolean; groups: string[]; lastSignIn: string; enabled: boolean }

export type IntegrationId =
  | 'claude' | 'rmm' | 'huntress' | 'm365' | 'entra' | 'unifi' | 'inventory' | 'quickbooks'
  | 'stripe' | 'gusto' | 'voice' | 'resend' | 'calendar' | 'backup' | 'print'

export interface IntegrationState { connected: boolean; config: Record<string, string>; lastSync?: string }

export interface AuditEntry { id: ID; at: string; who: string; action: string }
export interface Notification { id: ID; at: string; level: 'info' | 'warn' | 'bad' | 'ok'; text: string; href?: string; read: boolean }
