// Each MSP saves its own integration keys — encrypted at rest, readable only by the server, never shared across MSPs.
import { body, demo, encrypt, env, fail, mustDb, ok, secret, type Ctx, type Req, type Res } from '../_lib/util.js'

type T = (org: string) => Promise<boolean>
const TESTS: Record<string, T> = {
  huntress: async (o) => { const k = await secret(o, 'huntress', 'apiKey', ''), s = await secret(o, 'huntress', 'apiSecret', ''); if (!k || !s) return false; return (await fetch('https://api.huntress.io/v1/account', { headers: { Authorization: 'Basic ' + Buffer.from(`${k}:${s}`).toString('base64') } })).ok },
  unifi: async (o) => { const k = await secret(o, 'unifi', 'apiKey', ''); if (!k) return false; return (await fetch('https://api.ui.com/v1/hosts', { headers: { 'X-API-KEY': k } })).ok },
  stripe: async (o) => { const k = await secret(o, 'stripe', 'secretKey', ''); if (!k) return false; return (await fetch('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${k}` } })).ok },
  claude: async (o) => !!(await secret(o, 'claude', 'apiKey', 'ANTHROPIC_API_KEY')),
}

export default async function integrations(req: Req, res: Res, action: string, ctx: Ctx | null) {
  if (!ctx) return fail(res, 401, 'Please sign in.')
  if (action === 'save') {
    if (!['owner', 'admin'].includes(ctx.role)) return fail(res, 403, 'Only owners and admins can connect integrations.')
    if (!env('INTEGRATIONS_ENCRYPTION_KEY')) return demo(res, 'Secure key storage')
    const b = await body<{ id: string; config: Record<string, string> }>(req)
    const sb = mustDb()
    // Merge with existing so blank secret fields don't wipe saved values
    let merged = b.config
    const prev = await sb.from('integration_secrets').select('config').eq('org_id', ctx.orgId).eq('id', b.id).maybeSingle()
    if (prev.data?.config) {
      const { decrypt } = await import('../_lib/util.js')
      try { merged = { ...JSON.parse(decrypt(prev.data.config)), ...Object.fromEntries(Object.entries(b.config).filter(([, v]) => v)) } } catch { /* keep new */ }
    }
    await sb.from('integration_secrets').upsert({ org_id: ctx.orgId, id: b.id, config: encrypt(JSON.stringify(merged)), updated_at: new Date().toISOString() })
    return ok(res)
  }
  if (action === 'test') {
    const t = TESTS[String(req.query.id)]
    return ok(res, { ok: t ? await t(ctx.orgId).catch(() => false) : true })
  }
  return fail(res, 404, 'Unknown integrations action')
}
