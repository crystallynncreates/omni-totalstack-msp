// Save integration credentials (encrypted) and test connectivity.
import { body, db, demo, encrypt, env, fail, ok, secret, type Req, type Res } from '../_lib/util'

const TESTS: Record<string, () => Promise<boolean>> = {
  claude: async () => !!(await secret('claude', 'apiKey', 'ANTHROPIC_API_KEY')),
  huntress: async () => { const k = await secret('huntress', 'apiKey', 'HUNTRESS_API_KEY'), s = await secret('huntress', 'apiSecret', 'HUNTRESS_API_SECRET'); if (!k || !s) return false; const r = await fetch('https://api.huntress.io/v1/account', { headers: { Authorization: 'Basic ' + Buffer.from(`${k}:${s}`).toString('base64') } }); return r.ok },
  unifi: async () => { const k = await secret('unifi', 'apiKey', 'UNIFI_API_KEY'); if (!k) return false; const r = await fetch('https://api.ui.com/v1/hosts', { headers: { 'X-API-KEY': k } }); return r.ok },
  stripe: async () => { const k = await secret('stripe', 'secretKey', 'STRIPE_SECRET_KEY'); if (!k) return false; const r = await fetch('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${k}` } }); return r.ok },
  resend: async () => !!env('RESEND_API_KEY'),
}

export default async function integrations(req: Req, res: Res, action: string) {
  if (action === 'save') {
    const sb = db()
    if (!sb || !env('INTEGRATIONS_ENCRYPTION_KEY')) return demo(res, 'Secure secret storage (Supabase + INTEGRATIONS_ENCRYPTION_KEY)')
    const b = await body<{ id: string; config: Record<string, string> }>(req)
    const { data: existing } = await sb.from('integration_secrets').select('config').eq('id', b.id).maybeSingle()
    void existing
    await sb.from('integration_secrets').upsert({ id: b.id, config: encrypt(JSON.stringify(b.config)), updated_at: new Date().toISOString() })
    return ok(res, { ok: true })
  }
  if (action === 'test') {
    const id = String(req.query.id)
    const t = TESTS[id]
    return ok(res, { ok: t ? await t().catch(() => false) : true })
  }
  return fail(res, 404, 'Unknown integrations action')
}
