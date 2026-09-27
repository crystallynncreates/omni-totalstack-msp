// QuickBooks Online: OAuth connect/callback, P&L, A/R aging, bills; invoice push.
import { db, demo, env, fail, ok, secret, type Req, type Res } from '../_lib/util'

const AUTH = 'https://appcenter.intuit.com/connect/oauth2'
const TOKEN = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const API = () => (env('QBO_ENV') === 'sandbox' ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com')

async function tokens() {
  const sb = db(); if (!sb) return null
  const { data } = await sb.from('oauth_tokens').select('*').eq('id', 'quickbooks').maybeSingle()
  if (!data) return null
  if (new Date(data.expires_at).getTime() > Date.now() + 60000) return data
  const id = await secret('quickbooks', 'clientId', 'QBO_CLIENT_ID'), sec = await secret('quickbooks', 'clientSecret', 'QBO_CLIENT_SECRET')
  const r = await fetch(TOKEN, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }) })
  const j = await r.json(); if (!r.ok) throw new Error('QuickBooks token refresh failed')
  const row = { id: 'quickbooks', access_token: j.access_token, refresh_token: j.refresh_token, realm_id: data.realm_id, expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString() }
  await sb.from('oauth_tokens').upsert(row); return row
}

export default async function quickbooks(req: Req, res: Res, action: string) {
  const id = await secret('quickbooks', 'clientId', 'QBO_CLIENT_ID')
  const sec = await secret('quickbooks', 'clientSecret', 'QBO_CLIENT_SECRET')
  if (!id || !sec) return demo(res, 'QuickBooks')
  const redirect = env('QBO_REDIRECT_URI')
  if (action === 'connect') {
    const url = `${AUTH}?${new URLSearchParams({ client_id: id, response_type: 'code', scope: 'com.intuit.quickbooks.accounting', redirect_uri: redirect, state: 'omni' })}`
    res.writeHead(302, { Location: url }); return res.end()
  }
  if (action === 'callback') {
    const r = await fetch(TOKEN, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: redirect }) })
    const j = await r.json(); if (!r.ok) return fail(res, 400, 'QuickBooks authorization failed')
    await db()?.from('oauth_tokens').upsert({ id: 'quickbooks', access_token: j.access_token, refresh_token: j.refresh_token, realm_id: String(req.query.realmId), expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString() })
    res.writeHead(302, { Location: '/app/finance?qbo=connected' }); return res.end()
  }
  const t = await tokens()
  if (!t) return fail(res, 400, 'QuickBooks not authorized yet — open /api/quickbooks/connect')
  const q = async (path: string) => { const r = await fetch(`${API()}/v3/company/${t.realm_id}${path}`, { headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/json' } }); if (!r.ok) throw new Error(`QBO ${path}: ${r.status}`); return r.json() }
  if (action === 'pnl') return ok(res, await q('/reports/ProfitAndLoss?date_macro=This%20Month-to-date'))
  if (action === 'aging') return ok(res, await q('/reports/AgedReceivables'))
  if (action === 'bills') return ok(res, await q(`/query?query=${encodeURIComponent("select * from Bill where Balance > '0' maxresults 100")}`))
  if (action === 'sync') {
    const [pnl, aging, bills] = await Promise.all([q('/reports/ProfitAndLoss?date_macro=This%20Month-to-date'), q('/reports/AgedReceivables'), q(`/query?query=${encodeURIComponent("select * from Bill where Balance > '0' maxresults 100")}`)])
    await db()?.from('finance_snapshots').insert({ source: 'quickbooks', pnl, aging, bills })
    return ok(res, { ok: true })
  }
  return fail(res, 404, 'Unknown QuickBooks action')
}
