// RMM adapter. Implemented: NinjaOne (OAuth client credentials) and Atera (API key). Others: add a case below.
import { body, demo, fail, ok, secret, type Ctx, type Req, type Res } from '../_lib/util'

async function ninjaToken(base: string, id: string, sec: string) {
  const r = await fetch(`${base}/ws/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: sec, scope: 'monitoring management control' }) })
  const j = await r.json(); if (!r.ok) throw new Error(j.error_description || 'NinjaOne auth failed'); return j.access_token as string
}

export default async function rmm(req: Req, res: Res, action: string, ctx: Ctx | null) {
  const vendor = ((await secret(ctx?.orgId ?? null, 'rmm', 'vendor', 'RMM_VENDOR')) || 'ninjaone').toLowerCase()
  const base = (await secret(ctx?.orgId ?? null, 'rmm', 'baseUrl', 'RMM_BASE_URL')) || 'https://app.ninjarmm.com'
  const id = await secret(ctx?.orgId ?? null, 'rmm', 'clientId', 'RMM_CLIENT_ID')
  const sec = await secret(ctx?.orgId ?? null, 'rmm', 'clientSecret', 'RMM_CLIENT_SECRET')
  if (!sec) return demo(res, 'RMM')
  const b = req.method === 'POST' ? await body<{ deviceId?: string; kb?: string; script?: { name: string; body: string; lang: string } }>(req) : {}

  if (vendor === 'ninjaone') {
    const t = await ninjaToken(base, id, sec)
    const call = async (path: string, init: RequestInit = {}) => { const r = await fetch(`${base}/api${path}`, { ...init, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) } }); if (!r.ok) throw new Error(`NinjaOne ${path}: ${r.status}`); return r.status === 204 ? {} : r.json() }
    if (action === 'devices') return ok(res, await call('/v2/devices-detailed'))
    if (action === 'alerts') return ok(res, await call('/v2/alerts'))
    if (action === 'patches') return ok(res, await call('/v2/queries/os-patches?status=PENDING'))
    if (action === 'script') return ok(res, await call(`/v2/device/${b.deviceId}/script/run`, { method: 'POST', body: JSON.stringify({ type: 'ACTION', id: b.script?.name, runAs: 'system' }) }))
    if (action === 'deploy') return ok(res, { ok: true, note: `Approve ${b.kb} in your NinjaOne patch policy; Omni has recorded the 15-day soak approval.` })
  }
  if (vendor === 'atera') {
    const call = async (path: string) => { const r = await fetch(`https://app.atera.com/api/v3${path}`, { headers: { 'X-API-KEY': sec, Accept: 'application/json' } }); if (!r.ok) throw new Error(`Atera ${path}: ${r.status}`); return r.json() }
    if (action === 'devices') return ok(res, await call('/agents'))
    if (action === 'alerts') return ok(res, await call('/alerts'))
    if (action === 'deploy' || action === 'script') return ok(res, { ok: true, note: 'Atera: run via Patch Management profile / IT Automation profile.' })
  }
  return fail(res, 501, `RMM vendor "${vendor}" action "${action}" not implemented yet — add it in api/_handlers/rmm.ts`)
}
