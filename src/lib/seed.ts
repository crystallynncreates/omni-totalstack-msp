// Demo data so a brand-new owner can click through every feature before connecting real systems.
// Dates are relative to "today" so the demo always looks current.
import type * as T from './types'
import { addDays, iso, isoDate } from './format'

const d = (n: number) => iso(addDays(new Date(), n))
const dd = (n: number) => isoDate(addDays(new Date(), n))

export const defaultCompany: T.Company = {
  name: 'Peachtree IT Solutions',
  legalName: 'Peachtree IT Solutions LLC',
  address: '100 Main Street, Suite 200',
  city: 'Atlanta', state: 'GA', zip: '30303',
  phone: '(555) 010-2000',
  email: 'hello@peachtreeit.example',
  website: 'peachtreeit.example',
  accent: 'blue',
  taxRate: 7,
  paymentTermsDays: 30,
  laborRate: 125,
  afterHoursRate: 187.5,
  huntressPortalUrl: 'https://huntress.io/login',
  weeklyEmailDay: 1,
  weeklyEmailHour: 8,
  patchSoakDays: 15,
}

export const clients: T.Client[] = [
  { id: 'c1', name: 'Brightside Dental Group', group: 'Healthcare', status: 'active', primaryContact: { name: 'Dr. Maya Chen', title: 'Owner', email: 'maya@brightsidedental.example', phone: '(555) 201-1100' }, address: '42 Peachtree Ave, Atlanta, GA 30305', ownerName: 'Brightside Holdings LLC', ownerAddress: '42 Peachtree Ave, Atlanta, GA 30305', slaTier: 'Premium', mrr: 4850, autopay: true, paymentMethod: 'ach', huntressOrgId: 'org-bright-001', m365TenantId: 'brightside.onmicrosoft.com', notes: 'HIPAA. Two offices. Imaging server in Buckhead.', createdAt: d(-420) },
  { id: 'c2', name: 'Harbor & Pine Law', group: 'Legal', status: 'active', primaryContact: { name: 'James Okafor', title: 'Managing Partner', email: 'jokafor@harborpine.example', phone: '(555) 201-2200' }, address: '900 W Marietta St, Atlanta, GA 30318', ownerName: 'Marietta Street Properties', ownerAddress: '1 Commerce Blvd, Atlanta, GA 30303', primeContractor: { name: 'Summit Build Partners', address: '55 Industrial Way, Atlanta, GA 30318' }, slaTier: 'Advanced', mrr: 2960, autopay: false, paymentMethod: 'card', huntressOrgId: 'org-harbor-002', m365TenantId: 'harborpine.onmicrosoft.com', notes: 'Document management (NetDocuments).', createdAt: d(-300) },
  { id: 'c3', name: 'Copperline Coffee Co.', group: 'Retail & Hospitality', status: 'active', primaryContact: { name: 'Ana Ruiz', title: 'Operations Manager', email: 'ana@copperline.example', phone: '(555) 201-3300' }, address: '17 Edgewood Ave, Atlanta, GA 30303', ownerName: 'Copperline Coffee Co.', ownerAddress: '17 Edgewood Ave, Atlanta, GA 30303', slaTier: 'Essential', mrr: 1240, autopay: true, paymentMethod: 'card', huntressOrgId: 'org-copper-003', notes: '3 cafes, POS on separate VLAN (PCI).', createdAt: d(-190) },
  { id: 'c4', name: 'Northgate Logistics', group: 'Manufacturing & Logistics', status: 'active', primaryContact: { name: 'Tom Becker', title: 'CFO', email: 'tbecker@northgate.example', phone: '(555) 201-4400' }, address: '3100 Airport Rd, College Park, GA 30337', ownerName: 'Airport Rd Industrial LP', ownerAddress: '200 Park Pl, Atlanta, GA 30303', slaTier: 'Advanced', mrr: 3675, autopay: false, paymentMethod: 'ach', huntressOrgId: 'org-north-004', m365TenantId: 'northgate.onmicrosoft.com', notes: 'Warehouse Wi-Fi scanners, 2 shifts.', createdAt: d(-250) },
  { id: 'c5', name: 'Lumen Wellness Studio', group: 'Healthcare', status: 'prospect', primaryContact: { name: 'Priya Nair', title: 'Founder', email: 'priya@lumenwellness.example', phone: '(555) 201-5500' }, address: '800 Ponce de Leon Ave, Atlanta, GA 30306', ownerName: 'Lumen Wellness Studio', ownerAddress: '800 Ponce de Leon Ave, Atlanta, GA 30306', slaTier: 'Essential', mrr: 0, autopay: false, notes: 'Referral from Brightside. Wants proposal.', createdAt: d(-6) },
]

export const sites: T.Site[] = [
  { id: 's1', clientId: 'c1', name: 'Brightside — Midtown', address: '42 Peachtree Ave', status: 'online', isp: 'AT&T Fiber 1G', wanIp: '203.0.113.10', unifiSiteId: 'bright-mid', lastCheck: d(0), uptime30d: 99.98, outages: [{ id: 'o1', start: d(-12), end: d(-12), cause: 'ISP maintenance (14 min)' }] },
  { id: 's2', clientId: 'c1', name: 'Brightside — Buckhead', address: '3300 Peachtree Rd', status: 'degraded', isp: 'Comcast 500M', wanIp: '203.0.113.22', unifiSiteId: 'bright-buck', lastCheck: d(0), uptime30d: 99.2, outages: [{ id: 'o2', start: d(-0.05), cause: 'High packet loss on WAN1 — failover to LTE active' }] },
  { id: 's3', clientId: 'c2', name: 'Harbor & Pine — HQ', address: '900 W Marietta St', status: 'online', isp: 'Google Fiber 2G', wanIp: '198.51.100.4', unifiSiteId: 'harbor-hq', lastCheck: d(0), uptime30d: 100, outages: [] },
  { id: 's4', clientId: 'c3', name: 'Copperline — Edgewood', address: '17 Edgewood Ave', status: 'online', isp: 'Comcast 300M', wanIp: '198.51.100.31', unifiSiteId: 'copper-edge', lastCheck: d(0), uptime30d: 99.9, outages: [] },
  { id: 's5', clientId: 'c3', name: 'Copperline — Decatur', address: '120 E Ponce', status: 'down', isp: 'Spectrum 200M', wanIp: '198.51.100.47', unifiSiteId: 'copper-dec', lastCheck: d(0), uptime30d: 97.4, outages: [{ id: 'o3', start: d(-0.03), cause: 'Gateway unreachable — no heartbeat for 42 min' }] },
  { id: 's6', clientId: 'c4', name: 'Northgate — Warehouse', address: '3100 Airport Rd', status: 'online', isp: 'AT&T Fiber 1G + Starlink', wanIp: '192.0.2.18', unifiSiteId: 'north-wh', lastCheck: d(0), uptime30d: 99.95, outages: [] },
]

export const contracts: T.Contract[] = [
  { id: 'k1', clientId: 'c1', name: 'Master Services Agreement', type: 'MSA', vendor: 'Omni TotalStack MSP', startDate: dd(-420), endDate: dd(310), value: 58200, billing: 'monthly', autoRenew: true },
  { id: 'k2', clientId: 'c1', siteId: 's1', name: 'Huntress Managed EDR + ITDR', type: 'Huntress', vendor: 'Huntress', startDate: dd(-340), endDate: dd(25), value: 3900, billing: 'annual', autoRenew: false },
  { id: 'k3', clientId: 'c1', siteId: 's2', name: 'Comcast Business Internet', type: 'ISP', vendor: 'Comcast', startDate: dd(-700), endDate: dd(-3), value: 2388, billing: 'monthly', autoRenew: false },
  { id: 'k4', clientId: 'c1', name: 'Microsoft 365 Business Premium (28 seats)', type: 'License', vendor: 'Microsoft', startDate: dd(-300), endDate: dd(65), value: 7392, billing: 'annual', autoRenew: true },
  { id: 'k5', clientId: 'c2', name: 'Master Services Agreement', type: 'MSA', vendor: 'Omni TotalStack MSP', startDate: dd(-300), endDate: dd(65), value: 35520, billing: 'monthly', autoRenew: true },
  { id: 'k6', clientId: 'c2', name: 'Huntress Managed EDR', type: 'Huntress', vendor: 'Huntress', startDate: dd(-300), endDate: dd(180), value: 1680, billing: 'annual', autoRenew: true },
  { id: 'k7', clientId: 'c2', name: 'harborpine.com domain', type: 'Domain', vendor: 'Cloudflare', startDate: dd(-360), endDate: dd(9), value: 12, billing: 'annual', autoRenew: false },
  { id: 'k8', clientId: 'c3', name: 'Service Level Agreement — Essential', type: 'SLA', vendor: 'Omni TotalStack MSP', startDate: dd(-190), endDate: dd(175), value: 14880, billing: 'monthly', autoRenew: true },
  { id: 'k9', clientId: 'c3', siteId: 's5', name: 'UniFi Gateway warranty', type: 'Warranty', vendor: 'Ubiquiti', startDate: dd(-700), endDate: dd(-40), value: 0, billing: 'one-time', autoRenew: false },
  { id: 'k10', clientId: 'c4', name: 'Master Services Agreement', type: 'MSA', vendor: 'Omni TotalStack MSP', startDate: dd(-250), endDate: dd(115), value: 44100, billing: 'monthly', autoRenew: true },
  { id: 'k11', clientId: 'c4', name: 'Huntress Managed EDR + SAT', type: 'Huntress', vendor: 'Huntress', startDate: dd(-250), endDate: dd(18), value: 2640, billing: 'annual', autoRenew: false },
  { id: 'k12', clientId: 'c4', siteId: 's6', name: 'Starlink Business', type: 'Subscription', vendor: 'Starlink', startDate: dd(-120), endDate: dd(245), value: 3000, billing: 'monthly', autoRenew: true },
]

const dev = (id: string, clientId: string, siteId: string, hostname: string, type: T.Device['type'], os: string, ip: string, extra: Partial<T.Device> = {}): T.Device => ({
  id, clientId, siteId, hostname, type, os, ip, mac: '00:1A:2B:' + id.slice(-2).padStart(2, '0') + ':4C:5D', vendor: type === 'ap' || type === 'switch' || type === 'firewall' ? 'Ubiquiti' : type === 'printer' ? 'HP' : 'Dell',
  status: 'online', cpu: 12 + (id.charCodeAt(1) * 7) % 60, ram: 30 + (id.charCodeAt(1) * 11) % 55, disk: 25 + (id.charCodeAt(1) * 13) % 70, lastSeen: d(0), pendingPatches: 0, huntressAgent: !['ap', 'switch', 'firewall', 'printer'].includes(type), rmmAgent: !['ap', 'switch', 'printer'].includes(type), ...extra,
})

export const devices: T.Device[] = [
  dev('d1', 'c1', 's1', 'BSD-GW-MID', 'firewall', 'UniFi OS 4.1', '10.10.0.1'),
  dev('d2', 'c1', 's1', 'BSD-FRONT-01', 'workstation', 'Windows 11 24H2', '10.10.10.21', { pendingPatches: 2, assignedUser: 'Front Desk', warrantyEnd: dd(120), backupStatus: 'ok' }),
  dev('d3', 'c1', 's1', 'BSD-OP1', 'workstation', 'Windows 11 24H2', '10.10.10.31', { assignedUser: 'Operatory 1', warrantyEnd: dd(-20), backupStatus: 'ok' }),
  dev('d4', 'c1', 's2', 'BSD-IMG-SRV', 'server', 'Windows Server 2022', '10.20.0.10', { status: 'warning', disk: 91, pendingPatches: 4, backupStatus: 'failed', warrantyEnd: dd(200) }),
  dev('d5', 'c1', 's2', 'BSD-PRN-BUCK', 'printer', 'HP LaserJet M507', '10.20.0.50', { toner: 8 }),
  dev('d6', 'c2', 's3', 'HP-GW', 'firewall', 'UniFi OS 4.1', '10.30.0.1'),
  dev('d7', 'c2', 's3', 'HP-JOKAFOR-LT', 'laptop', 'Windows 11 24H2', '10.30.10.14', { assignedUser: 'James Okafor', backupStatus: 'ok', warrantyEnd: dd(400) }),
  dev('d8', 'c2', 's3', 'HP-PARA-02', 'workstation', 'Windows 11 23H2', '10.30.10.22', { pendingPatches: 6, status: 'offline', lastSeen: d(-3) }),
  dev('d9', 'c2', 's3', 'HP-MFP-01', 'printer', 'Canon imageRUNNER C3930', '10.30.0.60', { toner: 64 }),
  dev('d10', 'c3', 's4', 'CC-POS-01', 'workstation', 'Windows 11 IoT', '10.40.20.5', { pendingPatches: 1 }),
  dev('d11', 'c3', 's5', 'CC-GW-DEC', 'firewall', 'UniFi OS 4.0', '10.41.0.1', { status: 'offline', lastSeen: d(-0.03) }),
  dev('d12', 'c3', 's5', 'CC-AP-DEC', 'ap', 'UniFi U7 Pro', '10.41.0.20', { status: 'offline', lastSeen: d(-0.03) }),
  dev('d13', 'c4', 's6', 'NG-DC01', 'server', 'Windows Server 2022', '10.60.0.5', { backupStatus: 'ok', pendingPatches: 3 }),
  dev('d14', 'c4', 's6', 'NG-DISPATCH-01', 'workstation', 'Windows 11 24H2', '10.60.10.11', { huntressAgent: false, assignedUser: 'Dispatch' }),
  dev('d15', 'c4', 's6', 'NG-SW-CORE', 'switch', 'UniFi Pro Max 48 PoE', '10.60.0.2'),
  dev('d16', 'c4', 's6', 'NG-PRN-WH', 'printer', 'Brother HL-L6210DW', '10.60.0.70', { toner: 22 }),
]

export const patches: T.Patch[] = [
  { id: 'p1', kb: 'KB5051234', title: '2026-09 Cumulative Update for Windows 11 24H2', product: 'Windows 11', severity: 'critical', releaseDate: dd(-13), openIssues: 0, deployedCount: 0 },
  { id: 'p2', kb: 'KB5050011', title: '2026-08 Cumulative Update for Windows 11 24H2', product: 'Windows 11', severity: 'critical', releaseDate: dd(-41), openIssues: 0, deployedCount: 38, deployedAt: d(-5) },
  { id: 'p3', kb: 'KB5050789', title: '2026-09 Security Update for Windows Server 2022', product: 'Windows Server', severity: 'important', releaseDate: dd(-20), lastIssueReported: dd(-9), openIssues: 0, deployedCount: 0 },
  { id: 'p4', kb: 'CHROME-141', title: 'Google Chrome 141 stable', product: 'Chrome', severity: 'important', releaseDate: dd(-17), openIssues: 0, deployedCount: 0 },
  { id: 'p5', kb: 'M365-2609', title: 'Microsoft 365 Apps Current Channel 2609', product: 'Microsoft 365 Apps', severity: 'moderate', releaseDate: dd(-22), openIssues: 2, deployedCount: 0 },
  { id: 'p6', kb: 'UNIFI-4.2', title: 'UniFi OS 4.2 firmware (gateways)', product: 'UniFi', severity: 'important', releaseDate: dd(-4), openIssues: 0, deployedCount: 0 },
  { id: 'p7', kb: 'ADOBE-APSB26', title: 'Adobe Acrobat Reader APSB26-41', product: 'Adobe Reader', severity: 'critical', releaseDate: dd(-26), openIssues: 0, deployedCount: 21, deployedAt: d(-3) },
]

const tk = (n: number, clientId: string, title: string, priority: T.Ticket['priority'], status: T.Ticket['status'], ageH: number, slaH: number, extra: Partial<T.Ticket> = {}): T.Ticket => ({
  id: 't' + n, number: 1000 + n, clientId, title, description: title, priority, status, category: 'Support', createdAt: d(-ageH / 24), slaDueAt: d((slaH - ageH) / 24), billable: false, hours: 0, ...extra,
})
export const tickets: T.Ticket[] = [
  tk(1, 'c3', 'Decatur cafe — internet down, POS offline', 'P1', 'in_progress', 0.7, 4, { assignee: 'Marcus Lee', category: 'Network' }),
  tk(2, 'c1', 'Imaging server backup failed', 'P2', 'new', 3, 8, { category: 'Backup' }),
  tk(3, 'c1', 'Buckhead printer low toner / jam', 'P3', 'waiting', 20, 24, { assignee: 'Marcus Lee', category: 'Print' }),
  tk(4, 'c2', 'New paralegal onboarding — laptop + M365', 'P3', 'in_progress', 30, 48, { assignee: 'Dana Ortiz', billable: true, hours: 3.5, category: 'Onboarding' }),
  tk(5, 'c4', 'Warehouse scanner Wi-Fi drops', 'P2', 'in_progress', 10, 8, { assignee: 'Dana Ortiz', category: 'Network' }),
  tk(6, 'c2', 'Outlook signature update firm-wide', 'P4', 'resolved', 60, 72, { billable: true, hours: 1.5, category: 'M365' }),
  tk(7, 'c4', 'After-hours server reboot (billable)', 'P3', 'resolved', 90, 72, { billable: true, hours: 2, category: 'Server' }),
  tk(8, 'c1', 'Huntress: suspicious PowerShell on BSD-OP1 (isolated)', 'P1', 'resolved', 100, 4, { assignee: 'Marcus Lee', category: 'Security' }),
]

export const projects: T.Project[] = [
  { id: 'pr1', clientId: 'c1', name: 'Buckhead network refresh + LTE failover', status: 'on_track', progress: 65, start: dd(-20), end: dd(15), budget: 9800, billableHours: 22, milestones: [{ name: 'Site survey', due: dd(-15), done: true }, { name: 'Hardware received', due: dd(-5), done: true }, { name: 'Cutover weekend', due: dd(8), done: false }, { name: 'Documentation & handoff', due: dd(15), done: false }] },
  { id: 'pr2', clientId: 'c4', name: 'Warehouse Wi-Fi 7 upgrade', status: 'at_risk', progress: 35, start: dd(-10), end: dd(20), budget: 14200, billableHours: 11, milestones: [{ name: 'Heatmap survey', due: dd(-6), done: true }, { name: 'APs on backorder', due: dd(4), done: false }, { name: 'Install', due: dd(14), done: false }] },
  { id: 'pr3', clientId: 'c2', name: 'Intune / Autopilot rollout', status: 'on_track', progress: 80, start: dd(-40), end: dd(5), budget: 6200, billableHours: 31, milestones: [{ name: 'Pilot group', due: dd(-25), done: true }, { name: 'All users enrolled', due: dd(5), done: false }] },
]

export const inventory: T.InventoryItem[] = [
  { id: 'i1', sku: 'UCG-FIBER', name: 'UniFi Cloud Gateway Fiber', category: 'Network', qty: 2, reorderAt: 2, cost: 279, price: 599, location: 'Shelf A1', warrantyMonths: 12, receivedAt: dd(-30) },
  { id: 'i2', sku: 'U7-PRO', name: 'UniFi U7 Pro Access Point', category: 'Network', qty: 1, reorderAt: 4, cost: 189, price: 219, location: 'Shelf A2', warrantyMonths: 12, receivedAt: dd(-60) },
  { id: 'i3', sku: 'USW-PRO-24-POE', name: 'UniFi Switch Pro 24 PoE', category: 'Network', qty: 3, reorderAt: 1, cost: 599, price: 799, location: 'Shelf A3', warrantyMonths: 12, receivedAt: dd(-15) },
  { id: 'i4', sku: 'DELL-LAT-7450', name: 'Dell Latitude 7450 (i7/16GB/512GB)', category: 'Computer', qty: 4, reorderAt: 2, cost: 1180, price: 1495, location: 'Cage B', warrantyMonths: 36, receivedAt: dd(-10) },
  { id: 'i5', sku: 'DELL-OPT-7020', name: 'Dell OptiPlex 7020 Micro', category: 'Computer', qty: 0, reorderAt: 2, cost: 780, price: 995, location: 'Cage B', warrantyMonths: 36, receivedAt: dd(-200) },
  { id: 'i6', sku: 'HP-CF289A', name: 'HP 89A black toner', category: 'Consumable', qty: 1, reorderAt: 3, cost: 145, price: 189, location: 'Print bin', warrantyMonths: 0, receivedAt: dd(-40) },
  { id: 'i7', sku: 'CAT6-1000', name: 'Cat6 plenum cable 1000ft', category: 'Cable', qty: 5, reorderAt: 2, cost: 165, price: 240, location: 'Floor', warrantyMonths: 0, receivedAt: dd(-90) },
  { id: 'i8', sku: 'DELL-P2425', name: 'Dell 24" monitor P2425', category: 'Peripheral', qty: 6, reorderAt: 3, cost: 165, price: 229, location: 'Shelf C1', warrantyMonths: 36, receivedAt: dd(-400) },
]

export const purchaseOrders: T.PurchaseOrder[] = [
  { id: 'po1', number: 'PO-2041', vendor: 'Ubiquiti Store (via distributor)', clientId: 'c4', items: [{ name: 'UniFi U7 Pro Access Point', sku: 'U7-PRO', qty: 12, cost: 189, price: 219 }], status: 'backordered', eta: dd(6), createdAt: d(-8) },
  { id: 'po2', number: 'PO-2042', vendor: 'Dell Technologies', clientId: 'c2', items: [{ name: 'Dell Latitude 7450', sku: 'DELL-LAT-7450', qty: 2, cost: 1180, price: 1495 }], status: 'shipped', eta: dd(2), tracking: '1Z999AA10123456784', createdAt: d(-4) },
  { id: 'po3', number: 'PO-2043', vendor: 'CDW', items: [{ name: 'HP 89A black toner', sku: 'HP-CF289A', qty: 6, cost: 145, price: 189 }], status: 'pending_approval', createdAt: d(-1) },
]

const inv = (id: string, number: string, clientId: string, issue: number, status: T.Invoice['status'], lines: [string, number, number, T.InvoiceLine['source']?][], extra: Partial<T.Invoice> = {}): T.Invoice => ({
  id, number, clientId, issueDate: dd(issue), dueDate: dd(issue + 30), status, lastServiceDate: dd(issue - 1), taxRate: 0,
  workDescription: 'Managed IT services, cybersecurity monitoring (Huntress), network management and related labor per Master Services Agreement.',
  lines: lines.map(([description, qty, rate, source], i) => ({ id: id + 'l' + i, description, qty, rate, source: source ?? 'sla' })), ...extra,
})
export const invoices: T.Invoice[] = [
  inv('inv1', 'INV-1101', 'c1', -35, 'paid', [['Managed IT — Premium (28 users)', 28, 185], ['Huntress Managed EDR (34 endpoints)', 34, 7]], { paidDate: dd(-8), recurring: 'monthly' }),
  inv('inv2', 'INV-1102', 'c2', -48, 'overdue', [['Managed IT — Advanced (20 users)', 20, 135], ['Huntress Managed EDR (24 endpoints)', 24, 7], ['Onboarding labor', 3.5, 125, 'ticket']], { recurring: 'monthly' }),
  inv('inv3', 'INV-1103', 'c3', -20, 'sent', [['Managed IT — Essential (12 users)', 12, 95], ['Huntress Managed EDR (14 endpoints)', 14, 7]], { recurring: 'monthly' }),
  inv('inv4', 'INV-1104', 'c4', -62, 'overdue', [['Managed IT — Advanced (25 users)', 25, 135], ['UniFi Switch Pro 24 PoE', 1, 799, 'hardware'], ['After-hours server maintenance', 2, 187.5, 'ticket']], { recurring: 'monthly' }),
  inv('inv5', 'INV-1105', 'c1', -5, 'sent', [['Managed IT — Premium (28 users)', 28, 185], ['Huntress Managed EDR (34 endpoints)', 34, 7]], { recurring: 'monthly' }),
]

export const payments: T.Payment[] = [
  { id: 'pay1', invoiceId: 'inv1', clientId: 'c1', amount: 5418, date: d(-8), method: 'ach' },
]

export const employees: T.Employee[] = [
  { id: 'e1', name: 'Jordan Reyes (Owner)', email: 'jordan@peachtreeit.example', role: 'Owner / vCIO', appRole: 'owner', type: 'W2', rate: 0, hoursThisPeriod: 72, ptoBalance: 0, directDeposit: 'active', startDate: dd(-500), certifications: ['CompTIA Security+'], w4OnFile: true, i9OnFile: true },
  { id: 'e2', name: 'Marcus Lee', email: 'marcus@peachtreeit.example', role: 'Tier 2 Technician', appRole: 'technician', type: 'W2', rate: 32, hoursThisPeriod: 76.5, ptoBalance: 36, directDeposit: 'active', startDate: dd(-300), certifications: ['Network+', 'Huntress Certified'], w4OnFile: true, i9OnFile: true },
  { id: 'e3', name: 'Dana Ortiz', email: 'dana@peachtreeit.example', role: 'Tier 1 Technician', appRole: 'technician', type: 'W2', rate: 25, hoursThisPeriod: 80, ptoBalance: 22, directDeposit: 'pending', startDate: dd(-45), certifications: ['A+'], w4OnFile: true, i9OnFile: false },
  { id: 'e4', name: 'Sam Patel', email: 'sam@cabling.example', role: 'Cabling Contractor', appRole: 'technician', type: '1099', rate: 55, hoursThisPeriod: 18, ptoBalance: 0, directDeposit: 'active', startDate: dd(-120), certifications: ['BICSI Installer'], w4OnFile: false, i9OnFile: false },
  { id: 'e5', name: 'Rita Gomez', email: 'rita@peachtreeit.example', role: 'Bookkeeper (part-time)', appRole: 'finance', type: '1099', rate: 40, hoursThisPeriod: 12, ptoBalance: 0, directDeposit: 'active', startDate: dd(-200), certifications: ['QuickBooks ProAdvisor'], w4OnFile: false, i9OnFile: false },
]

export const expenses: T.Expense[] = [
  { id: 'x1', date: dd(-3), vendor: 'Huntress', category: 'Cost of Goods Sold: Security licensing', amount: 1840, status: 'unpaid', dueDate: dd(12) },
  { id: 'x2', date: dd(-5), vendor: 'NinjaOne', category: 'Cost of Goods Sold: RMM licensing', amount: 640, status: 'paid' },
  { id: 'x3', date: dd(-9), vendor: 'Pax8', category: 'Cost of Goods Sold: Microsoft licensing', amount: 5120, status: 'unpaid', dueDate: dd(5) },
  { id: 'x4', date: dd(-12), vendor: 'Dell Technologies', category: 'Inventory purchases', amount: 2360, status: 'paid' },
  { id: 'x5', date: dd(-14), vendor: 'WeWork', category: 'Rent & lease', amount: 1450, status: 'paid' },
  { id: 'x6', date: dd(-2), vendor: 'State Farm', category: 'Insurance: Cyber & E&O', amount: 385, status: 'paid' },
  { id: 'x7', date: dd(-1), vendor: 'Shell', category: 'Auto & travel', amount: 96, status: 'paid' },
]

export const leads: T.Lead[] = [
  { id: 'l1', name: 'Priya Nair', email: 'priya@lumenwellness.example', phone: '(555) 201-5500', company: 'Lumen Wellness Studio', employees: '10-25', interest: ['Cybersecurity', 'Managed IT'], message: 'Opening second studio, need secure Wi-Fi and HIPAA help.', source: 'booking', status: 'proposal', createdAt: d(-6) },
  { id: 'l2', name: 'Derek Walsh', email: 'derek@walshcpa.example', phone: '(555) 301-7788', company: 'Walsh CPA', employees: '1-10', interest: ['Backup', 'Cybersecurity'], message: 'Tax season is coming, worried about ransomware.', source: 'ai_call', status: 'new', createdAt: d(-0.3), callRequested: true },
]

export const appointments: T.Appointment[] = [
  { id: 'a1', leadId: 'l1', name: 'Priya Nair', email: 'priya@lumenwellness.example', start: d(2), topic: 'Proposal walkthrough', status: 'booked' },
]

export const roadmap: T.RoadmapItem[] = [
  { id: 'r1', clientId: 'c1', category: 'Backup', finding: 'Imaging server backups failing intermittently', recommendation: 'Move to BCDR appliance with hourly snapshots', priority: 'high', quarter: 'Q4 2026', status: 'planned', estCost: 3200 },
  { id: 'r2', clientId: 'c1', category: 'Hardware', finding: '6 workstations out of warranty', recommendation: 'Replace with OptiPlex Micro on 4-year cycle', priority: 'medium', quarter: 'Q1 2027', status: 'open', estCost: 6000 },
  { id: 'r3', clientId: 'c1', category: 'Compliance', finding: 'Annual HIPAA risk assessment due', recommendation: 'Run SRA + update policies', priority: 'high', quarter: 'Q4 2026', status: 'open', estCost: 1500 },
  { id: 'r4', clientId: 'c2', category: 'Security', finding: 'Conditional Access not enforced for guests', recommendation: 'Enforce CA baseline + phishing-resistant MFA for partners', priority: 'high', quarter: 'Q4 2026', status: 'planned', estCost: 900 },
  { id: 'r5', clientId: 'c4', category: 'Network', finding: 'Warehouse Wi-Fi dead zones', recommendation: 'Wi-Fi 7 upgrade (project in progress)', priority: 'high', quarter: 'Q4 2026', status: 'planned', estCost: 14200 },
  { id: 'r6', clientId: 'c3', category: 'Process', finding: 'Manual end-of-day sales reconciliation', recommendation: 'Automate POS → QuickBooks sync', priority: 'low', quarter: 'Q1 2027', status: 'open', estCost: 1500 },
]

export const credentials: T.Credential[] = [
  { id: 'cr1', clientId: 'c1', system: 'UniFi Gateway (Midtown)', username: 'omni-admin', lastRotated: dd(-95), rotateEveryDays: 90, vaultRef: 'vault://bright/unifi-mid' },
  { id: 'cr2', clientId: 'c1', system: 'Domain Admin (break-glass)', username: 'bsd\\omni-bg', lastRotated: dd(-20), rotateEveryDays: 60, vaultRef: 'vault://bright/da-bg' },
  { id: 'cr3', clientId: 'c2', system: 'Microsoft 365 Global Admin', username: 'omni-ga@harborpine.onmicrosoft.com', lastRotated: dd(-40), rotateEveryDays: 90, vaultRef: 'vault://harbor/ga' },
  { id: 'cr4', clientId: 'c4', system: 'Local admin (LAPS)', username: 'LAPS managed', lastRotated: dd(-1), rotateEveryDays: 30, vaultRef: 'vault://north/laps' },
]

export const directoryUsers: T.DirectoryUser[] = [
  { id: 'u1', clientId: 'c1', displayName: 'Maya Chen', upn: 'maya@brightsidedental.example', license: 'M365 Business Premium', mfa: true, groups: ['Owners', 'All Staff'], lastSignIn: d(-0.1), enabled: true },
  { id: 'u2', clientId: 'c1', displayName: 'Front Desk', upn: 'frontdesk@brightsidedental.example', license: 'M365 Business Standard', mfa: false, groups: ['All Staff'], lastSignIn: d(-0.5), enabled: true },
  { id: 'u3', clientId: 'c1', displayName: 'Former Hygienist', upn: 'jlee@brightsidedental.example', license: 'M365 Business Premium', mfa: true, groups: ['All Staff'], lastSignIn: d(-64), enabled: true },
  { id: 'u4', clientId: 'c2', displayName: 'James Okafor', upn: 'jokafor@harborpine.example', license: 'M365 E3', mfa: true, groups: ['Partners', 'All Staff'], lastSignIn: d(-0.05), enabled: true },
  { id: 'u5', clientId: 'c2', displayName: 'Paralegal 2', upn: 'para2@harborpine.example', license: 'M365 Business Premium', mfa: true, groups: ['Paralegals'], lastSignIn: d(-3), enabled: true },
  { id: 'u6', clientId: 'c4', displayName: 'Tom Becker', upn: 'tbecker@northgate.example', license: 'M365 Business Premium', mfa: true, groups: ['Finance', 'Leadership'], lastSignIn: d(-0.2), enabled: true },
]

export const documents: T.ClientDocument[] = [
  { id: 'doc1', clientId: 'c1', name: 'Master Services Agreement (signed)', category: 'Agreement', createdAt: d(-420), status: 'signed' },
  { id: 'doc2', clientId: 'c1', name: 'HIPAA Business Associate Agreement', category: 'Agreement', createdAt: d(-420), status: 'signed' },
  { id: 'doc3', clientId: 'c1', name: 'New-hire onboarding SOP', category: 'SOP', createdAt: d(-200), body: '1. Create user in Entra ID from template\n2. Assign Business Premium license\n3. Add to All Staff group\n4. Enroll device in Intune\n5. Enroll in Huntress SAT' },
  { id: 'doc4', clientId: 'c1', name: 'Network diagram — Midtown', category: 'Network', createdAt: d(-30) },
  { id: 'doc5', clientId: 'c2', name: 'Master Services Agreement (signed)', category: 'Agreement', createdAt: d(-300), status: 'signed' },
  { id: 'doc6', clientId: 'c2', name: 'Q3 2026 Business Review', category: 'QBR', createdAt: d(-10) },
  { id: 'doc7', clientId: 'c3', name: 'SLA — Essential (signed)', category: 'Agreement', createdAt: d(-190), status: 'signed' },
  { id: 'doc8', clientId: 'c3', name: 'PCI network segmentation runbook', category: 'SOP', createdAt: d(-150) },
  { id: 'doc9', clientId: 'c4', name: 'Master Services Agreement (signed)', category: 'Agreement', createdAt: d(-250), status: 'signed' },
]

export const scans: T.DiscoveryScan[] = [
  { id: 'sc1', siteId: 's1', clientId: 'c1', range: '10.10.0.0/16', startedAt: d(-1), source: 'agent', hosts: [
    { ip: '10.10.0.1', mac: '74:83:C2:11:22:33', hostname: 'BSD-GW-MID', vendor: 'Ubiquiti', guessedType: 'firewall', openPorts: [22, 443], isNew: false },
    { ip: '10.10.10.21', mac: '00:1A:2B:01:4C:5D', hostname: 'BSD-FRONT-01', vendor: 'Dell', guessedType: 'workstation', openPorts: [135, 445, 3389], isNew: false, risk: 'RDP exposed internally' },
    { ip: '10.10.30.77', mac: 'B8:27:EB:99:10:01', hostname: 'raspberrypi', vendor: 'Raspberry Pi Foundation', guessedType: 'iot', openPorts: [22, 80], isNew: true, risk: 'Unknown device with SSH open' },
    { ip: '10.10.30.80', mac: '3C:2A:F4:55:66:77', hostname: 'NPI5566', vendor: 'Brother', guessedType: 'printer', openPorts: [80, 443, 9100, 631], isNew: true },
  ] },
]

export const releases = [
  { version: '1.2.0', date: dd(0), title: 'New plans', items: ['Plans are now Unlimited ($99/mo), Business ($249/mo) and Enterprise ($4,500 one-time)', 'Enterprise owners get their own standalone copy on their own domain, disconnected from Omni', 'Download all your data any time from Plan & Billing'], tourTargets: ['nav-billing'] },
  { version: '1.1.0', date: dd(0), title: 'Omni goes multi-company', items: ['Every MSP gets its own branded workspace, website and client portal', 'Plan & Billing: upgrade, downgrade and update your card (Stripe)', 'Team & Client Logins: invite technicians and give clients portal access', 'Website & domain: your own address or custom domain (Business+)', 'Workspaces pause automatically 7 days after a failed payment and reactivate the moment you pay'], tourTargets: ['nav-billing', 'nav-team', 'nav-admin'] },
  { version: '1.0.0', date: dd(0), title: 'Omni TotalStack MSP launch', items: ['Business Suite: clients, documents, proposals (3 options), RFS PDFs', 'Management Hub: sites, outages, contracts with red expiry alerts', '15-day patch soak policy + weekly client update emails', 'Network discovery agent + import', 'Finance: QuickBooks panel, payroll, drag-and-drop invoice builder, payments, non-payment notices', 'Landing page with lead capture, AI voice calls and booking'], tourTargets: ['nav-clients', 'nav-proposals', 'nav-patching', 'nav-finance'] },
]
