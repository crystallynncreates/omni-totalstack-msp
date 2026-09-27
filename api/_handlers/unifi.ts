// UniFi Site Manager API (https://developer.ui.com/site-manager-api/): sites, hosts, devices → outage detection.
import { demo, notify, records, putRecord, fail, ok, secret, type Ctx, type Req, type Res } from '../_lib/util'

const u = async (key: string, path: string) => { const r = await fetch(`https://api.ui.com/v1${path}`, { headers: { 'X-API-KEY': key, Accept: 'application/json' } }); if (!r.ok) throw new Error(`UniFi ${path}: ${r.status}`); return r.json() }

export default async function unifi(req: Req, res: Res, action: string, ctx: Ctx | null) {
  const key = await secret(ctx?.orgId ?? null, 'unifi', 'apiKey', 'UNIFI_API_KEY')
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
    if (ctx) {
      type S = { id: string; name: string; unifiSiteId?: string; status: string; outages: { id: string; start: string; end?: string; cause: string }[] }
      for (const site of await records<S>(ctx.orgId, 'sites')) {
        const u = out.find((x: { unifiSiteId: string }) => x.unifiSiteId === site.unifiSiteId)
        if (!u) continue
        const outages = [...(site.outages || [])]
        if (u.status === 'down' && site.status !== 'down') { outages.unshift({ id: 'o' + Date.now(), start: new Date().toISOString(), cause: 'Gateway offline (UniFi)' }); await notify(ctx.orgId, 'bad', `${site.name} is DOWN`, '/app/infrastructure') }
        if (u.status !== 'down' && site.status === 'down') outages.forEach((o) => { if (!o.end) o.end = new Date().toISOString() })
        await putRecord(ctx.orgId, 'sites', { ...site, status: u.status, uptime30d: u.uptime30d ?? (site as unknown as { uptime30d: number }).uptime30d, lastCheck: new Date().toISOString(), outages })
      }
    }
    return ok(res, { sites: out })
  }
  if (action === 'devices') return ok(res, await u(key, '/devices'))
  return fail(res, 404, 'Unknown UniFi action')
}
