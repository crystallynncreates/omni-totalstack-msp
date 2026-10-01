// Omni TotalStack MSP subscription plans — shared by the web app and the API.
// Stripe price IDs come from env: STRIPE_PRICE_STARTER, STRIPE_PRICE_UNLIMITED, STRIPE_PRICE_BUSINESS (monthly recurring)
// and STRIPE_PRICE_ENTERPRISE (a ONE-TIME price: Enterprise is a lifetime license for a standalone copy).

export type PlanId = 'starter' | 'unlimited' | 'business' | 'enterprise'
export type Feature =
  | 'proposals' | 'client_portal' | 'landing_page' | 'network_discovery' | 'patching' | 'invoices' | 'stripe_payments'
  | 'weekly_emails' | 'payroll' | 'quickbooks' | 'ai_assistant' | 'ai_voice' | 'qbr' | 'custom_domain' | 'procurement' | 'all_integrations'

export interface Plan {
  id: PlanId
  name: string
  price: number // USD
  billing: 'monthly' | 'one_time'
  blurb: string
  limits: { clients: number; devices: number; seats: number } // Infinity = unlimited
  features: Feature[]
  highlights: string[]
  priceEnv?: string
}

const STARTER: Feature[] = ['proposals', 'client_portal', 'landing_page', 'network_discovery', 'patching', 'invoices', 'weekly_emails']
const UNL: Feature[] = ['proposals', 'client_portal', 'landing_page', 'network_discovery', 'patching', 'invoices', 'stripe_payments', 'weekly_emails', 'procurement', 'all_integrations']
const BIZ: Feature[] = [...UNL, 'payroll', 'quickbooks', 'ai_assistant', 'ai_voice', 'qbr', 'custom_domain']

export const PLANS: Record<PlanId, Plan> = {
  starter: { id: 'starter', name: 'Starter', price: 29.99, billing: 'monthly', blurb: 'For a solo tech getting their very first client.', limits: { clients: 1, devices: 25, seats: 1 }, features: STARTER, priceEnv: 'STRIPE_PRICE_STARTER',
    highlights: ['1 staff login', '1 client & up to 25 devices', 'Branded website & client portal', 'Proposals with 3 options + RFS PDFs', 'Network discovery & 15-day patch policy', 'Invoices, non-payment notices & weekly client emails', 'Core integrations: RMM (incl. Tactical RMM), Huntress, Microsoft 365, Entra ID, UniFi', 'Command Console & Android app'] },
  unlimited: { id: 'unlimited', name: 'Unlimited', price: 99, billing: 'monthly', blurb: 'Solo operators who want everything that runs the business.', limits: { clients: Infinity, devices: Infinity, seats: 2 }, features: UNL, priceEnv: 'STRIPE_PRICE_UNLIMITED',
    highlights: ['Unlimited clients & devices', '2 staff seats', 'Branded website & client portal', 'All core integrations (RMM, Huntress, M365, Proxmox, Automox, Webex…)', 'Command Console: one-line commands to every tool', 'Client payments: ACH, card, Apple/Google Pay', 'Automatic weekly client update emails'] },
  business: { id: 'business', name: 'Business', price: 249, billing: 'monthly', blurb: 'Growing MSPs with a team of technicians.', limits: { clients: Infinity, devices: Infinity, seats: 10 }, features: BIZ, priceEnv: 'STRIPE_PRICE_BUSINESS',
    highlights: ['Everything in Unlimited', '10 staff seats with roles', 'Payroll console & QuickBooks sync', 'Claude AI assistant & AI voice calls', 'QBR / IT strategy module', 'Your own custom domain'] },
  enterprise: { id: 'enterprise', name: 'Enterprise', price: 4500, billing: 'one_time', blurb: 'Own it forever. Your own standalone copy, fully disconnected from the Omni platform.', limits: { clients: Infinity, devices: Infinity, seats: Infinity }, features: BIZ, priceEnv: 'STRIPE_PRICE_ENTERPRISE',
    highlights: ['One-time payment, no monthly fees', 'Your own standalone install, disconnected from Omni', 'Runs on your own domain (you purchase it)', 'Unlimited seats, clients & devices', 'Every Business feature', 'All your data moved over at handoff'] },
}
export const PLAN_ORDER: PlanId[] = ['starter', 'unlimited', 'business', 'enterprise']
/** Integrations available on Starter (every other plan gets all integrations its features allow). */
export const STARTER_INTEGRATIONS = ['rmm', 'tacticalrmm', 'huntress', 'm365', 'entra', 'unifi']
export const HANDOFF_DAYS = 30 // Enterprise buyers keep their hosted workspace this long while their standalone copy is set up

export type OrgStatus = 'pending' | 'active' | 'past_due' | 'suspended' | 'canceled' | 'disconnected'
export const GRACE_DAYS = 7

/** Whether a workspace may be used on the Omni platform. past_due works during the grace period; comped (owner) accounts always work.
 *  Enterprise (lifetime) workspaces work until their handoff date, then become 'disconnected' — they run on their own standalone copy. */
export function orgIsLive(o: { status: OrgStatus; comped?: boolean; grace_until?: string | null; license?: string | null; handoff_by?: string | null }) {
  if (o.comped) return true
  if (o.status === 'disconnected') return false
  if (o.license === 'lifetime') return !o.handoff_by || new Date(o.handoff_by).getTime() > Date.now()
  if (o.status === 'active') return true
  if (o.status === 'past_due') return !o.grace_until || new Date(o.grace_until).getTime() > Date.now()
  return false
}
export const hasFeature = (plan: PlanId, f: Feature, comped = false) => comped || PLANS[plan].features.includes(f)
export const limitFor = (plan: PlanId, k: keyof Plan['limits'], comped = false) => (comped ? Infinity : PLANS[plan].limits[k])
