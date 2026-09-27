// Omni TotalStack MSP subscription plans — shared by the web app and the API.
// Stripe price IDs come from env: STRIPE_PRICE_UNLIMITED, STRIPE_PRICE_BUSINESS, STRIPE_PRICE_ENTERPRISE.

export type PlanId = 'free_forever' | 'unlimited' | 'business' | 'enterprise'
export type Feature =
  | 'proposals' | 'client_portal' | 'landing_page' | 'network_discovery' | 'patching' | 'invoices' | 'stripe_payments'
  | 'weekly_emails' | 'payroll' | 'quickbooks' | 'ai_assistant' | 'ai_voice' | 'qbr' | 'custom_domain' | 'procurement' | 'all_integrations'

export interface Plan {
  id: PlanId
  name: string
  price: number | null // USD / month; null = custom
  blurb: string
  limits: { clients: number; devices: number; seats: number } // Infinity = unlimited
  features: Feature[]
  highlights: string[]
  priceEnv?: string
}

const CORE: Feature[] = ['proposals', 'client_portal', 'landing_page', 'network_discovery', 'patching', 'invoices']
const UNL: Feature[] = [...CORE, 'stripe_payments', 'weekly_emails', 'procurement', 'all_integrations']
const BIZ: Feature[] = [...UNL, 'payroll', 'quickbooks', 'ai_assistant', 'ai_voice', 'qbr', 'custom_domain']

export const PLANS: Record<PlanId, Plan> = {
  free_forever: { id: 'free_forever', name: 'Free Forever', price: 0, blurb: 'For brand-new MSPs landing their first clients.', limits: { clients: 3, devices: 50, seats: 1 }, features: CORE,
    highlights: ['Up to 3 clients & 50 devices', 'Proposals with 3 options + RFS PDFs', 'Branded landing page & client portal', 'Network discovery & 15-day patch policy', 'Invoices & non-payment notices'] },
  unlimited: { id: 'unlimited', name: 'Unlimited', price: 99, blurb: 'Solo operators who want everything that runs the business.', limits: { clients: Infinity, devices: Infinity, seats: 2 }, features: UNL, priceEnv: 'STRIPE_PRICE_UNLIMITED',
    highlights: ['Unlimited clients & devices', '2 staff seats', 'All core integrations (RMM, Huntress, M365, UniFi…)', 'Client payments: ACH, card, Apple/Google Pay', 'Automatic weekly client update emails', 'Procurement & inventory'] },
  business: { id: 'business', name: 'Business', price: 249, blurb: 'Growing MSPs with a team of technicians.', limits: { clients: Infinity, devices: Infinity, seats: 10 }, features: BIZ, priceEnv: 'STRIPE_PRICE_BUSINESS',
    highlights: ['Everything in Unlimited', '10 staff seats with roles', 'Payroll console & QuickBooks sync', 'Claude AI assistant & AI voice calls', 'QBR / IT strategy module', 'Your own custom domain'] },
  enterprise: { id: 'enterprise', name: 'Enterprise', price: 599, blurb: 'Multi-location MSPs & MSSPs.', limits: { clients: Infinity, devices: Infinity, seats: Infinity }, features: BIZ, priceEnv: 'STRIPE_PRICE_ENTERPRISE',
    highlights: ['Everything in Business', 'Unlimited seats', 'All 120+ marketplace integrations', 'Priority onboarding & support', 'Audit exports'] },
}
export const PLAN_ORDER: PlanId[] = ['free_forever', 'unlimited', 'business', 'enterprise']

export type OrgStatus = 'pending' | 'active' | 'past_due' | 'suspended' | 'canceled'
export const GRACE_DAYS = 7

/** Whether a workspace may be used. past_due works during the grace period; comped (owner) accounts always work. */
export function orgIsLive(o: { status: OrgStatus; comped?: boolean; grace_until?: string | null }) {
  if (o.comped) return true
  if (o.status === 'active') return true
  if (o.status === 'past_due') return !o.grace_until || new Date(o.grace_until).getTime() > Date.now()
  return false
}
export const hasFeature = (plan: PlanId, f: Feature, comped = false) => comped || PLANS[plan].features.includes(f)
export const limitFor = (plan: PlanId, k: keyof Plan['limits'], comped = false) => (comped ? Infinity : PLANS[plan].limits[k])
