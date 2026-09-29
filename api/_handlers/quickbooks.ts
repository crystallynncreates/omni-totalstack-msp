// QuickBooks Online (per MSP): OAuth connect/callback, P&L, A/R aging, bills.
import crypto from 'node:crypto'
import { db, demo, env, fail, ok, origin, secret, type Ctx, type Req, type Res } from '../_lib/util.js'

const AUTH = 'https://appcenter.intuit.com/connect/oauth2'
const TOKEN = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const API = () => (env('QBO_ENV') === 'sandbox' ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com')
const sign = (orgId: string) => orgId + '.' + crypto.createHmac('sha256', env('INTEGRATIONS_ENCRYPTION_KEY') || 'omni').update(orgId).digest('hex').slice(0, 32)
const verify = (state: string) => { const [orgId] = state.split('.'); return sign(orgId) === state ? orgId : null }

async function creds(orgId: string) {
  return { id: await secret(orgId, 'quickbooks', 'clientId', 'QBO_CLIENT_ID'), sec: await secret(orgId, 'quickbooks', 'clientSecret', 'QBO_CLIENT_SECRET') }
}
async function tokens(orgId: string) {
  const sb = db(); if (!sb) return null
  const { data } = await sb.from('oauth_tokens').select('*').eq('org_id', orgId).eq('provider', 'quickbooks').maybeSingle()
  if (!data) return null
  if (new Date(data.expires_at).getTime() > Date.now() + 60000) return data
  const { id, sec } = await creds(orgId)
  const r = await fetch(TOKEN, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }) })
  const j = await r.json(); if (!r.ok) throw new Error('QuickBooks token refresh failed — reconnect QuickBooks')
  const row = { org_id: orgId, provider: 'quickbooks', access_token: j.access_token, refresh_token: j.refresh_token, realm_id: data.realm_id, expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString() }
  await sb.from('oauth_tokens').upsert(row); return row
}

export default async function quickbooks(req: Req, res: Res, action: string, ctx: Ctx | null) {
  const redirect = `${origin(req)}/api/quickbooks/callback`
  if (action === 'callback') {
    const orgId = verify(String(req.query.state || ''))
    if (!orgId) return fail(res, 400, 'Invalid state')
    const { id, sec } = await creds(orgId)
    const r = await fetch(TOKEN, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: redirect }) })
    const j = await r.json(); if (!r.ok) return fail(res, 400, 'QuickBooks authorization failed')
    await db()?.from('oauth_tokens').upsert({ org_id: orgId, provider: 'quickbooks', access_token: j.access_token, refresh_token: j.refresh_token, realm_id: String(req.query.realmId), expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString() })
    res.writeHead(302, { Location: '/app/finance?qbo=connected' }); return res.end()
  }
  if (!ctx) return fail(res, 401, 'Please sign in.')
  const { id, sec } = await creds(ctx.orgId)
  if (!id || !sec) return demo(res, 'QuickBooks')
  if (action === 'connect') return ok(res, { url: `${AUTH}?${new URLSearchParams({ client_id: id, response_type: 'code', scope: 'com.intuit.quickbooks.accounting', redirect_uri: redirect, state: sign(ctx.orgId) })}` })
  const t = await tokens(ctx.orgId)
  if (!t) return fail(res, 400, 'QuickBooks is not authorized yet — click Connect QuickBooks.')
  const q = async (path: string) => { const r = await fetch(`${API()}/v3/company/${t.realm_id}${path}`, { headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/json' } }); if (!r.ok) throw new Error(`QuickBooks ${path}: ${r.status}`); return r.json() }
  if (action === 'pnl') return ok(res, await q('/reports/ProfitAndLoss?date_macro=This%20Month-to-date'))
  if (action === 'aging') return ok(res, await q('/reports/AgedReceivables'))
  if (action === 'bills') return ok(res, await q(`/query?query=${encodeURIComponent("select * from Bill where Balance > '0' maxresults 100")}`))
  if (action === 'sync') {
    const [pnl, aging, bills] = await Promise.all([q('/reports/ProfitAndLoss?date_macro=This%20Month-to-date'), q('/reports/AgedReceivables'), q(`/query?query=${encodeURIComponent("select * from Bill where Balance > '0' maxresults 100")}`)])
    return ok(res, { pnl, aging, bills })
  }
  return fail(res, 404, 'Unknown QuickBooks action')
}
