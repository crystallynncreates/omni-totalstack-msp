// Single API router (keeps us within Vercel Hobby's function limit).
// vercel.json rewrites /api/<path> → /api?path=<path>; each handler lives in api/_handlers.
import type { Req, Res } from './_lib/util'
import { fail, requireUser } from './_lib/util'
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

type H = (req: Req, res: Res, action: string) => unknown
const routes: Record<string, H> = { claude, leads, book, voice, huntress, graph, unifi, rmm, quickbooks, stripe, email, cron, discovery, integrations, payroll }

export default async function handler(req: Req, res: Res) {
  const raw = String(req.query.path || '').replace(/^\/+/, '')
  const [root, ...rest] = raw.split('/')
  const h = routes[root]
  if (!h) return fail(res, 404, `Unknown API route: ${raw || '(none)'}`)
  // Public endpoints: landing page forms, client payments, OAuth callbacks, agent (own token), cron (own secret).
  const action = rest.join('/')
  const isPublic = ['leads', 'book', 'voice'].includes(root) || (root === 'stripe') || (root === 'quickbooks' && ['connect', 'callback'].includes(action)) || (root === 'discovery' && ['ingest', 'jobs'].includes(action)) || (root === 'cron' && req.method === 'GET')
  if (!isPublic && !(await requireUser(req))) return fail(res, 401, 'Sign in required')
  try {
    return await h(req, res, rest.join('/'))
  } catch (e) {
    console.error(`[api/${raw}]`, e)
    return fail(res, 500, (e as Error).message)
  }
}

export const config = { api: { bodyParser: false } }
