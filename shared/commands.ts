// Omni Command Console: turns plain-English commands into a safe, previewable plan.
// Shared by the app (instant preview) and the API (which re-parses the text itself before running anything).
//
//   "update windows 11 on all devices at Acme"   → patch (15-day soak policy enforced)
//   "disable user john@acme.com"                 → Entra ID
//   "add user Jane Doe jane@acme.local in active directory" → Windows Server AD (via Tactical RMM)
//   "install chrome on all devices at Acme"      → Chocolatey (via Tactical RMM)

export type Intent =
  | 'patch' | 'patch_status' | 'install' | 'upgrade' | 'uninstall' | 'reboot' | 'shutdown' | 'run' | 'service_restart' | 'gpupdate'
  | 'user_add' | 'user_disable' | 'user_enable' | 'user_delete' | 'user_reset' | 'user_unlock' | 'user_signout' | 'list_users'
  | 'vm_start' | 'vm_stop' | 'vm_reboot' | 'vm_snapshot' | 'vm_list'
  | 'backup_status' | 'nas_status' | 'monitor_status' | 'ticket' | 'carrier_ticket' | 'remote' | 'find'

export type Risk = 'read' | 'change' | 'destructive'

export interface CmdClient { id: string; name: string }
export interface CmdDevice { hostname: string; clientId: string }
export interface Target { scope: 'all' | 'client' | 'devices' | 'none'; clientId?: string; clientName?: string; devices: string[] }

export interface ParsedCommand {
  raw: string
  intent: Intent
  target: Target
  /** user, displayName, password-less; pkg; cmd; service; vm; product; subject; system */
  params: Record<string, string>
}

export interface PlanStep { integration: string; name: string; connected: boolean; via?: string }
export interface Plan {
  ok: boolean
  parsed?: ParsedCommand
  title: string
  detail: string[]
  risk: Risk
  role: 'technician' | 'admin'
  confirmWord?: string
  steps: PlanStep[]
  problems: string[]
}

export const INTEGRATION_NAMES: Record<string, string> = {
  omni: 'Omni', rmm: 'RMM (NinjaOne/Atera)', tacticalrmm: 'Tactical RMM', automox: 'Automox', chocolatey: 'Chocolatey', winserver: 'Windows Server AD',
  entra: 'Microsoft Entra ID', m365: 'Microsoft 365', webex: 'Webex', proxmox: 'Proxmox VE', pbs: 'Proxmox Backup Server', synology: 'Synology',
  backup: 'Backup (Datto/Veeam)', uptimekuma: 'Uptime Kuma', zammad: 'Zammad', itflow: 'ITFlow', fusion: 'Fusion Connect', rustdesk: 'RustDesk',
  lansweeper: 'Lansweeper', unifi: 'UniFi', huntress: 'Huntress',
}

/** Integrations that need another integration to actually reach the devices. */
export const RUNS_VIA: Record<string, string> = { chocolatey: 'tacticalrmm', winserver: 'tacticalrmm' }

const RISK: Record<Intent, Risk> = {
  patch: 'change', patch_status: 'read', install: 'change', upgrade: 'change', uninstall: 'change', reboot: 'change', shutdown: 'change', run: 'change',
  service_restart: 'change', gpupdate: 'change', user_add: 'change', user_disable: 'change', user_enable: 'change', user_delete: 'destructive', user_reset: 'change',
  user_unlock: 'change', user_signout: 'change', list_users: 'read', vm_start: 'change', vm_stop: 'change', vm_reboot: 'change', vm_snapshot: 'change', vm_list: 'read',
  backup_status: 'read', nas_status: 'read', monitor_status: 'read', ticket: 'change', carrier_ticket: 'change', remote: 'read', find: 'read',
}
const ADMIN_ONLY: Intent[] = ['user_add', 'user_delete', 'user_reset', 'run']

/** Friendly software names → Chocolatey package ids. */
export const CHOCO: Record<string, string> = {
  chrome: 'googlechrome', 'google chrome': 'googlechrome', firefox: 'firefox', edge: 'microsoft-edge', 'microsoft edge': 'microsoft-edge', zoom: 'zoom',
  teams: 'microsoft-teams-new-bootstrapper', 'microsoft teams': 'microsoft-teams-new-bootstrapper', office: 'office365business', 'microsoft 365': 'office365business',
  'adobe reader': 'adobereader', 'acrobat reader': 'adobereader', 'adobe acrobat reader': 'adobereader', '7zip': '7zip', '7-zip': '7zip', vlc: 'vlc', 'notepad++': 'notepadplusplus',
  putty: 'putty', winscp: 'winscp', java: 'temurin21jre', python: 'python', git: 'git', 'vs code': 'vscode', vscode: 'vscode', slack: 'slack', webex: 'webex',
  rustdesk: 'rustdesk', 'tactical agent': 'tacticalrmm', greenshot: 'greenshot', 'dell command update': 'dellcommandupdate', 'hp support assistant': 'hpsupportassistant',
  quickbooks: 'quickbooks', 'google drive': 'googledrive', onedrive: 'onedrive', dropbox: 'dropbox', 'windows terminal': 'microsoft-windows-terminal', powershell: 'powershell-core',
}

const EMAIL = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const unquote = (s: string) => s.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '')

function findClient(text: string, clients: CmdClient[]) {
  const t = text.toLowerCase()
  // Longest names first so "Acme Medical" wins over "Acme"
  const sorted = [...clients].sort((a, b) => b.name.length - a.name.length)
  for (const c of sorted) if (t.includes(c.name.toLowerCase())) return c
  for (const c of sorted) {
    const first = c.name.toLowerCase().split(/[\s,&-]+/).filter((w) => w.length > 2 && !['the', 'and', 'llc', 'inc', 'group'].includes(w))[0]
    if (first && new RegExp(`\\b(at|for|client)\\s+${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t)) return c
  }
  return undefined
}

function findDevices(text: string, devices: CmdDevice[]) {
  const words = new Set(text.split(/[\s,;]+/).map((w) => unquote(w).toLowerCase()))
  return devices.filter((d) => words.has(d.hostname.toLowerCase())).map((d) => d.hostname)
}

function target(raw: string, clients: CmdClient[], devices: CmdDevice[]): Target {
  const t = raw.toLowerCase()
  const c = findClient(raw, clients)
  const devs = findDevices(raw, devices)
  if (devs.length) return { scope: 'devices', devices: devs, clientId: c?.id, clientName: c?.name }
  if (c) return { scope: 'client', clientId: c.id, clientName: c.name, devices: [] }
  if (/\b(all|every|each)\s+(devices|computers|pcs|machines|workstations|endpoints|servers|agents)\b|\beverywhere\b|\ball clients\b/.test(t)) return { scope: 'all', devices: [] }
  // Unknown hostname after "on" (device Omni doesn't know yet — the RMM may)
  const lead = raw.match(/^(?:reboot|restart|shut ?down|power off|turn off|connect(?: to)?|remote(?: in(?:to)?)?|rustdesk|take control(?: of)?)\s+([A-Za-z0-9][A-Za-z0-9-]{1,62})\s*$/i)
  if (lead && !/^(all|every|vm|ct|the|service)$/i.test(lead[1])) return { scope: 'devices', devices: [lead[1].toUpperCase()] }
  const m = raw.match(/\bon\s+([A-Za-z0-9][A-Za-z0-9-]{1,62})\s*$/)
  if (m && !/^(all|every)$/i.test(m[1])) return { scope: 'devices', devices: [m[1].toUpperCase()] }
  return { scope: 'none', devices: [] }
}

function system(t: string): string | undefined {
  if (/\bwebex\b/.test(t)) return 'webex'
  if (/\b(active directory|on-?prem(ise)?s?|domain controller|\bin ad\b|windows server)\b/.test(t) || /\bin ad\b/.test(t)) return 'winserver'
  if (/\b(entra|azure ad|microsoft 365|m365|office 365|o365)\b/.test(t)) return 'entra'
  if (/\bzammad\b/.test(t)) return 'zammad'
  if (/\bitflow\b/.test(t)) return 'itflow'
  if (/\bautomox\b/.test(t)) return 'automox'
  if (/\btactical\b/.test(t)) return 'tacticalrmm'
  if (/\b(ninja|ninjaone|atera)\b/.test(t)) return 'rmm'
  if (/\bsynology\b|\bnas\b/.test(t)) return 'synology'
  if (/\b(pbs|proxmox backup)\b/.test(t)) return 'pbs'
  return undefined
}

/** Product phrase for patch commands: "update windows 11 on all devices" → "windows 11". */
function product(rest: string) {
  return clean(rest.replace(/\b(on|at|for|in|via|with)\b.*$/i, '').replace(/\b(updates?|patches|patch|all|the|latest|security|cumulative|now)\b/gi, ' '))
}

export function parseCommand(input: string, clients: CmdClient[] = [], devices: CmdDevice[] = []): ParsedCommand | null {
  const raw = clean(input.replace(/[.!?]+$/, ''))
  if (!raw) return null
  const t = raw.toLowerCase()
  const tg = target(raw, clients, devices)
  const sys = system(t)
  const p: Record<string, string> = {}
  if (sys) p.system = sys
  const mk = (intent: Intent): ParsedCommand => ({ raw, intent, target: tg, params: p })
  const email = raw.match(EMAIL)?.[0]

  // ── Users ───────────────────────────────────────────────
  const userId = () => {
    if (email) return email
    const m = raw.match(/\b(?:user|account|for)\s+([A-Za-z0-9._'-]{2,64})/i)
    return m && !['in', 'on', 'at', 'for', 'user', 'account'].includes(m[1].toLowerCase()) ? m[1] : ''
  }
  if (/^(add|create|new|onboard)\b.*\b(user|account|employee)\b/.test(t)) {
    p.user = email || ''
    const name = raw.replace(/^(add|create|new|onboard)\s+(a\s+)?(new\s+)?(user|account|employee)\s*/i, '').replace(EMAIL, '').replace(/\b(in|on|at|for|to)\b.*$/i, '')
    p.displayName = clean(unquote(name))
    if (!p.user) { const m = raw.match(/\busername\s+([A-Za-z0-9._-]+)/i); if (m) p.user = m[1] }
    return mk('user_add')
  }
  if (/^(disable|block|suspend|lock out|deactivate)\b/.test(t) && /\b(user|account|login|@)/.test(t)) { p.user = userId(); return mk('user_disable') }
  if (/^(enable|unblock|reactivate|re-enable)\b/.test(t) && /\b(user|account|login|@)/.test(t)) { p.user = userId(); return mk('user_enable') }
  if (/^(delete|remove|offboard|terminate)\b/.test(t) && /\b(user|account|employee|@)/.test(t)) { p.user = userId(); return mk('user_delete') }
  if (/\breset\b.*\bpassword\b|\bpassword reset\b/.test(t)) { p.user = userId() || (raw.match(/password\s+(?:for\s+)?([A-Za-z0-9._'-]{2,64})/i)?.[1] ?? ''); return mk('user_reset') }
  if (/^unlock\b/.test(t)) { p.user = userId(); p.system = 'winserver'; return mk('user_unlock') }
  if (/\b(sign|log)\s*out\b|\brevoke\b.*\bsessions?\b/.test(t)) { p.user = userId(); return mk('user_signout') }
  if (/^(list|show|get)\b.*\busers\b/.test(t)) return mk('list_users')

  // ── Virtual machines (Proxmox) ─────────────────────────
  const vm = raw.match(/\b(?:vm|ct|container|virtual machine)\s+([A-Za-z0-9._-]+)/i)
  if (/^(list|show)\b.*\b(vms|virtual machines|containers)\b/.test(t)) return mk('vm_list')
  if (vm) {
    p.vm = vm[1]
    if (/^(start|boot|power on)\b/.test(t)) return mk('vm_start')
    if (/^(stop|shut ?down|power off)\b/.test(t)) return mk('vm_stop')
    if (/^(restart|reboot)\b/.test(t)) return mk('vm_reboot')
    if (/^(snapshot|snap)\b|\btake a snapshot\b/.test(t)) return mk('vm_snapshot')
  }

  // ── Status & lookups ───────────────────────────────────
  if (/\b(patch|update)\s+status\b|\bwhat (patches|updates) are (pending|waiting)\b/.test(t)) return mk('patch_status')
  if (/\bbackups?\b.*\b(status|report|failed|failing)\b|\b(failed|failing)\s+backups?\b/.test(t)) return mk('backup_status')
  if (/\bnas\b.*\bstatus\b|\bsynology\b.*\bstatus\b|\bstorage status\b/.test(t)) return mk('nas_status')
  if (/\bmonitors?\b.*\bstatus\b|\bwhat('?s| is) down\b|\boutages?\b|\buptime\b/.test(t)) return mk('monitor_status')
  if (/^(connect|remote|rustdesk|remote in|remote into|take control)\b/.test(t)) { p.device = tg.devices[0] || clean(raw.replace(/^(connect|remote( in(to)?)?|rustdesk|take control( of)?)\s*(to\s+)?/i, '')).split(' ')[0]; return mk('remote') }
  if (/^(find|where is|locate|look ?up|search)\b|\blist assets\b|\bshow assets\b/.test(t)) { p.query = clean(raw.replace(/^(find|where is|locate|look ?up|search( for)?)\s*(device|computer|asset)?\s*/i, '')); return mk('find') }

  // ── Tickets ─────────────────────────────────────────────
  if (/^(open|create|new|log|submit)\b.*\bticket\b/.test(t)) {
    p.subject = clean(raw.replace(/^.*?\bticket\b\s*(for\s+[^:–-]+)?\s*[:–-]?\s*/i, '')) || 'Support request'
    p.subject = p.subject.replace(/^(in|with)\s+(zammad|itflow)\s*[:–-]?\s*/i, '')
    return mk(/\b(fusion|carrier|isp|circuit)\b/.test(t) ? 'carrier_ticket' : 'ticket')
  }

  // ── Devices ─────────────────────────────────────────────
  const quoted = raw.match(/["“'`](.+?)["”'`]/)?.[1]
  if (/^(run|execute|exec|powershell|cmd)\b/.test(t)) {
    p.cmd = quoted || clean(raw.replace(/^(run|execute|exec|powershell|cmd)\s+/i, '').replace(/\s+\b(on|at)\b\s+.*$/i, ''))
    p.shell = /\bcmd\b/.test(t.split(' ')[0]) ? 'cmd' : 'powershell'
    return mk('run')
  }
  if (/\bflush\s*dns\b/.test(t)) { p.cmd = 'ipconfig /flushdns'; p.shell = 'cmd'; return mk('run') }
  if (/\bgpupdate\b|\bgroup policy\b/.test(t)) return mk('gpupdate')
  const svc = raw.match(/\b(?:restart|start|stop)\s+(?:the\s+)?service\s+([A-Za-z0-9._-]+)/i) || raw.match(/\b(?:restart|start|stop)\s+(?:the\s+)?([A-Za-z0-9._-]+)\s+service\b/i)
  if (svc) { p.service = svc[1]; p.verb = t.startsWith('stop') ? 'Stop' : t.startsWith('start') ? 'Start' : 'Restart'; return mk('service_restart') }
  if (/^(reboot|restart)\b/.test(t)) return mk('reboot')
  if (/^(shut ?down|power off|turn off)\b/.test(t)) return mk('shutdown')

  // ── Software & patching ─────────────────────────────────
  if (/^(update|patch)\b|\binstall\b.*\b(updates|patches)\b|\bwindows updates?\b/.test(t)) {
    p.product = product(raw.replace(/^(update|patch|install)\s+/i, ''))
    return mk('patch')
  }
  if (/^(upgrade)\b/.test(t)) {
    const what = clean(raw.replace(/^upgrade\s+/i, '').replace(/\s+\b(on|at|for)\b\s+.*$/i, ''))
    p.pkg = /^all\b/i.test(what) ? 'all' : (CHOCO[what.toLowerCase()] || what.toLowerCase())
    return mk('upgrade')
  }
  if (/^(install|deploy|push)\b/.test(t)) {
    const what = clean(raw.replace(/^(install|deploy|push)\s+/i, '').replace(/\s+\b(on|at|for|to)\b\s+.*$/i, ''))
    p.pkg = CHOCO[what.toLowerCase()] || what.toLowerCase()
    p.pkgName = what
    return mk('install')
  }
  if (/^(uninstall|remove)\b/.test(t)) {
    const what = clean(raw.replace(/^(uninstall|remove)\s+/i, '').replace(/\s+\b(on|at|from)\b\s+.*$/i, ''))
    p.pkg = CHOCO[what.toLowerCase()] || what.toLowerCase()
    p.pkgName = what
    return mk('uninstall')
  }
  return null
}

const DEVICE_INTENTS: Intent[] = ['patch', 'install', 'upgrade', 'uninstall', 'reboot', 'shutdown', 'run', 'service_restart', 'gpupdate']

function routes(c: ParsedCommand): string[][] {
  const s = c.params.system
  const userSys = () => (s && ['entra', 'winserver', 'webex'].includes(s) ? s : c.params.user && /@/.test(c.params.user) && !/\.(local|lan|corp|internal)$/i.test(c.params.user) ? 'entra' : 'winserver')
  switch (c.intent) {
    case 'patch': return [s && ['automox', 'tacticalrmm', 'rmm'].includes(s) ? [s] : ['automox', 'tacticalrmm', 'rmm']]
    case 'patch_status': return [['omni'], ['automox']]
    case 'install': case 'upgrade': case 'uninstall': return [['chocolatey']]
    case 'reboot': return [s === 'automox' ? ['automox'] : ['tacticalrmm', 'automox']]
    case 'shutdown': case 'run': case 'service_restart': case 'gpupdate': return [['tacticalrmm']]
    case 'user_add': case 'user_disable': case 'user_enable': case 'user_delete': case 'user_reset': return [[userSys()]]
    case 'user_unlock': return [['winserver']]
    case 'user_signout': return [['entra']]
    case 'list_users': return [[s && ['entra', 'winserver', 'webex'].includes(s) ? s : 'entra']]
    case 'vm_start': case 'vm_stop': case 'vm_reboot': case 'vm_snapshot': case 'vm_list': return [['proxmox']]
    case 'backup_status': return s ? [[s]] : [['pbs'], ['synology'], ['backup']]
    case 'nas_status': return [['synology']]
    case 'monitor_status': return [['omni'], ['uptimekuma']]
    case 'ticket': return [['omni'], ...(s === 'zammad' || s === 'itflow' ? [[s]] : [['zammad'], ['itflow']])]
    case 'carrier_ticket': return [['fusion']]
    case 'remote': return [['rustdesk']]
    case 'find': return [['omni'], ['lansweeper']]
  }
}

const OPTIONAL_MULTI: Intent[] = ['backup_status', 'monitor_status', 'ticket', 'find', 'patch_status']

const title = (c: ParsedCommand): string => {
  const where = c.target.scope === 'all' ? 'all devices' : c.target.scope === 'client' ? `all devices at ${c.target.clientName}` : c.target.scope === 'devices' ? c.target.devices.join(', ') : ''
  const p = c.params
  const on = where ? ` on ${where}` : ''
  switch (c.intent) {
    case 'patch': return `Install approved ${p.product || 'operating system'} updates${on}`
    case 'patch_status': return 'Show patch status (soaking, approved, blocked)'
    case 'install': return `Install ${p.pkgName || p.pkg}${on}`
    case 'upgrade': return p.pkg === 'all' ? `Upgrade all software${on}` : `Upgrade ${p.pkg}${on}`
    case 'uninstall': return `Uninstall ${p.pkgName || p.pkg}${on}`
    case 'reboot': return `Restart ${where || '(choose devices)'}`
    case 'shutdown': return `Shut down ${where || '(choose devices)'}`
    case 'run': return `Run "${p.cmd}"${on}`
    case 'service_restart': return `${p.verb || 'Restart'} the ${p.service} service${on}`
    case 'gpupdate': return `Refresh Group Policy (gpupdate /force)${on}`
    case 'user_add': return `Create user ${p.displayName || ''} ${p.user ? `<${p.user}>` : ''}`.trim()
    case 'user_disable': return `Disable sign-in for ${p.user}`
    case 'user_enable': return `Re-enable sign-in for ${p.user}`
    case 'user_delete': return `Delete user ${p.user}`
    case 'user_reset': return `Reset password for ${p.user}`
    case 'user_unlock': return `Unlock ${p.user} in Active Directory`
    case 'user_signout': return `Sign ${p.user} out of every session`
    case 'list_users': return `List users${c.target.clientName ? ` at ${c.target.clientName}` : ''}`
    case 'vm_start': return `Start VM ${p.vm}`
    case 'vm_stop': return `Shut down VM ${p.vm}`
    case 'vm_reboot': return `Restart VM ${p.vm}`
    case 'vm_snapshot': return `Snapshot VM ${p.vm}`
    case 'vm_list': return 'List virtual machines'
    case 'backup_status': return 'Backup status report'
    case 'nas_status': return 'NAS health report'
    case 'monitor_status': return 'What is down right now'
    case 'ticket': return `Open ticket${c.target.clientName ? ` for ${c.target.clientName}` : ''}: ${p.subject}`
    case 'carrier_ticket': return `Email Fusion Connect a ticket${c.target.clientName ? ` for ${c.target.clientName}` : ''}: ${p.subject}`
    case 'remote': return `Open a remote session to ${p.device}`
    case 'find': return `Find "${p.query || c.target.clientName || ''}"`
  }
}

/** Build a plan from parsed text. `connected` = integrations this workspace has connected. */
export function planCommand(c: ParsedCommand | null, connected: Set<string>): Plan {
  if (!c) return { ok: false, title: "I didn't understand that yet", detail: [], risk: 'read', role: 'technician', steps: [], problems: ['Try one of the examples, e.g. “update windows 11 on all devices at Acme” or “disable user john@acme.com”.'] }
  const problems: string[] = []
  const detail: string[] = []
  const has = (id: string) => id === 'omni' || connected.has(id)
  const steps: PlanStep[] = []
  for (const options of routes(c)) {
    const pick = options.find(has)
    if (pick) steps.push({ integration: pick, name: INTEGRATION_NAMES[pick] || pick, connected: true, via: RUNS_VIA[pick] })
    else if (!OPTIONAL_MULTI.includes(c.intent) || steps.length === 0) steps.push({ integration: options[0], name: INTEGRATION_NAMES[options[0]] || options[0], connected: false, via: RUNS_VIA[options[0]] })
  }
  for (const s of steps) {
    if (!s.connected) problems.push(`${s.name} isn't connected yet — connect it in Integrations.`)
    if (s.via && !has(s.via)) problems.push(`${s.name} runs through ${INTEGRATION_NAMES[s.via]}, which isn't connected yet.`)
  }
  const p = c.params
  if (DEVICE_INTENTS.includes(c.intent) && c.target.scope === 'none') problems.push('Say which devices: “on all devices”, “at <client name>” or “on <computer name>”.')
  if (c.intent.startsWith('user_') && c.intent !== 'user_add' && !p.user) problems.push('Which user? Include their email or username.')
  if (c.intent === 'user_add' && !p.user) problems.push('Include the new user’s email or username, e.g. “add user Jane Doe jane@acme.com”.')
  if (c.intent === 'user_add' && !p.displayName) problems.push('Include the person’s name, e.g. “add user Jane Doe jane@acme.com”.')
  if (['install', 'uninstall'].includes(c.intent) && !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(p.pkg || '')) problems.push(`"${p.pkgName}" isn't a valid package name. Use the Chocolatey package id (search community.chocolatey.org).`)
  if (c.intent === 'patch') detail.push('Only updates that have been bug-free for your soak period (15 days by default) are installed. Anything still soaking or blocked by a known issue is skipped and listed.')
  if (c.intent === 'user_delete') detail.push('Microsoft 365 keeps deleted users for 30 days, then they are gone for good. Consider “disable user” first.')
  if (c.intent === 'user_add') detail.push('A strong temporary password is created; the user must change it at first sign-in. It is shown to you once.')
  if (c.intent === 'run') detail.push('The command runs as SYSTEM through Tactical RMM. Owners and admins only.')
  if (c.intent === 'remote') detail.push('Opens the RustDesk app on this computer (install it from rustdesk.com first).')
  const risk = RISK[c.intent]
  let confirmWord: string | undefined
  if (risk === 'destructive') confirmWord = 'DELETE'
  else if (c.target.scope === 'all' && ['reboot', 'shutdown', 'run', 'uninstall'].includes(c.intent)) confirmWord = 'ALL'
  return { ok: problems.length === 0, parsed: c, title: title(c), detail, risk, role: ADMIN_ONLY.includes(c.intent) ? 'admin' : 'technician', confirmWord, steps, problems }
}

export const COMMAND_EXAMPLES: { group: string; items: string[] }[] = [
  { group: 'Updates & software', items: ['update windows 11 on all devices', 'update windows 11 at Acme', 'patch status', 'install chrome on all devices at Acme', 'upgrade all software on FRONTDESK-01', 'uninstall zoom on RECEPTION-02'] },
  { group: 'Users', items: ['add user Jane Doe jane@acme.com', 'disable user john@acme.com', 'enable user john@acme.com', 'reset password john@acme.com', 'delete user john@acme.com', 'unlock user jdoe in active directory', 'add user Sam Lee slee@acme.local in active directory', 'add user Jane Doe jane@acme.com in webex'] },
  { group: 'Devices & servers', items: ['reboot FRONTDESK-01', 'restart service spooler on ACME-DC01', 'run "ipconfig /flushdns" on all devices at Acme', 'gpupdate on all devices at Acme', 'connect to FRONTDESK-01'] },
  { group: 'Virtualization, backup & monitoring', items: ['list vms', 'snapshot vm 101', 'restart vm 101', 'backup status', 'nas status', 'what is down'] },
  { group: 'Tickets', items: ['open ticket for Acme: printer offline', 'open fusion ticket for Acme: internet down', 'find FRONTDESK-01'] },
]
