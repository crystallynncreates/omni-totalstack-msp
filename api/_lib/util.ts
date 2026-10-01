// Shared helpers for Omni serverless functions (Vercel Node runtime).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { orgIsLive, type OrgStatus, type PlanId } from '../../shared/plans.js'

export type Req = VercelRequest
export type Res = VercelResponse

export const env = (k: string) => process.env[k] || ''
export const has = (...keys: string[]) => keys.every((k) => !!process.env[k])

export const ok = (res: Res, data: unknown = { ok: true }) => res.status(200).json(data)
export const demo = (res: Res, what: string) => res.status(503).json({ demo: true, error: `${what} is not configured yet. Add its keys in Integrations.` })
export const fail = (res: Res, status: number, error: string, extra: Record<string, unknown> = {}) => res.status(status).json({ error, ...extra })

/** Raw request body (body parsing is disabled so Stripe webhooks can verify signatures). */
export async function raw(req: Req): Promise<string> {
  const r = req as unknown as { _raw?: string } & AsyncIterable<Buffer>
  if (r._raw !== undefined) return r._raw
  const chunks: Buffer[] = []
  for await (const c of r) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
  r._raw = Buffer.concat(chunks).toString('utf8')
  return r._raw
}
export async function body<T = Record<string, unknown>>(req: Req): Promise<T> {
  const t = await raw(req)
  if (!t) return {} as T
  try { return JSON.parse(t) as T } catch { return {} as T }
}

let _sb: SupabaseClient | null = null
/** Server-side Supabase client using the service-role key (bypasses RLS — never expose to the browser). */
export function db(): SupabaseClient | null {
  if (_sb) return _sb
  if (!has('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')) return null
  _sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  return _sb
}
export function mustDb(): SupabaseClient {
  const sb = db()
  if (!sb) throw Object.assign(new Error('Database not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'), { status: 503 })
  return sb
}

// ── Orgs & auth context ────────────────────────────────────────────────────
export interface Org {
  id: string; name: string; slug: string; plan: PlanId; status: OrgStatus; comped: boolean
  stripe_customer_id?: string | null; stripe_subscription_id?: string | null; current_period_end?: string | null
  grace_until?: string | null; custom_domain?: string | null; settings: Record<string, unknown>; integrations: Record<string, unknown>
  owner_user_id?: string | null; created_at?: string
  license?: 'subscription' | 'lifetime'; handoff_by?: string | null; handed_off_at?: string | null
}
export interface Ctx { userId: string; email: string; orgId: string; role: string; clientId?: string | null; org: Org; platformOwner: boolean }

export const platformOwners = () => env('PLATFORM_OWNER_EMAILS').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
export const isPlatformOwner = (email?: string | null) => !!email && platformOwners().includes(email.toLowerCase())

export async function userFromReq(req: Req) {
  const sb = db()
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!sb || !token) return null
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** Resolve the signed-in user + their workspace. Pass x-org-id to pick one when a user belongs to several. */
export async function context(req: Req): Promise<Ctx | null> {
  const user = await userFromReq(req)
  if (!user) return null
  const sb = mustDb()
  const wanted = String(req.headers['x-org-id'] || '')
  let q = sb.from('org_members').select('org_id, role, client_id, orgs(*)').eq('user_id', user.id)
  if (wanted) q = q.eq('org_id', wanted)
  const { data } = await q.order('created_at').limit(1).maybeSingle()
  if (!data) return null
  const org = (data as unknown as { orgs: Org }).orgs
  return { userId: user.id, email: user.email ?? '', orgId: data.org_id, role: data.role, clientId: data.client_id, org, platformOwner: isPlatformOwner(user.email) }
}
export const live = (org: Org) => orgIsLive(org)

export async function orgBySlug(slug: string): Promise<Org | null> {
  const { data } = await mustDb().from('orgs').select('*').eq('slug', slug.toLowerCase()).maybeSingle()
  return (data as Org) ?? null
}
export async function orgByHost(host: string): Promise<Org | null> {
  const h = host.toLowerCase().split(':')[0]
  const sb = mustDb()
  const { data } = await sb.from('orgs').select('*').eq('custom_domain', h).maybeSingle()
  if (data) return data as Org
  const base = env('PLATFORM_DOMAIN').toLowerCase() // e.g. omnitotalstack.com → acme.omnitotalstack.com
  if (base && h.endsWith('.' + base)) return orgBySlug(h.slice(0, -(base.length + 1)))
  return null
}

// ── Records (workspace data) ───────────────────────────────────────────────
export async function records<T = Record<string, unknown>>(orgId: string, collection: string): Promise<T[]> {
  const { data } = await mustDb().from('records').select('data').eq('org_id', orgId).eq('collection', collection)
  return (data || []).map((r) => r.data as T)
}
export async function putRecord(orgId: string, collection: string, item: { id: string } & Record<string, unknown>) {
  return mustDb().from('records').upsert({ org_id: orgId, collection, id: item.id, data: item })
}
export async function notify(orgId: string, level: 'info' | 'warn' | 'bad' | 'ok', text: string, href?: string) {
  const id = 'n' + crypto.randomBytes(6).toString('hex')
  return putRecord(orgId, 'notifications', { id, at: new Date().toISOString(), level, text, href, read: false })
}

// ── Integration secrets (per MSP) ─────────────────────────────────────────
function key() { return crypto.createHash('sha256').update(env('INTEGRATIONS_ENCRYPTION_KEY')).digest() }
export function encrypt(plain: string) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}
export function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split('.').map((b) => Buffer.from(b, 'base64'))
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}

/** Services Omni provides to every workspace from the platform's own keys (AI, outgoing email, the QuickBooks app — each MSP still authorizes its own QuickBooks company). */
const PLATFORM_PROVIDED = new Set(['claude', 'resend', 'quickbooks'])

/**
 * Read an MSP's integration setting. Each MSP's keys are stored encrypted per org.
 * Only platform-provided services (Claude, email) fall back to the platform's environment variables —
 * an MSP never gets another MSP's (or the platform owner's) RMM / Huntress / Microsoft / Stripe keys.
 */
export async function secret(orgId: string | null, integration: string, k: string, envName: string): Promise<string> {
  const sb = db()
  if (sb && orgId && env('INTEGRATIONS_ENCRYPTION_KEY')) {
    const { data } = await sb.from('integration_secrets').select('config').eq('org_id', orgId).eq('id', integration).maybeSingle()
    if (data?.config) { try { const v = JSON.parse(decrypt(data.config))[k]; if (v) return v } catch { /* fall through */ } }
  }
  if (PLATFORM_PROVIDED.has(integration) || !sb) return env(envName) // single-tenant/dev mode uses env vars
  return ''
}

/** Full decrypted settings for one of an MSP's integrations ({} when not connected). */
export async function integrationConfig(orgId: string, integration: string): Promise<Record<string, string>> {
  const sb = db()
  if (!sb || !env('INTEGRATIONS_ENCRYPTION_KEY')) return {}
  const { data } = await sb.from('integration_secrets').select('config').eq('org_id', orgId).eq('id', integration).maybeSingle()
  if (!data?.config) return {}
  try { return JSON.parse(decrypt(data.config)) } catch { return {} }
}
/** Which integrations an MSP has saved keys for. */
export async function connectedIntegrations(orgId: string): Promise<Set<string>> {
  const sb = db()
  if (!sb) return new Set()
  const { data } = await sb.from('integration_secrets').select('id').eq('org_id', orgId)
  const set = new Set((data || []).map((r) => r.id as string))
  if (set.has('m365')) set.add('entra') // Entra ID uses the Microsoft 365 app registration
  return set
}

// Email: Gmail/any SMTP (SMTP_USER + SMTP_PASS, e.g. a Gmail app password) or Resend (RESEND_API_KEY).
export const emailConfigured = () => !!(env('SMTP_USER') && env('SMTP_PASS')) || !!env('RESEND_API_KEY')
let mailer: import('nodemailer').Transporter | null = null
export async function sendEmail(to: string, subject: string, html: string, fromName?: string) {
  const name = (fromName || 'Omni TotalStack MSP').replace(/[<>"]/g, '')
  if (env('SMTP_USER') && env('SMTP_PASS')) {
    try {
      if (!mailer) {
        const nm = (await import('nodemailer')).default
        const port = Number(env('SMTP_PORT') || 465)
        mailer = nm.createTransport({ host: env('SMTP_HOST') || 'smtp.gmail.com', port, secure: port === 465, auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS').replace(/\s+/g, '') } })
      }
      const addr = env('EMAIL_FROM_ADDRESS') || env('SMTP_USER')
      await mailer.sendMail({ from: `"${name}" <${addr}>`, to, subject, html })
      return { ok: true, status: 200 }
    } catch (e) {
      console.error('sendEmail(smtp) failed', (e as Error).message)
      return { ok: false, status: 502, error: (e as Error).message }
    }
  }
  const k = env('RESEND_API_KEY')
  if (!k) return { ok: false, demo: true }
  const addr = env('EMAIL_FROM_ADDRESS') || 'updates@omnitotalstack.com'
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${name} <${addr}>`, to, subject, html }),
  })
  return { ok: r.ok, status: r.status }
}

export const origin = (req: Req) => env('PUBLIC_URL') || `https://${req.headers.host}`
export const httpError = (e: unknown) => ({ status: (e as { status?: number }).status || 500, message: (e as Error).message })
