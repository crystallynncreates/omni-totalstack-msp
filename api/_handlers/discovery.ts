// Network discovery: each MSP gets its own agent token. The Omni Agent posts results into that MSP's workspace.
import crypto from 'node:crypto'
import { body, fail, live, mustDb, notify, ok, putRecord, records, type Ctx, type Org, type Req, type Res } from '../_lib/util.js'

async function orgFromAgent(req: Req): Promise<Org | null> {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await mustDb().from('agent_tokens').select('orgs(*)').eq('token', token).maybeSingle()
  const org = (data as unknown as { orgs: Org } | null)?.orgs
  return org && live(org) ? org : null
}

export default async function discovery(req: Req, res: Res, action: string, ctx: Ctx | null) {
  const sb = mustDb()
  if (action === 'token') {
    if (!ctx || !['owner', 'admin'].includes(ctx.role)) return fail(res, 403, 'Owner or admin only')
    const { data: existing } = await sb.from('agent_tokens').select('token').eq('org_id', ctx.orgId).limit(1).maybeSingle()
    if (existing) return ok(res, { token: existing.token })
    const { data } = await sb.from('agent_tokens').insert({ org_id: ctx.orgId }).select('token').single()
    return ok(res, { token: data?.token })
  }
  if (action === 'run') {
    if (!ctx) return fail(res, 401, 'Please sign in.')
    const b = await body<{ siteId: string; range: string }>(req)
    const { data } = await sb.from('discovery_jobs').insert({ org_id: ctx.orgId, site_id: b.siteId, range: b.range, status: 'queued' }).select('id').single()
    return ok(res, { jobId: data?.id })
  }
  const org = await orgFromAgent(req)
  if (!org) return fail(res, 401, 'Bad agent token')
  if (action === 'jobs') {
    const { data } = await sb.from('discovery_jobs').select('*').eq('org_id', org.id).eq('site_id', String(req.query.site)).eq('status', 'queued')
    return ok(res, { jobs: data || [] })
  }
  if (action === 'ingest') {
    const b = await body<{ site: string; range: string; startedAt: string; hosts: { ip: string; mac: string; hostname: string; vendor: string; guessedType: string; openPorts: number[]; risk?: string }[] }>(req)
    const site = (await records<{ id: string; clientId: string; name: string }>(org.id, 'sites')).find((s) => s.id === b.site)
    if (!site) return fail(res, 404, 'Unknown site ID — copy it from Network Discovery in Omni.')
    const known = new Set((await records<{ siteId: string; ip: string }>(org.id, 'devices')).filter((d) => d.siteId === site.id).map((d) => d.ip))
    const hosts = b.hosts.map((h) => ({ ...h, isNew: !known.has(h.ip) }))
    await putRecord(org.id, 'scans', { id: 'sc' + crypto.randomBytes(5).toString('hex'), siteId: site.id, clientId: site.clientId, range: b.range, startedAt: b.startedAt, source: 'agent', hosts })
    await sb.from('discovery_jobs').update({ status: 'done' }).eq('org_id', org.id).eq('site_id', site.id).eq('status', 'queued')
    const n = hosts.filter((h) => h.isNew).length
    await notify(org.id, n ? 'warn' : 'ok', `Discovery at ${site.name}: ${hosts.length} hosts, ${n} new`, '/app/discovery')
    return ok(res, { hosts: hosts.length, new: n })
  }
  return fail(res, 404, 'Unknown discovery action')
}
