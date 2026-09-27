// Huntress API (https://api.huntress.io/docs): organizations, agents, incident reports.
import { demo, records, putRecord, fail, ok, secret, type Ctx, type Req, type Res } from '../_lib/util'

async function hget(path: string, key: string, sec: string) {
  const r = await fetch(`https://api.huntress.io/v1${path}`, { headers: { Authorization: 'Basic ' + Buffer.from(`${key}:${sec}`).toString('base64') } })
  if (!r.ok) throw new Error(`Huntress ${path}: HTTP ${r.status}`)
  return r.json()
}

export default async function huntress(req: Req, res: Res, action: string, ctx: Ctx | null) {
  const key = await secret(ctx?.orgId ?? null, 'huntress', 'apiKey', 'HUNTRESS_API_KEY')
  const sec = await secret(ctx?.orgId ?? null, 'huntress', 'apiSecret', 'HUNTRESS_API_SECRET')
  if (!key || !sec) return demo(res, 'Huntress')
  if (action === 'organizations') return ok(res, await hget('/organizations?limit=500', key, sec))
  if (action === 'agents') return ok(res, await hget('/agents?limit=500', key, sec))
  if (action === 'incidents') return ok(res, await hget('/incident_reports?limit=100', key, sec))
  if (action === 'sync') {
    const [orgs, agents, incidents] = await Promise.all([hget('/organizations?limit=500', key, sec), hget('/agents?limit=500', key, sec), hget('/incident_reports?limit=100', key, sec)])
    if (ctx) {
      // Mark this MSP's devices that have a Huntress agent (matched by hostname)
      const names = new Set(((agents.agents || []) as { hostname: string }[]).map((a) => a.hostname.toLowerCase()))
      for (const d of await records<{ id: string; hostname: string; huntressAgent?: boolean }>(ctx.orgId, 'devices'))
        if (names.has(d.hostname.toLowerCase()) && !d.huntressAgent) await putRecord(ctx.orgId, 'devices', { ...d, huntressAgent: true })
    }
    return ok(res, { organizations: orgs.organizations?.length ?? 0, agents: agents.agents?.length ?? 0, incidents: incidents.incident_reports?.length ?? 0 })
  }
  return fail(res, 404, 'Unknown Huntress action')
}
