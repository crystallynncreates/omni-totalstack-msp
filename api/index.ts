// Single API router (keeps Omni within Vercel Hobby's function limit).
// vercel.json rewrites /api/<route>/<action> → /api?path=<route>/<action>.
import type { Req, Res, Ctx } from './_lib/util.js'
import { context, fail, live, httpError } from './_lib/util.js'
import claude from './_handlers/claude.js'
import { leads, book } from './_handlers/leads.js'
import voice from './_handlers/voice.js'
import huntress from './_handlers/huntress.js'
import graph from './_handlers/graph.js'
import unifi from './_handlers/unifi.js'
import rmm from './_handlers/rmm.js'
import quickbooks from './_handlers/quickbooks.js'
import stripe from './_handlers/stripe.js'
import email from './_handlers/email.js'
import cron from './_handlers/cron.js'
import discovery from './_handlers/discovery.js'
import integrations from './_handlers/integrations.js'
import payroll from './_handlers/payroll.js'
import signup from './_handlers/signup.js'
import billing from './_handlers/billing.js'
import me from './_handlers/me.js'
import tenant from './_handlers/tenant.js'
import invites from './_handlers/invites.js'
import platform from './_handlers/platform.js'
import exportData from './_handlers/export.js'
import command from './_handlers/command.js'
import app from './_handlers/app.js'

export type Handler = (req: Req, res: Res, action: string, ctx: Ctx | null) => unknown

const routes: Record<string, Handler> = { claude, leads, book, voice, huntress, graph, unifi, rmm, quickbooks, stripe, email, cron, discovery, integrations, payroll, signup, billing, me, tenant, invites, platform, export: exportData, command, app }

// Endpoints reachable without signing in (each verifies its own secret, token, signature or slug).
function isPublic(root: string, action: string, method: string) {
  if (['signup', 'tenant', 'leads', 'book', 'voice', 'app'].includes(root)) return true
  if (root === 'billing' && action === 'webhook') return true
  if (root === 'invites' && ['lookup', 'accept'].includes(action)) return true
  if (root === 'stripe' && ['webhook', 'pay'].includes(action)) return true
  if (root === 'quickbooks' && action === 'callback') return true
  if (root === 'discovery' && ['ingest', 'jobs'].includes(action)) return true
  if (root === 'cron' && method === 'GET') return true
  return false
}
// Signed-in routes that still work when a workspace is locked for non-payment (so the owner can pay).
const WORKS_WHEN_LOCKED = new Set(['me', 'billing', 'platform', 'export']) // owners can always take their data with them

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
