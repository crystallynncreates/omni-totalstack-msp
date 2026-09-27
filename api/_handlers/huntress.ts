// Huntress API (https://api.huntress.io/docs): organizations, agents, incident reports.
import { db, demo, fail, ok, secret, type Req, type Res } from '../_lib/util'

async function hget(path: string, key: string, sec: string) {
  const r = await fetch(`https://api.huntress.io/v1${path}`, { headers: { Authorization: 'Basic ' + Buffer.from(`${key}:${sec}`).toString('base64') } })
  if (!r.ok) throw new Error(`Huntress ${path}: HTTP ${r.status}`)
  return r.json()
}

export default async function huntress(req: Req, res: Res, action: string) {
  const key = await secret('huntress', 'apiKey', 'HUNTRESS_API_KEY')
  const sec = await secret('huntress', 'apiSecret', 'HUNTRESS_API_SECRET')
  if (!key || !sec) return demo(res, 'Huntress')
  if (action === 'organizations') return ok(res, await hget('/organizations?limit=500', key, sec))
  if (action === 'agents') return ok(res, await hget('/agents?limit=500', key, sec))
  if (action === 'incidents') return ok(res, await hget('/incident_reports?limit=100', key, sec))
  if (action === 'sync') {
    const [orgs, agents, incidents] = await Promise.all([hget('/organizations?limit=500', key, sec), hget('/agents?limit=500', key, sec), hget('/incident_reports?limit=100', key, sec)])
    const sb = db()
    if (sb) {
      await sb.from('huntress_snapshots').insert({ organizations: orgs, agents, incidents })
      // Mark devices that have a Huntress agent (matched by hostname)
      for (const a of (agents.agents || []) as { hostname: string }[]) await sb.from('devices').update({ huntress_agent: true }).ilike('hostname', a.hostname)
    }
    return ok(res, { organizations: orgs.organizations?.length ?? 0, agents: agents.agents?.length ?? 0, incidents: incidents.incident_reports?.length ?? 0 })
  }
  return fail(res, 404, 'Unknown Huntress action')
}
