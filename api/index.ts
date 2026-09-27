// Single API router (keeps Omni within Vercel Hobby's function limit).
// vercel.json rewrites /api/<route>/<action> → /api?path=<route>/<action>.
import type { Req, Res, Ctx } from './_lib/util'
import { context, fail, live, httpError } from './_lib/util'
import claude from './_handlers/claude'
import { leads, book } from './_handlers/leads'
import voice from './_handlers/voice'
import huntress from './_handlers/huntress'
import graph from './_handlers/graph'
import unifi from './_handlers/unifi'
import rmm from './_handlers/rmm'
import quickbooks from './_handlers/quickbooks'
import stripe from './_handlers/stripe'
import email from './_handlers/email'
import cron from './_handlers/cron'
import discovery from './_handlers/discovery'
import integrations from './_handlers/integrations'
import payroll from './_handlers/payroll'
import signup from './_handlers/signup'
import billing from './_handlers/billing'
import me from './_handlers/me'
import tenant from './_handlers/tenant'
import invites from './_handlers/invites'
import platform from './_handlers/platform'

export type Handler = (req: Req, res: Res, action: string, ctx: Ctx | null) => unknown

const routes: Record<string, Handler> = { claude, leads, book, voice, huntress, graph, unifi, rmm, quickbooks, stripe, email, cron, discovery, integrations, payroll, signup, billing, me, tenant, invites, platform }

// Endpoints reachable without signing in (each verifies its own secret, token, signature or slug).
function isPublic(root: string, action: string, method: string) {
  if (['signup', 'tenant', 'leads', 'book', 'voice'].includes(root)) return true
  if (root === 'billing' && action === 'webhook') return true
  if (root === 'invites' && ['lookup', 'accept'].includes(action)) return true
  if (root === 'stripe' && ['webhook', 'pay'].includes(action)) return true
  if (root === 'quickbooks' && action === 'callback') return true
  if (root === 'discovery' && ['ingest', 'jobs'].includes(action)) return true
  if (root === 'cron' && method === 'GET') return true
  return false
}
// Signed-in routes that still work when a workspace is locked for non-payment (so the owner can pay).
const WORKS_WHEN_LOCKED = new Set(['me', 'billing', 'platform'])

export default async function handler(req: Req, res: Res) {
  const raw = String(req.query.path || '').replace(/^\/+/, '')
  const [root, ...rest] = raw.split('/')
  const action = rest.join('/')
  const h = routes[root]
  if (!h) return fail(res, 404, `Unknown API route: ${raw || '(none)'}`)
  try {
    let ctx: Ctx | null = null
    if (!isPublic(root, action, req.method || 'GET')) {
      ctx = await context(req)
      if (!ctx && root !== 'me' && root !== 'platform') return fail(res, 401, 'Please sign in.')
      if (ctx && !live(ctx.org) && !WORKS_WHEN_LOCKED.has(root)) return fail(res, 402, 'This workspace is paused for non-payment. The owner can reactivate it under Billing.', { locked: true })
    }
    return await h(req, res, action, ctx)
  } catch (e) {
    const { status, message } = httpError(e)
    console.error(`[api/${raw}]`, e)
    return fail(res, status, message)
  }
}

export const config = { api: { bodyParser: false } }
