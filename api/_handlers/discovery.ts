// Network discovery: queue scans for the Omni Agent and ingest its results.
import { body, db, demo, env, fail, ok, type Req, type Res } from '../_lib/util'

export default async function discovery(req: Req, res: Res, action: string) {
  const sb = db()
  if (!sb) return demo(res, 'Supabase (stores discovery jobs & results)')
  if (action === 'run') {
    const b = await body<{ siteId: string; range: string }>(req)
    const { data } = await sb.from('discovery_jobs').insert({ site_id: b.siteId, range: b.range, status: 'queued' }).select('id').single()
    return ok(res, { jobId: data?.id })
  }
  if (action === 'jobs') {
    // Polled by the agent: GET /api/discovery/jobs?site=SITE_ID
    if (req.headers.authorization !== `Bearer ${env('AGENT_TOKEN')}`) return fail(res, 401, 'Bad agent token')
    const { data } = await sb.from('discovery_jobs').select('*').eq('site_id', String(req.query.site)).eq('status', 'queued')
    return ok(res, { jobs: data || [] })
  }
  if (action === 'ingest') {
    if (req.headers.authorization !== `Bearer ${env('AGENT_TOKEN')}`) return fail(res, 401, 'Bad agent token')
    const b = await body<{ site: string; range: string; startedAt: string; hosts: { ip: string; mac: string; hostname: string; vendor: string; guessedType: string; openPorts: number[]; risk?: string }[] }>(req)
    const { data: site } = await sb.from('sites').select('id,client_id').eq('id', b.site).maybeSingle()
    if (!site) return fail(res, 404, 'Unknown site')
    const { data: known } = await sb.from('devices').select('ip').eq('site_id', site.id)
    const knownIps = new Set((known || []).map((d) => d.ip))
    const hosts = b.hosts.map((h) => ({ ...h, isNew: !knownIps.has(h.ip) }))
    await sb.from('scans').insert({ site_id: site.id, client_id: site.client_id, range: b.range, started_at: b.startedAt, source: 'agent', hosts })
    await sb.from('discovery_jobs').update({ status: 'done' }).eq('site_id', site.id).eq('status', 'queued')
    const n = hosts.filter((h) => h.isNew).length
    if (n) await sb.from('notifications').insert({ level: 'warn', text: `Discovery found ${n} new device(s)`, href: '/app/discovery' })
    return ok(res, { hosts: hosts.length, new: n })
  }
  return fail(res, 404, 'Unknown discovery action')
}
