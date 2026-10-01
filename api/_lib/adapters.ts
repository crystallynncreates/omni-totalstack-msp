// Command Console adapters: how each integration carries out a parsed command.
// Every call uses the MSP's own encrypted keys (integrationConfig). Nothing here bypasses the patch soak policy.
import crypto from 'node:crypto'
import { integrationConfig, putRecord, sendEmail } from './util.js'
import type { ParsedCommand } from '../../shared/commands.js'
import { patchStage } from '../../shared/patchPolicy.js'

type Obj = Record<string, unknown>
export interface OmniClient { id: string; name: string; primaryContact?: { name?: string; email?: string; phone?: string }; address?: string; m365TenantId?: string }
export interface OmniDevice { id: string; clientId: string; siteId?: string; hostname: string; type?: string; os?: string; ip?: string; status?: string; rustdeskId?: string }
export interface OmniPatch { id: string; kb: string; title: string; product: string; severity: string; releaseDate: string; lastIssueReported?: string; openIssues: number; deployedAt?: string; deployedCount: number; blocked?: boolean }
export interface RunCtx {
  orgId: string
  who: string
  cmd: ParsedCommand
  clients: OmniClient[]
  devices: OmniDevice[]
  patches: OmniPatch[]
  sites: { id: string; clientId: string; name: string; status?: string }[]
  tickets: { number?: number }[]
  soakDays: number
  brand: string
}
export interface StepResult { integration: string; ok: boolean; message: string; lines?: string[]; secret?: string; link?: string }

// ── helpers ───────────────────────────────────────────────────────────────
const httpsBase = (u?: string) => {
  const b = String(u || '').trim().replace(/\/+$/, '')
  if (!/^https:\/\//i.test(b)) throw new Error('The server address must start with https:// (set it in Integrations).')
  return b
}
async function http(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), init.timeoutMs ?? 25000)
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal })
    const text = await r.text()
    let data: unknown = text
    try { data = text ? JSON.parse(text) : {} } catch { /* plain text */ }
    if (!r.ok) {
      const msg = typeof data === 'object' && data ? JSON.stringify(data).slice(0, 300) : String(text).slice(0, 300)
      throw new Error(`${new URL(url).host} answered ${r.status}: ${msg}`)
    }
    return data
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`${new URL(url).host} did not answer in time. Is it reachable from the internet?`)
    throw e
  } finally { clearTimeout(t) }
}
const ps = (s: string) => `'${String(s).replace(/'/g, "''")}'`
const SAFE_ID = /^[A-Za-z0-9._@' -]{1,100}$/
function safe(v: string | undefined, what: string) {
  if (!v || !SAFE_ID.test(v)) throw new Error(`"${v || ''}" isn't a valid ${what}.`)
  return v
}
export function strongPassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!#%+=?@']
  const all = sets.join('')
  const chars = sets.map((s) => s[crypto.randomInt(s.length)])
  while (chars.length < 16) chars.push(all[crypto.randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]] }
  return chars.join('')
}
const lc = (s?: string) => String(s || '').toLowerCase()
const clientOf = (rc: RunCtx) => rc.clients.find((c) => c.id === rc.cmd.target.clientId)
const firstWord = (s: string) => lc(s).split(/[\s,&-]+/).find((w) => w.length > 2) || lc(s)

/** Omni device hostnames the command targets ("all" → null = every device). */
function targetHosts(rc: RunCtx): Set<string> | null {
  const t = rc.cmd.target
  if (t.scope === 'all') return null
  if (t.scope === 'devices') return new Set(t.devices.map(lc))
  if (t.scope === 'client') return new Set(rc.devices.filter((d) => d.clientId === t.clientId).map((d) => lc(d.hostname)))
  return new Set()
}

// ── Tactical RMM ──────────────────────────────────────────────────────────
interface TacAgent { agent_id: string; hostname: string; client_name?: string; site_name?: string; plat?: string; status?: string }
async function tactical(orgId: string) {
  const cfg = await integrationConfig(orgId, 'tacticalrmm')
  if (!cfg.apiKey) throw new Error('Tactical RMM is not connected — add its API URL and key in Integrations.')
  const base = httpsBase(cfg.baseUrl)
  const call = (path: string, init: RequestInit & { timeoutMs?: number } = {}) => http(`${base}${path}`, { ...init, headers: { 'X-API-KEY': cfg.apiKey, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  return { call }
}
async function tacticalAgents(rc: RunCtx, windowsOnly = false) {
  const { call } = await tactical(rc.orgId)
  const agents = (await call('/agents/')) as TacAgent[]
  const hosts = targetHosts(rc)
  const c = clientOf(rc)
  const list = agents.filter((a) => {
    if (windowsOnly && a.plat && a.plat !== 'windows') return false
    if (hosts === null) return true
    if (hosts.has(lc(a.hostname))) return true
    return !!c && rc.cmd.target.scope === 'client' && !!a.client_name && (lc(a.client_name) === lc(c.name) || lc(a.client_name).includes(firstWord(c.name)))
  })
  return { call, agents: list }
}
/** Run a shell command on the targeted agents. Up to 5 → wait for output; more → Tactical's bulk queue. */
async function tacticalCmd(rc: RunCtx, shell: 'powershell' | 'cmd', cmd: string, label: string, agentsOverride?: TacAgent[]): Promise<StepResult> {
  const { call, agents } = agentsOverride ? { ...(await tactical(rc.orgId)), agents: agentsOverride } : await tacticalAgents(rc, true)
  if (!agents.length) return { integration: 'tacticalrmm', ok: false, message: 'No matching Tactical RMM agents. Check the computer or client name (Tactical client names should match Omni client names).' }
  if (agents.length > 5) {
    await call('/agents/actions/bulk/', { method: 'POST', body: JSON.stringify({ mode: 'command', target: 'agents', agents: agents.map((a) => a.agent_id), client: null, site: null, cmd, shell, timeout: 300, custom_shell: null, run_as_user: false, monType: 'all', osType: 'windows', offlineAgents: false }) })
    return { integration: 'tacticalrmm', ok: true, message: `${label}: queued on ${agents.length} devices. Results appear in Tactical RMM → History.`, lines: agents.slice(0, 50).map((a) => a.hostname) }
  }
  const lines: string[] = []
  let okCount = 0
  await Promise.all(agents.map(async (a) => {
    try {
      const out = await call(`/agents/${a.agent_id}/cmd/`, { method: 'POST', body: JSON.stringify({ shell, cmd, timeout: 90, custom_shell: null, run_as_user: false }), timeoutMs: 95000 })
      okCount++
      lines.push(`${a.hostname}: ${String(typeof out === 'string' ? out : JSON.stringify(out)).trim().slice(0, 600) || 'done'}`)
    } catch (e) { lines.push(`${a.hostname}: FAILED — ${(e as Error).message}`) }
  }))
  return { integration: 'tacticalrmm', ok: okCount > 0, message: `${label}: ${okCount} of ${agents.length} device(s) succeeded.`, lines }
}

// ── Patching (15-day soak enforced here, on the server) ───────────────────
function eligiblePatches(rc: RunCtx) {
  const words = lc(rc.cmd.params.product).split(/\s+/).filter(Boolean)
  const matches = rc.patches.filter((p) => !words.length || words.every((w) => lc(`${p.product} ${p.title}`).includes(w)))
  const approved: OmniPatch[] = [], skipped: string[] = []
  for (const p of matches) {
    const st = patchStage(p, rc.soakDays)
    if (st.stage === 'approved') approved.push(p)
    else if (st.stage === 'soaking') skipped.push(`${p.kb} — still soaking, eligible ${st.eligibleOn.toDateString()} (${st.daysLeft} days left)`)
    else if (st.stage === 'blocked') skipped.push(`${p.kb} — blocked by ${p.openIssues || 'a'} known issue(s)`)
  }
  return { matches, approved, skipped }
}
async function markDeployed(rc: RunCtx, list: OmniPatch[], count: number) {
  const at = new Date().toISOString()
  for (const p of list) await putRecord(rc.orgId, 'patches', { ...p, deployedAt: at, deployedCount: (p.deployedCount || 0) + count } as unknown as { id: string })
}
async function patch(rc: RunCtx, integration: string): Promise<StepResult> {
  const { matches, approved, skipped } = eligiblePatches(rc)
  const lines = [...skipped.map((s) => `Skipped: ${s}`)]
  if (!matches.length) return { integration, ok: true, message: `No ${rc.cmd.params.product || ''} updates are being tracked in Omni yet. Sync patches from your RMM on the Patching page.`.replace('  ', ' '), lines }
  if (!approved.length) return { integration, ok: true, message: `Nothing is eligible yet — every matching update is still inside the ${rc.soakDays}-day soak period or blocked. Nothing was installed.`, lines }
  const kbs = approved.map((p) => p.kb)
  lines.unshift(`Approved for install: ${kbs.join(', ')}`)
  if (integration === 'automox') {
    const r = await automoxServers(rc)
    for (const s of r.servers) await r.call(`/servers/${s.id}/queues?o=${r.org}`, { method: 'POST', body: JSON.stringify({ command_type: 'InstallUpdate', args: kbs.join(' ') }) })
    if (r.servers.length) await markDeployed(rc, approved, r.servers.length)
    return { integration, ok: r.servers.length > 0, message: r.servers.length ? `Queued ${kbs.length} approved update(s) on ${r.servers.length} device(s) in Automox.` : 'No matching Automox devices.', lines }
  }
  if (integration === 'tacticalrmm') {
    const { call, agents } = await tacticalAgents(rc, true)
    if (!agents.length) return { integration, ok: false, message: 'No matching Tactical RMM agents.', lines }
    let done = 0
    for (const a of agents.slice(0, 40)) {
      try {
        const ups = (await call(`/winupdate/${a.agent_id}/`)) as { id: number; kb: string; installed?: boolean }[]
        for (const u of ups.filter((u) => !u.installed && kbs.some((k) => lc(u.kb).includes(lc(k).replace(/^kb/, ''))))) await call(`/winupdate/${u.id}/`, { method: 'PUT', body: JSON.stringify({ action: 'approve' }) })
        await call(`/winupdate/${a.agent_id}/install/`, { method: 'POST', body: '{}' })
        done++
      } catch (e) { lines.push(`${a.hostname}: ${(e as Error).message}`) }
    }
    if (agents.length > 40) lines.push(`${agents.length - 40} more device(s) will pick the approvals up at their next Tactical patch window.`)
    if (done) await markDeployed(rc, approved, done)
    return { integration, ok: done > 0, message: `Approved and started installing ${kbs.length} update(s) on ${done} device(s) via Tactical RMM.`, lines }
  }
  // NinjaOne / Atera: Omni records the approval; the RMM's own patch policy installs at its next window.
  return { integration, ok: true, message: `Approved in Omni: ${kbs.join(', ')}. Approve the same KBs in your RMM patch policy — it installs them at its next maintenance window.`, lines }
}

// ── Automox ───────────────────────────────────────────────────────────────
async function automoxServers(rc: RunCtx) {
  const cfg = await integrationConfig(rc.orgId, 'automox')
  if (!cfg.apiKey || !cfg.orgId) throw new Error('Automox is not connected — add the API key and organization ID in Integrations.')
  const call = (path: string, init: RequestInit = {}) => http(`https://console.automox.com/api${path}`, { ...init, headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' } })
  const all = (await call(`/servers?o=${encodeURIComponent(cfg.orgId)}&limit=500`)) as { id: number; name: string; display_name?: string; pending_patches?: number }[]
  const hosts = targetHosts(rc)
  const c = clientOf(rc)
  const servers = all.filter((s) => hosts === null || hosts.has(lc(s.name)) || (!!c && lc(s.display_name).includes(firstWord(c.name))))
  return { call, servers, org: encodeURIComponent(cfg.orgId), all }
}

// ── Microsoft Entra ID (Graph) ────────────────────────────────────────────
async function graph(rc: RunCtx) {
  const cfg = await integrationConfig(rc.orgId, 'm365')
  if (!cfg.clientId || !cfg.clientSecret) throw new Error('Connect Microsoft 365 (the app registration Entra ID uses) in Integrations.')
  const u = rc.cmd.params.user || ''
  const tenant = clientOf(rc)?.m365TenantId || (u.includes('@') ? u.split('@')[1] : '') || cfg.tenantId
  const tok = (await http(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }) })) as { access_token: string }
  const call = (path: string, init: RequestInit = {}) => http(`https://graph.microsoft.com/v1.0${path}`, { ...init, headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' } })
  return { call, tenant }
}
async function entra(rc: RunCtx): Promise<StepResult> {
  const { intent, params } = rc.cmd
  const { call, tenant } = await graph(rc)
  const upn = encodeURIComponent(params.user || '')
  const I = 'entra'
  if (intent === 'list_users') {
    const r = (await call('/users?$select=displayName,userPrincipalName,accountEnabled&$top=200')) as { value: { displayName: string; userPrincipalName: string; accountEnabled: boolean }[] }
    return { integration: I, ok: true, message: `${r.value.length} user(s) in ${tenant}.`, lines: r.value.map((u) => `${u.accountEnabled ? '✓' : '✗'} ${u.displayName} <${u.userPrincipalName}>`) }
  }
  if (intent === 'user_add') {
    const pw = strongPassword()
    const nick = (params.user.split('@')[0] || 'user').replace(/[^A-Za-z0-9._-]/g, '')
    await call('/users', { method: 'POST', body: JSON.stringify({ accountEnabled: true, displayName: params.displayName, mailNickname: nick, userPrincipalName: params.user, usageLocation: 'US', passwordProfile: { forceChangePasswordNextSignIn: true, password: pw } }) })
    return { integration: I, ok: true, message: `Created ${params.displayName} <${params.user}> in ${tenant}. Assign a license in Microsoft 365 admin if they need email.`, secret: pw }
  }
  if (intent === 'user_disable') {
    await call(`/users/${upn}`, { method: 'PATCH', body: JSON.stringify({ accountEnabled: false }) })
    await call(`/users/${upn}/revokeSignInSessions`, { method: 'POST', body: '{}' }).catch(() => null)
    return { integration: I, ok: true, message: `${params.user} can no longer sign in, and all their sessions were signed out.` }
  }
  if (intent === 'user_enable') { await call(`/users/${upn}`, { method: 'PATCH', body: JSON.stringify({ accountEnabled: true }) }); return { integration: I, ok: true, message: `${params.user} can sign in again.` } }
  if (intent === 'user_delete') { await call(`/users/${upn}`, { method: 'DELETE' }); return { integration: I, ok: true, message: `${params.user} was deleted. Microsoft keeps it in Deleted users for 30 days if you need to restore it.` } }
  if (intent === 'user_reset') {
    const pw = strongPassword()
    await call(`/users/${upn}`, { method: 'PATCH', body: JSON.stringify({ passwordProfile: { forceChangePasswordNextSignIn: true, password: pw } }) })
    return { integration: I, ok: true, message: `Password reset for ${params.user}. They must change it at next sign-in.`, secret: pw }
  }
  if (intent === 'user_signout') { await call(`/users/${upn}/revokeSignInSessions`, { method: 'POST', body: '{}' }); return { integration: I, ok: true, message: `${params.user} was signed out of every app and device.` } }
  return { integration: I, ok: false, message: 'Entra ID cannot do that.' }
}

// ── Windows Server / Active Directory (PowerShell on the DC through Tactical RMM) ──
async function activeDirectory(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'winserver')
  const { intent, params } = rc.cmd
  const dcs = String(cfg.domainControllers || '').split(/[,;\s]+/).filter(Boolean)
  if (!dcs.length) throw new Error('List your domain controllers in Integrations → Windows Server.')
  const c = clientOf(rc)
  const { call } = await tactical(rc.orgId)
  const agents = (await call('/agents/')) as TacAgent[]
  const wanted = rc.cmd.target.devices.find((d) => dcs.some((x) => lc(x) === lc(d))) || (c && dcs.find((x) => rc.devices.some((d) => d.clientId === c.id && lc(d.hostname) === lc(x)) || lc(x).includes(firstWord(c.name)))) || (dcs.length === 1 ? dcs[0] : '')
  if (!wanted) return { integration: 'winserver', ok: false, message: `Which client? Add “at <client>” — you manage ${dcs.length} domain controllers.` }
  const dc = agents.find((a) => lc(a.hostname) === lc(wanted))
  if (!dc) return { integration: 'winserver', ok: false, message: `${wanted} has no Tactical RMM agent. Install the agent on the domain controller first.` }
  const u = params.user || ''
  const sam = safe(u.includes('@') ? u.split('@')[0] : u, 'username')
  let script = 'Import-Module ActiveDirectory; '
  let pw = ''
  if (intent === 'user_add') {
    pw = strongPassword()
    const name = safe(params.displayName, 'name')
    const [first, ...rest] = name.split(' ')
    script += `$p = ConvertTo-SecureString ${ps(pw)} -AsPlainText -Force; New-ADUser -Name ${ps(name)} -DisplayName ${ps(name)} -GivenName ${ps(first)} -Surname ${ps(rest.join(' ') || first)} -SamAccountName ${ps(sam)} -UserPrincipalName ${ps(u.includes('@') ? safe(u, 'email') : sam)} -AccountPassword $p -Enabled $true -ChangePasswordAtLogon $true${cfg.defaultOU ? ` -Path ${ps(cfg.defaultOU)}` : ''}; 'Created ${sam}'`
  } else if (intent === 'user_disable') script += `Disable-ADAccount -Identity ${ps(sam)}; 'Disabled ${sam}'`
  else if (intent === 'user_enable') script += `Enable-ADAccount -Identity ${ps(sam)}; 'Enabled ${sam}'`
  else if (intent === 'user_delete') script += `Remove-ADUser -Identity ${ps(sam)} -Confirm:$false; 'Deleted ${sam}'`
  else if (intent === 'user_unlock') script += `Unlock-ADAccount -Identity ${ps(sam)}; 'Unlocked ${sam}'`
  else if (intent === 'user_reset') { pw = strongPassword(); script += `Set-ADAccountPassword -Identity ${ps(sam)} -Reset -NewPassword (ConvertTo-SecureString ${ps(pw)} -AsPlainText -Force); Set-ADUser -Identity ${ps(sam)} -ChangePasswordAtLogon $true; 'Password reset for ${sam}'` }
  else if (intent === 'list_users') script += `Get-ADUser -Filter * -Properties Enabled | Select-Object -First 300 SamAccountName,Name,Enabled | ForEach-Object { "$($_.Enabled) $($_.SamAccountName) $($_.Name)" }`
  else return { integration: 'winserver', ok: false, message: 'Active Directory cannot do that.' }
  const r = await tacticalCmd(rc, 'powershell', script, `Active Directory on ${dc.hostname}`, [dc])
  return { ...r, integration: 'winserver', secret: r.ok && pw ? pw : undefined }
}

// ── Webex ─────────────────────────────────────────────────────────────────
async function webex(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'webex')
  if (!cfg.token) throw new Error('Webex is not connected.')
  const call = (path: string, init: RequestInit = {}) => http(`https://webexapis.com/v1${path}`, { ...init, headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' } })
  const { intent, params } = rc.cmd
  const org = cfg.orgId ? `&orgId=${encodeURIComponent(cfg.orgId)}` : ''
  if (intent === 'list_users') { const r = (await call(`/people?max=200${org}`)) as { items: { displayName: string; emails: string[]; loginEnabled?: boolean }[] }; return { integration: 'webex', ok: true, message: `${r.items.length} Webex user(s).`, lines: r.items.map((p) => `${p.displayName} <${p.emails[0]}>`) } }
  if (intent === 'user_add') {
    const [firstName, ...rest] = (params.displayName || '').split(' ')
    await call('/people', { method: 'POST', body: JSON.stringify({ emails: [params.user], displayName: params.displayName, firstName, lastName: rest.join(' '), ...(cfg.orgId ? { orgId: cfg.orgId } : {}) }) })
    return { integration: 'webex', ok: true, message: `Added ${params.displayName} <${params.user}> to Webex. They get an activation email from Webex.` }
  }
  if (intent === 'user_delete') {
    const r = (await call(`/people?email=${encodeURIComponent(params.user)}${org}`)) as { items: { id: string }[] }
    if (!r.items.length) return { integration: 'webex', ok: false, message: `${params.user} isn't a Webex user.` }
    await call(`/people/${r.items[0].id}`, { method: 'DELETE' })
    return { integration: 'webex', ok: true, message: `Removed ${params.user} from Webex.` }
  }
  return { integration: 'webex', ok: false, message: 'Webex can add, list and delete users. To pause someone, remove their license in Control Hub.' }
}

// ── Proxmox VE ────────────────────────────────────────────────────────────
async function proxmox(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'proxmox')
  if (!cfg.secret) throw new Error('Proxmox VE is not connected.')
  const base = `${httpsBase(cfg.baseUrl)}/api2/json`
  const call = (path: string, init: RequestInit = {}) => http(`${base}${path}`, { ...init, headers: { Authorization: `PVEAPIToken=${cfg.tokenId}=${cfg.secret}`, ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) } })
  const list = ((await call('/cluster/resources?type=vm')) as { data: { vmid: number; name: string; node: string; type: string; status: string }[] }).data
  const { intent, params } = rc.cmd
  if (intent === 'vm_list') return { integration: 'proxmox', ok: true, message: `${list.length} VM(s)/container(s).`, lines: list.map((v) => `${v.vmid} ${v.name} — ${v.status} on ${v.node}`) }
  const vm = list.find((v) => String(v.vmid) === params.vm || lc(v.name) === lc(params.vm))
  if (!vm) return { integration: 'proxmox', ok: false, message: `No VM or container called "${params.vm}".` }
  const path = `/nodes/${vm.node}/${vm.type}/${vm.vmid}`
  if (intent === 'vm_snapshot') {
    const name = `omni-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`
    await call(`${path}/snapshot`, { method: 'POST', body: new URLSearchParams({ snapname: name, description: `Taken from Omni by ${rc.who}` }).toString() })
    return { integration: 'proxmox', ok: true, message: `Snapshot "${name}" started for ${vm.vmid} ${vm.name}.` }
  }
  const verb = intent === 'vm_start' ? 'start' : intent === 'vm_stop' ? 'shutdown' : 'reboot'
  await call(`${path}/status/${verb}`, { method: 'POST', body: '' })
  return { integration: 'proxmox', ok: true, message: `${verb[0].toUpperCase() + verb.slice(1)} sent to ${vm.vmid} ${vm.name}.` }
}

// ── Proxmox Backup Server ─────────────────────────────────────────────────
async function pbs(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'pbs')
  if (!cfg.secret) throw new Error('Proxmox Backup Server is not connected.')
  const base = `${httpsBase(cfg.baseUrl)}/api2/json`
  const call = (path: string) => http(`${base}${path}`, { headers: { Authorization: `PBSAPIToken=${cfg.tokenId}:${cfg.secret}` } })
  const usage = ((await call('/status/datastore-usage')) as { data: { store: string; total?: number; used?: number }[] }).data
  const since = Math.floor(Date.now() / 1000) - 86400
  const failed = ((await call(`/nodes/localhost/tasks?errors=1&limit=50&since=${since}`).catch(() => ({ data: [] }))) as { data: { worker_type: string; worker_id?: string; status?: string }[] }).data
  const gb = (n?: number) => (n ? (n / 1e9).toFixed(0) + ' GB' : '?')
  return { integration: 'pbs', ok: true, message: failed.length ? `${failed.length} failed task(s) in the last 24 hours.` : 'No failed backup tasks in the last 24 hours.', lines: [...usage.map((u) => `Datastore ${u.store}: ${gb(u.used)} of ${gb(u.total)} used`), ...failed.map((f) => `FAILED ${f.worker_type} ${f.worker_id || ''} — ${f.status || ''}`)] }
}

// ── Synology DSM ──────────────────────────────────────────────────────────
async function synology(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'synology')
  if (!cfg.password) throw new Error('Synology is not connected.')
  const base = httpsBase(cfg.baseUrl)
  const q = (o: Record<string, string>) => new URLSearchParams(o).toString()
  const auth = (await http(`${base}/webapi/auth.cgi?${q({ api: 'SYNO.API.Auth', version: '3', method: 'login', account: cfg.username, passwd: cfg.password, session: 'Omni', format: 'sid' })}`)) as { success: boolean; data?: { sid: string } }
  if (!auth.success || !auth.data) throw new Error('Synology rejected the username or password (2-step verification must be off for this account).')
  const sid = auth.data.sid
  const lines: string[] = []
  try {
    const st = (await http(`${base}/webapi/entry.cgi?${q({ api: 'SYNO.Storage.CGI.Storage', version: '1', method: 'load_info', _sid: sid })}`)) as { data?: { volumes?: { id: string; status: string; size?: { total: string; used: string } }[]; disks?: { name: string; status: string; smart_status?: string }[] } }
    for (const v of st.data?.volumes || []) lines.push(`Volume ${v.id}: ${v.status}${v.size ? ` — ${(Number(v.size.used) / 1e12).toFixed(2)} of ${(Number(v.size.total) / 1e12).toFixed(2)} TB` : ''}`)
    for (const d of st.data?.disks || []) if (d.status !== 'normal' || (d.smart_status && d.smart_status !== 'normal')) lines.push(`Disk ${d.name}: ${d.status} / SMART ${d.smart_status}`)
    const bk = (await http(`${base}/webapi/entry.cgi?${q({ api: 'SYNO.Backup.Task', version: '1', method: 'list', _sid: sid })}`).catch(() => null)) as { data?: { task_list?: { name: string; last_bkp_result?: string; state?: string }[] } } | null
    for (const t of bk?.data?.task_list || []) lines.push(`Hyper Backup "${t.name}": ${t.last_bkp_result || t.state || 'unknown'}`)
  } finally {
    await http(`${base}/webapi/auth.cgi?${q({ api: 'SYNO.API.Auth', version: '3', method: 'logout', session: 'Omni', _sid: sid })}`).catch(() => null)
  }
  const bad = lines.filter((l) => /crashed|degrade|fail|error|abnormal/i.test(l))
  return { integration: 'synology', ok: true, message: bad.length ? `${bad.length} problem(s) found on the NAS.` : 'NAS volumes and disks are healthy.', lines }
}

// ── Uptime Kuma ───────────────────────────────────────────────────────────
async function uptimeKuma(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'uptimekuma')
  const base = httpsBase(cfg.baseUrl)
  const slugs = String(cfg.statusPages || '').split(/[,\s]+/).filter(Boolean)
  if (!slugs.length) throw new Error('Add your Uptime Kuma status page slugs in Integrations.')
  const lines: string[] = []
  let down = 0
  for (const slug of slugs) {
    const page = (await http(`${base}/api/status-page/${encodeURIComponent(slug)}`)) as { publicGroupList?: { monitorList: { id: number; name: string }[] }[] }
    const hb = (await http(`${base}/api/status-page/heartbeat/${encodeURIComponent(slug)}`)) as { heartbeatList?: Record<string, { status: number; msg?: string }[]> }
    for (const m of (page.publicGroupList || []).flatMap((g) => g.monitorList)) {
      const last = hb.heartbeatList?.[String(m.id)]?.slice(-1)[0]
      if (last && last.status === 0) { down++; lines.push(`DOWN ${slug} / ${m.name}${last.msg ? ` — ${last.msg}` : ''}`) }
    }
  }
  return { integration: 'uptimekuma', ok: true, message: down ? `${down} monitor(s) down.` : `All monitors on ${slugs.length} status page(s) are up.`, lines }
}

// ── Tickets: Omni, Zammad, ITFlow, Fusion Connect ─────────────────────────
async function omniTicket(rc: RunCtx): Promise<StepResult> {
  const c = clientOf(rc)
  if (!c) return { integration: 'omni', ok: false, message: 'Which client is this for? Add “for <client name>”.' }
  const number = Math.max(1000, ...rc.tickets.map((t) => t.number || 0)) + 1
  const now = new Date()
  await putRecord(rc.orgId, 'tickets', { id: 't' + crypto.randomBytes(6).toString('hex'), number, clientId: c.id, title: rc.cmd.params.subject, description: `Opened from the Command Console by ${rc.who}.`, priority: 'P3', status: 'new', category: 'General', createdAt: now.toISOString(), slaDueAt: new Date(now.getTime() + 8 * 3600e3).toISOString(), billable: true, hours: 0 })
  return { integration: 'omni', ok: true, message: `Ticket #${number} opened for ${c.name}.` }
}
async function zammad(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'zammad')
  const base = httpsBase(cfg.baseUrl)
  const c = clientOf(rc)
  const customer = c?.primaryContact?.email || rc.who
  const r = (await http(`${base}/api/v1/tickets`, { method: 'POST', headers: { Authorization: `Token token=${cfg.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: rc.cmd.params.subject, group: cfg.group || 'Users', customer_id: `guess:${customer}`, article: { subject: rc.cmd.params.subject, body: `${rc.cmd.params.subject}\n\nClient: ${c?.name || '—'}\nOpened from Omni by ${rc.who}`, type: 'note', internal: false } }) })) as { number?: string }
  return { integration: 'zammad', ok: true, message: `Zammad ticket ${r.number ? '#' + r.number : ''} created.` }
}
async function itflow(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'itflow')
  const base = httpsBase(cfg.baseUrl)
  const c = clientOf(rc)
  const r = (await http(`${base}/api/v1/tickets/create.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ api_key: cfg.apiKey, ticket_subject: rc.cmd.params.subject, ticket_details: `Client: ${c?.name || '—'} — opened from Omni by ${rc.who}`, ticket_priority: 'Medium' }).toString() })) as { success?: string | boolean; message?: string }
  return { integration: 'itflow', ok: String(r.success) !== 'False' && r.success !== false, message: r.message || 'ITFlow ticket created.' }
}
async function fusion(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'fusion')
  if (!cfg.supportEmail) throw new Error('Add the Fusion Connect support email in Integrations.')
  const c = clientOf(rc)
  const html = `<p>Hello Fusion Connect support,</p><p>Please open a trouble ticket.</p><ul><li><b>Account:</b> ${cfg.accountNumber || '—'}</li><li><b>Customer / site:</b> ${c?.name || '—'}${c?.address ? `, ${c.address}` : ''}</li><li><b>Issue:</b> ${rc.cmd.params.subject}</li><li><b>On-site contact:</b> ${c?.primaryContact?.name || '—'} ${c?.primaryContact?.phone || ''}</li><li><b>Requested by:</b> ${rc.who} (${rc.brand})</li></ul><p>Please reply with the ticket number. Thank you.</p>`
  const sent = await sendEmail(cfg.supportEmail, `Trouble ticket — ${c?.name || rc.brand} — ${rc.cmd.params.subject}`, html, rc.brand)
  return { integration: 'fusion', ok: !!sent.ok, message: sent.ok ? `Emailed Fusion Connect support (${cfg.supportEmail}). Their reply with the ticket number comes to your inbox.` : 'Could not send the email — set up outgoing email first (Integrations → Email).' }
}

// ── Omni-native lookups ───────────────────────────────────────────────────
function omniStatus(rc: RunCtx): StepResult {
  const { intent } = rc.cmd
  if (intent === 'patch_status') {
    const rows = rc.patches.map((p) => ({ p, st: patchStage(p, rc.soakDays) }))
    const by = (s: string) => rows.filter((r) => r.st.stage === s)
    return { integration: 'omni', ok: true, message: `${by('approved').length} approved · ${by('soaking').length} soaking · ${by('blocked').length} blocked · ${by('deployed').length} deployed`, lines: [...by('approved').map((r) => `Ready: ${r.p.kb} ${r.p.title}`), ...by('soaking').map((r) => `Soaking: ${r.p.kb} — eligible ${r.st.eligibleOn.toDateString()}`), ...by('blocked').map((r) => `Blocked: ${r.p.kb} — ${r.p.openIssues} known issue(s)`)] }
  }
  if (intent === 'monitor_status') {
    const down = rc.sites.filter((s) => s.status && s.status !== 'online')
    const offline = rc.devices.filter((d) => d.status === 'offline')
    return { integration: 'omni', ok: true, message: down.length ? `${down.length} site(s) down or degraded.` : 'All sites are online.', lines: [...down.map((s) => `${s.status?.toUpperCase()} ${s.name} (${rc.clients.find((c) => c.id === s.clientId)?.name || ''})`), ...offline.slice(0, 30).map((d) => `Offline device: ${d.hostname}`)] }
  }
  if (intent === 'find') {
    const q = lc(rc.cmd.params.query || rc.cmd.target.devices[0] || rc.cmd.target.clientName)
    const hits = rc.devices.filter((d) => (rc.cmd.target.scope === 'client' && !rc.cmd.params.query ? d.clientId === rc.cmd.target.clientId : lc(`${d.hostname} ${d.ip}`).includes(q)))
    return { integration: 'omni', ok: true, message: `${hits.length} match(es) in Omni.`, lines: hits.slice(0, 50).map((d) => `${d.hostname} · ${d.ip || ''} · ${d.os || d.type || ''} · ${rc.clients.find((c) => c.id === d.clientId)?.name || ''} · ${d.status || ''}`) }
  }
  return { integration: 'omni', ok: false, message: 'Not supported.' }
}
async function lansweeper(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'lansweeper')
  const q = rc.cmd.params.query || rc.cmd.target.devices[0] || rc.cmd.target.clientName || ''
  const query = `query($siteId: ID!, $q: String!) { site(id: $siteId) { assetResources(assetPagination: { limit: 25, page: FIRST }, fields: ["assetBasicInfo.name", "assetBasicInfo.ipAddress", "assetBasicInfo.type", "assetBasicInfo.userName"], filters: { conjunction: OR, conditions: [{ operator: LIKE, path: "assetBasicInfo.name", value: $q }, { operator: LIKE, path: "assetBasicInfo.ipAddress", value: $q }] }) { items } } }`
  const r = (await http('https://api.lansweeper.com/api/v2/graphql', { method: 'POST', headers: { Authorization: `Token ${cfg.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { siteId: cfg.siteId, q } }) })) as { data?: { site?: { assetResources?: { items: { assetBasicInfo?: { name?: string; ipAddress?: string; type?: string; userName?: string } }[] } } }; errors?: { message: string }[] }
  if (r.errors?.length) throw new Error(r.errors[0].message)
  const items = r.data?.site?.assetResources?.items || []
  return { integration: 'lansweeper', ok: true, message: `${items.length} asset(s) in Lansweeper.`, lines: items.map((i) => `${i.assetBasicInfo?.name} · ${i.assetBasicInfo?.ipAddress || ''} · ${i.assetBasicInfo?.type || ''} · ${i.assetBasicInfo?.userName || ''}`) }
}
async function rustdesk(rc: RunCtx): Promise<StepResult> {
  const cfg = await integrationConfig(rc.orgId, 'rustdesk')
  const host = rc.cmd.params.device || rc.cmd.target.devices[0]
  const d = rc.devices.find((x) => lc(x.hostname) === lc(host))
  if (d?.rustdeskId) return { integration: 'rustdesk', ok: true, message: `Opening RustDesk to ${d.hostname} (ID ${d.rustdeskId}).`, link: `rustdesk://${encodeURIComponent(d.rustdeskId)}` }
  return { integration: 'rustdesk', ok: false, message: `${host || 'That device'} has no RustDesk ID saved in Omni. Open the device in Sites & Infrastructure and add its RustDesk ID (shown in the RustDesk app on that computer)${cfg.server ? `, server ${cfg.server}` : ''}.` }
}

// ── Router ────────────────────────────────────────────────────────────────
export async function runStep(integration: string, rc: RunCtx): Promise<StepResult> {
  const { intent, params } = rc.cmd
  try {
    switch (intent) {
      case 'patch': return await patch(rc, integration)
      case 'patch_status':
        if (integration === 'automox') { const r = await automoxServers(rc); const pending = r.all.filter((s) => (s.pending_patches || 0) > 0); return { integration, ok: true, message: `Automox: ${pending.length} of ${r.all.length} device(s) have pending patches.`, lines: pending.slice(0, 40).map((s) => `${s.name}: ${s.pending_patches} pending`) } }
        return omniStatus(rc)
      case 'install': case 'upgrade': case 'uninstall': {
        const cfg = await integrationConfig(rc.orgId, 'chocolatey')
        const pkg = params.pkg === 'all' && intent === 'upgrade' ? 'all' : safe(params.pkg, 'package name').replace(/[^a-z0-9._-]/gi, '')
        const src = cfg.source && /^https:\/\/[^\s"'&|<>^]+$/.test(cfg.source) ? ` --source "${cfg.source}"` : ''
        const verb = intent === 'install' ? 'install' : intent === 'upgrade' ? 'upgrade' : 'uninstall'
        const r = await tacticalCmd(rc, 'cmd', `choco ${verb} ${pkg} -y --no-progress${verb !== 'uninstall' ? src : ''}`, `choco ${verb} ${pkg}`)
        return { ...r, integration: 'chocolatey' }
      }
      case 'reboot':
        if (integration === 'automox') { const r = await automoxServers(rc); for (const s of r.servers) await r.call(`/servers/${s.id}/queues?o=${r.org}`, { method: 'POST', body: JSON.stringify({ command_type: 'Reboot' }) }); return { integration, ok: r.servers.length > 0, message: `Restart queued on ${r.servers.length} device(s) in Automox.` } }
        {
          const { call, agents } = await tacticalAgents(rc)
          const lines: string[] = []
          for (const a of agents.slice(0, 100)) { try { await call(`/agents/${a.agent_id}/reboot/`, { method: 'POST', body: '{}' }); lines.push(`${a.hostname}: restarting`) } catch (e) { lines.push(`${a.hostname}: ${(e as Error).message}`) } }
          return { integration, ok: agents.length > 0, message: agents.length ? `Restart sent to ${agents.length} device(s).` : 'No matching Tactical RMM agents.', lines }
        }
      case 'shutdown': return await tacticalCmd(rc, 'cmd', 'shutdown /s /t 60 /c "Shutdown requested by your IT provider"', 'Shut down')
      case 'run': return await tacticalCmd(rc, params.shell === 'cmd' ? 'cmd' : 'powershell', params.cmd, 'Command')
      case 'gpupdate': return await tacticalCmd(rc, 'cmd', 'gpupdate /force', 'gpupdate')
      case 'service_restart': return await tacticalCmd(rc, 'powershell', `${['Restart', 'Start', 'Stop'].includes(params.verb) ? params.verb : 'Restart'}-Service -Name ${ps(safe(params.service, 'service name'))} -Force -PassThru | Select-Object -ExpandProperty Status`, `${params.verb || 'Restart'} ${params.service}`)
      case 'user_add': case 'user_disable': case 'user_enable': case 'user_delete': case 'user_reset': case 'user_unlock': case 'user_signout': case 'list_users':
        if (integration === 'winserver') return await activeDirectory(rc)
        if (integration === 'webex') return await webex(rc)
        return await entra(rc)
      case 'vm_start': case 'vm_stop': case 'vm_reboot': case 'vm_snapshot': case 'vm_list': return await proxmox(rc)
      case 'backup_status':
        if (integration === 'synology') return await synology(rc)
        if (integration === 'backup') return { integration, ok: true, message: 'Datto/Veeam backup status is shown on each client’s Backups card.' }
        return await pbs(rc)
      case 'nas_status': return await synology(rc)
      case 'monitor_status': return integration === 'uptimekuma' ? await uptimeKuma(rc) : omniStatus(rc)
      case 'ticket': return integration === 'zammad' ? await zammad(rc) : integration === 'itflow' ? await itflow(rc) : await omniTicket(rc)
      case 'carrier_ticket': return await fusion(rc)
      case 'remote': return await rustdesk(rc)
      case 'find': return integration === 'lansweeper' ? await lansweeper(rc) : omniStatus(rc)
    }
  } catch (e) {
    return { integration, ok: false, message: (e as Error).message }
  }
  return { integration, ok: false, message: 'Unsupported command.' }
}
