// Shared helpers for Omni serverless functions (Vercel Node runtime).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

export type Req = VercelRequest
export type Res = VercelResponse

export const env = (k: string) => process.env[k] || ''
export const has = (...keys: string[]) => keys.every((k) => !!process.env[k])

export const ok = (res: Res, data: unknown = { ok: true }) => res.status(200).json(data)
export const demo = (res: Res, what: string) => res.status(503).json({ demo: true, error: `${what} is not configured. Add its environment variables (see docs/INTEGRATIONS.md).` })
export const fail = (res: Res, status: number, error: string) => res.status(status).json({ error })

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
  _sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  return _sb
}

/** AES-256-GCM encryption for integration secrets stored in Supabase. */
export function encrypt(plain: string) {
  const key = crypto.createHash('sha256').update(env('INTEGRATIONS_ENCRYPTION_KEY')).digest()
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}
export function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split('.').map((b) => Buffer.from(b, 'base64'))
  const key = crypto.createHash('sha256').update(env('INTEGRATIONS_ENCRYPTION_KEY')).digest()
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}

/** Read an integration setting: environment variable first, then the encrypted Supabase store. */
export async function secret(integration: string, key: string, envName: string): Promise<string> {
  if (env(envName)) return env(envName)
  const sb = db()
  if (!sb || !env('INTEGRATIONS_ENCRYPTION_KEY')) return ''
  const { data } = await sb.from('integration_secrets').select('config').eq('id', integration).maybeSingle()
  if (!data?.config) return ''
  try { return JSON.parse(decrypt(data.config))[key] || '' } catch { return '' }
}

export async function sendEmail(to: string, subject: string, html: string) {
  const key = env('RESEND_API_KEY')
  if (!key) return { ok: false, demo: true }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('EMAIL_FROM') || 'Omni TotalStack MSP <updates@example.com>', to, subject, html }),
  })
  return { ok: r.ok, status: r.status }
}

/** Verify the caller is a signed-in Omni user (Supabase JWT in the Authorization header). */
export async function requireUser(req: Req): Promise<boolean> {
  if (env('ALLOW_UNAUTHENTICATED_API') === 'true') return true
  const sb = db()
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!sb || !token) return false
  const { data, error } = await sb.auth.getUser(token)
  return !error && !!data.user
}
