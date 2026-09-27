// Proposal engine: turns a detailed client-needs intake into three formal solution options.
// Rules: every option ALWAYS carries a Huntress subscription (mandatory), and every option
// addresses both cybersecurity and networking. Prices come from CATALOG (editable in Admin → Pricing).
import type { Intake, LineItem, Proposal, ProposalOption, Company } from './types'

export interface CatalogItem { sku: string; name: string; category: LineItem['category']; price: number; unit: string; recurring: boolean }

export const CATALOG: Record<string, CatalogItem> = {
  // --- Huntress (mandatory security stack) ---
  'HUN-EDR': { sku: 'HUN-EDR', name: 'Huntress Managed EDR — 24/7 SOC-monitored endpoint detection & response', category: 'Security', price: 7, unit: 'endpoint', recurring: true },
  'HUN-ITDR': { sku: 'HUN-ITDR', name: 'Huntress Managed ITDR — Microsoft 365 identity threat detection', category: 'Security', price: 4, unit: 'user', recurring: true },
  'HUN-SAT': { sku: 'HUN-SAT', name: 'Huntress Managed Security Awareness Training + phishing simulation', category: 'Security', price: 3, unit: 'user', recurring: true },
  'HUN-SIEM': { sku: 'HUN-SIEM', name: 'Huntress Managed SIEM — log retention & compliance reporting', category: 'Security', price: 6, unit: 'endpoint', recurring: true },
  // --- Managed services bundles ---
  'MSP-ESS': { sku: 'MSP-ESS', name: 'Managed IT — Essential (remote helpdesk 8x5, RMM monitoring, patching)', category: 'Managed Services', price: 95, unit: 'user', recurring: true },
  'MSP-ADV': { sku: 'MSP-ADV', name: 'Managed IT — Advanced (helpdesk 8x5 + onsite, quarterly vCIO/QBR)', category: 'Managed Services', price: 135, unit: 'user', recurring: true },
  'MSP-PRE': { sku: 'MSP-PRE', name: 'Managed IT — Premium (24x7 helpdesk, unlimited onsite, monthly vCIO)', category: 'Managed Services', price: 185, unit: 'user', recurring: true },
  'MSP-SRV': { sku: 'MSP-SRV', name: 'Managed server monitoring & patching', category: 'Managed Services', price: 125, unit: 'server', recurring: true },
  // --- Additional security ---
  'SEC-EMAIL': { sku: 'SEC-EMAIL', name: 'Advanced email security (anti-phishing, impersonation, link rewriting)', category: 'Security', price: 3, unit: 'user', recurring: true },
  'SEC-DNS': { sku: 'SEC-DNS', name: 'DNS filtering & web content protection', category: 'Security', price: 2, unit: 'endpoint', recurring: true },
  'SEC-MFA': { sku: 'SEC-MFA', name: 'MFA / Conditional Access rollout & enforcement (Entra ID)', category: 'Security', price: 45, unit: 'hour', recurring: false },
  'SEC-PWM': { sku: 'SEC-PWM', name: 'Business password manager', category: 'Security', price: 4, unit: 'user', recurring: true },
  'SEC-DARK': { sku: 'SEC-DARK', name: 'Dark web credential monitoring', category: 'Security', price: 99, unit: 'org', recurring: true },
  'SEC-COMP': { sku: 'SEC-COMP', name: 'Compliance program management (policies, evidence, annual risk assessment)', category: 'Consulting', price: 350, unit: 'org', recurring: true },
  // --- Backup ---
  'BAK-365': { sku: 'BAK-365', name: 'Microsoft 365 / Google cloud backup (mail, OneDrive, SharePoint, Teams)', category: 'Backup', price: 4, unit: 'user', recurring: true },
  'BAK-EP': { sku: 'BAK-EP', name: 'Endpoint image backup', category: 'Backup', price: 8, unit: 'endpoint', recurring: true },
  'BAK-SRV': { sku: 'BAK-SRV', name: 'Server image backup with offsite replication', category: 'Backup', price: 150, unit: 'server', recurring: true },
  'BAK-BCDR': { sku: 'BAK-BCDR', name: 'BCDR appliance with instant virtualization (per site)', category: 'Backup', price: 249, unit: 'site', recurring: true },
  // --- Network ---
  'NET-MON': { sku: 'NET-MON', name: 'Managed network monitoring & outage alerting (UniFi)', category: 'Network', price: 49, unit: 'site', recurring: true },
  'NET-FW': { sku: 'NET-FW', name: 'Managed firewall — IDS/IPS, geo-blocking, VLAN policy', category: 'Network', price: 79, unit: 'site', recurring: true },
  'NET-GW': { sku: 'NET-GW', name: 'UniFi Cloud Gateway (business firewall/router) — hardware', category: 'Hardware', price: 599, unit: 'site', recurring: false },
  'NET-SW': { sku: 'NET-SW', name: 'UniFi 24-port PoE managed switch — hardware', category: 'Hardware', price: 799, unit: 'each', recurring: false },
  'NET-AP': { sku: 'NET-AP', name: 'UniFi Wi-Fi 7 access point — hardware', category: 'Hardware', price: 219, unit: 'each', recurring: false },
  'NET-LTE': { sku: 'NET-LTE', name: '5G/LTE internet failover (hardware amortized + data)', category: 'Network', price: 59, unit: 'site', recurring: true },
  'NET-SEG': { sku: 'NET-SEG', name: 'Network segmentation (guest / staff / IoT / VoIP VLANs) & wireless survey', category: 'Labor', price: 145, unit: 'hour', recurring: false },
  'NET-CABLE': { sku: 'NET-CABLE', name: 'Structured cabling & rack cleanup', category: 'Labor', price: 125, unit: 'hour', recurring: false },
  // --- Other services ---
  'PRINT-MPS': { sku: 'PRINT-MPS', name: 'Managed print services (monitoring, toner auto-replenish, repairs)', category: 'Print', price: 29, unit: 'printer', recurring: true },
  'CON-PROC': { sku: 'CON-PROC', name: 'Process improvement & workflow automation assessment', category: 'Consulting', price: 1500, unit: 'engagement', recurring: false },
  'CON-HEALTH': { sku: 'CON-HEALTH', name: 'Business health technology review (QBR scorecard)', category: 'Consulting', price: 150, unit: 'quarter', recurring: true },
  'ONBOARD': { sku: 'ONBOARD', name: 'Onboarding: documentation, agent deployment, discovery, standardization', category: 'Labor', price: 125, unit: 'hour', recurring: false },
}

const line = (sku: string, qty: number, opts: Partial<LineItem> = {}): LineItem => {
  const c = CATALOG[sku]
  return { sku, description: c.name, category: c.category, qty: Math.max(1, Math.round(qty)), unitPrice: c.price, recurring: c.recurring, ...opts }
}

export const optionTotals = (o: ProposalOption) => ({
  monthly: o.lineItems.filter((l) => l.recurring).reduce((a, l) => a + l.qty * l.unitPrice, 0),
  oneTime: o.lineItems.filter((l) => !l.recurring).reduce((a, l) => a + l.qty * l.unitPrice, 0),
})

export function analyze(intake: Intake): Proposal['findings'] {
  const f: Proposal['findings'] = []
  if (intake.mfaEnabled !== 'all') f.push({ area: 'Cybersecurity', severity: 'high', text: `MFA is ${intake.mfaEnabled === 'none' ? 'not enabled' : 'only partially enabled'} — account takeover is the #1 cause of small-business breaches.` })
  if (intake.backupStatus !== 'tested') f.push({ area: 'Cybersecurity', severity: 'high', text: intake.backupStatus === 'none' ? 'No backups are in place — a ransomware event or failed drive would mean permanent data loss.' : 'Backups exist but have never been restore-tested.' })
  if (!intake.securityTraining) f.push({ area: 'Cybersecurity', severity: 'medium', text: 'Staff have no security-awareness training; phishing remains the top attack vector.' })
  if (intake.pastIncidents.trim()) f.push({ area: 'Cybersecurity', severity: 'high', text: `Prior incident reported: "${intake.pastIncidents.trim()}". 24/7 detection & response is required.` })
  f.push({ area: 'Cybersecurity', severity: 'medium', text: 'No 24/7 managed detection & response is monitoring endpoints and Microsoft 365 identities.' })
  if (intake.hasFirewall !== 'business') f.push({ area: 'Networking', severity: 'high', text: intake.hasFirewall === 'none' ? 'No firewall — the network relies on an ISP modem with no intrusion prevention.' : 'Consumer-grade router in use; no IDS/IPS, VLANs or centralized management.' })
  if (intake.wifiQuality !== 'good') f.push({ area: 'Networking', severity: intake.wifiQuality === 'poor' ? 'high' : 'medium', text: `Wi-Fi coverage is ${intake.wifiQuality}; staff productivity and VoIP quality are affected.` })
  if (!intake.internetRedundancy) f.push({ area: 'Networking', severity: 'medium', text: 'Single internet connection — any ISP outage stops the business.' })
  if (intake.compliance.length) f.push({ area: 'Compliance', severity: 'high', text: `Regulatory requirements (${intake.compliance.join(', ')}) need documented controls, log retention and annual risk assessments.` })
  if (intake.printers > 0) f.push({ area: 'Operations', severity: 'low', text: `${intake.printers} printer(s) are unmanaged — no toner tracking or proactive repair.` })
  intake.painPoints.forEach((p) => f.push({ area: 'Operations', severity: 'medium', text: `Reported pain point: ${p}.` }))
  return f
}

export function generateOptions(intake: Intake): ProposalOption[] {
  const endpoints = intake.devices + intake.servers
  const sites = Math.max(1, intake.sites)
  const users = Math.max(1, intake.users)
  const needsGw = intake.hasFirewall !== 'business'
  const needsWifi = intake.wifiQuality !== 'good'
  const apsPerSite = Math.max(1, Math.ceil(users / 15))
  const onboardHrs = Math.ceil(4 + endpoints * 0.5 + sites * 2)
  const m365 = intake.emailPlatform === 'Microsoft 365'

  // Mandatory Huntress in every tier
  const huntressCore = (extra: LineItem[] = []) => [
    line('HUN-EDR', endpoints, { mandatory: true }),
    ...(m365 ? [line('HUN-ITDR', users, { mandatory: true })] : []),
    ...extra,
  ]

  const essential: ProposalOption = {
    tier: 'Essential',
    title: 'Secure Foundation',
    summary: 'Closes the most urgent security gaps and gets every device monitored, patched and protected by 24/7 Huntress detection & response — at the lowest monthly cost.',
    addresses: ['24/7 threat detection (Huntress)', 'Patch management with 15-day stability soak', 'Business-grade firewall & network monitoring', 'Cloud backup of email & files'],
    lineItems: [
      line('MSP-ESS', users),
      ...(intake.servers ? [line('MSP-SRV', intake.servers)] : []),
      ...huntressCore([line('HUN-SAT', users, { mandatory: true })]),
      line('SEC-MFA', Math.ceil(users / 5)),
      line('BAK-365', users),
      ...(intake.servers ? [line('BAK-SRV', intake.servers)] : []),
      line('NET-MON', sites),
      ...(needsGw ? [line('NET-GW', sites)] : []),
      line('ONBOARD', onboardHrs),
    ],
  }

  const advanced: ProposalOption = {
    tier: 'Advanced',
    title: 'Protected & Productive',
    summary: 'Everything in Essential plus layered email/web security, a managed firewall with segmented Wi-Fi, endpoint backups and quarterly strategic reviews — the right fit for most growing businesses.',
    addresses: ['Everything in Essential', 'Phishing & impersonation protection', 'Segmented, reliable Wi-Fi (guest/staff/IoT)', 'Quarterly business reviews & IT roadmap', 'Managed print'],
    lineItems: [
      line('MSP-ADV', users),
      ...(intake.servers ? [line('MSP-SRV', intake.servers)] : []),
      ...huntressCore([line('HUN-SAT', users, { mandatory: true })]),
      line('SEC-EMAIL', users),
      line('SEC-DNS', endpoints),
      line('SEC-PWM', users),
      line('SEC-MFA', Math.ceil(users / 5)),
      line('BAK-365', users),
      line('BAK-EP', intake.devices),
      ...(intake.servers ? [line('BAK-SRV', intake.servers)] : []),
      line('NET-MON', sites),
      line('NET-FW', sites),
      ...(needsGw ? [line('NET-GW', sites)] : []),
      ...(needsWifi ? [line('NET-AP', apsPerSite * sites)] : []),
      line('NET-SEG', 4 * sites),
      ...(intake.printers ? [line('PRINT-MPS', intake.printers)] : []),
      line('CON-HEALTH', 1),
      line('ONBOARD', onboardHrs),
    ],
  }

  const premium: ProposalOption = {
    tier: 'Premium',
    title: 'Total Stack Resilience',
    summary: 'A fully managed, compliance-ready environment: 24x7 support, Huntress SIEM, BCDR with instant recovery, redundant internet, a rebuilt network and monthly vCIO planning with process improvement.',
    addresses: ['Everything in Advanced', '24x7 support & unlimited onsite', 'SIEM log retention for compliance', 'Instant-recovery BCDR & internet failover', 'Full network refresh', 'Process improvement engagement'],
    lineItems: [
      line('MSP-PRE', users),
      ...(intake.servers ? [line('MSP-SRV', intake.servers)] : []),
      ...huntressCore([line('HUN-SAT', users, { mandatory: true }), line('HUN-SIEM', endpoints, { mandatory: true })]),
      line('SEC-EMAIL', users),
      line('SEC-DNS', endpoints),
      line('SEC-PWM', users),
      line('SEC-DARK', 1),
      line('SEC-MFA', Math.ceil(users / 4)),
      ...(intake.compliance.length ? [line('SEC-COMP', 1)] : []),
      line('BAK-365', users),
      line('BAK-EP', intake.devices),
      line('BAK-BCDR', sites),
      line('NET-MON', sites),
      line('NET-FW', sites),
      line('NET-LTE', sites),
      line('NET-GW', sites),
      line('NET-SW', sites),
      line('NET-AP', apsPerSite * sites),
      line('NET-SEG', 6 * sites),
      line('NET-CABLE', 4 * sites),
      ...(intake.printers ? [line('PRINT-MPS', intake.printers)] : []),
      line('CON-PROC', 1),
      line('ONBOARD', onboardHrs),
    ],
  }
  return [essential, advanced, premium]
}

export function executiveSummary(intake: Intake, clientName: string, company: Company) {
  return `${company.name} has reviewed ${clientName}'s technology environment: ${intake.users} users, ${intake.devices} workstations/laptops${intake.servers ? `, ${intake.servers} server(s)` : ''} across ${intake.sites} site(s)${intake.compliance.length ? `, with ${intake.compliance.join(', ')} obligations` : ''}. ${intake.goals ? `Your stated goals: ${intake.goals}. ` : ''}We have identified cybersecurity and networking risks that should be addressed ${intake.timeline === 'ASAP' ? 'immediately' : `within ${intake.timeline.toLowerCase()}`}. Below are three solutions. Every option includes a mandatory Huntress 24/7 managed security subscription, administered through ${company.name}'s Huntress partner account, so that ${clientName} is protected by a human-staffed Security Operations Center from day one.`
}

/** Suggest the option that best fits the stated budget (never below Essential). */
export function recommend(options: ProposalOption[], budget: number) {
  let best = 0
  options.forEach((o, i) => { if (optionTotals(o).monthly <= budget * 1.1) best = i })
  return best
}
