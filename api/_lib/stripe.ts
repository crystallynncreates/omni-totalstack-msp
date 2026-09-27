// Minimal Stripe REST helpers (no SDK) — used for the platform's own subscriptions and each MSP's client payments.
import crypto from 'node:crypto'

export async function stripeCall<T = Record<string, unknown>>(key: string, path: string, params?: Record<string, string>, method = params ? 'POST' : 'GET'): Promise<T> {
  const url = `https://api.stripe.com/v1${path}${method === 'GET' && params ? '?' + new URLSearchParams(params) : ''}`
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: method === 'GET' ? undefined : new URLSearchParams(params || {}).toString() })
  const j = await r.json()
  if (!r.ok) throw Object.assign(new Error(j.error?.message || `Stripe ${path} failed`), { status: 400 })
  return j as T
}

/** Verify a Stripe-Signature header (v1, HMAC-SHA256, 5-minute tolerance). */
export function verifyStripe(payload: string, header: string, secret: string) {
  if (!secret || !header) return false
  const parts: Record<string, string[]> = {}
  header.split(',').forEach((p) => { const [k, v] = p.split('='); (parts[k] ||= []).push(v) })
  const t = parts.t?.[0]
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
  return (parts.v1 || []).some((v) => v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected)))
}
