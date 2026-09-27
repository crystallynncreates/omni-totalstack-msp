// UniFi Site Manager API (https://developer.ui.com/site-manager-api/): sites, hosts, devices → outage detection.
import { db, demo, fail, ok, secret, type Req, type Res } from '../_lib/util'

const u = async (key: string, path: string) => { const r = await fetch(`https://api.ui.com/v1${path}`, { headers: { 'X-API-KEY': key, Accept: 'application/json' } }); if (!r.ok) throw new Error(`UniFi ${path}: ${r.status}`); return r.json() }

export default async function unifi(req: Req, res: Res, action: string) {
  const key = await secret('unifi', 'apiKey', 'UNIFI_API_KEY')
  if (!key) return demo(res, 'UniFi')
  if (action === 'sites') {
    const [sites, hosts] = await Promise.all([u(key, '/sites'), u(key, '/hosts')])
    const hostById = new Map<string, { reportedState?: { state?: string }; isBlocked?: boolean }>((hosts.data || []).map((h: { id: string }) => [h.id, h]))
    const out = (sites.data || []).map((s: { siteId: string; hostId: string; meta?: { desc?: string; name?: string }; statistics?: { counts?: { offlineDevice?: number; totalDevice?: number }; percentages?: { wanUptime?: number }; ispInfo?: { name?: string } } }) => {
      const host = hostById.get(s.hostId)
      const offline = s.statistics?.counts?.offlineDevice ?? 0
      const hostState = host?.reportedState?.state
      const status = hostState && hostState !== 'connected' ? 'down' : offline > 0 ? 'degraded' : 'online'
      return { unifiSiteId: s.siteId, name: s.meta?.desc || s.meta?.name, status, uptime30d: s.statistics?.percentages?.wanUptime ?? null, isp: s.statistics?.ispInfo?.name }
    })
    const sb = db()
    if (sb) for (const s of out) await sb.from('sites').update({ status: s.status, uptime_30d: s.uptime30d, last_check: new Date().toISOString() }).eq('unifi_site_id', s.unifiSiteId)
    return ok(res, { sites: out })
  }
  if (action === 'devices') return ok(res, await u(key, '/devices'))
  return fail(res, 404, 'Unknown UniFi action')
}
