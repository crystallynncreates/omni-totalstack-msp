// Platform owner console (PLATFORM_OWNER_EMAILS only): every MSP workspace, revenue, and manual controls.
import { body, fail, isPlatformOwner, mustDb, ok, userFromReq, type Req, type Res } from '../_lib/util'
import { PLANS, type PlanId } from '../../shared/plans'

export default async function platform(req: Req, res: Res, action: string) {
  const user = await userFromReq(req)
  if (!user || !isPlatformOwner(user.email)) return fail(res, 403, 'Platform owner only.')
  const sb = mustDb()
  if (action === 'orgs') {
    const { data: orgs } = await sb.from('orgs').select('id, name, slug, plan, status, comped, grace_until, current_period_end, custom_domain, created_at').order('created_at', { ascending: false })
    const { data: members } = await sb.from('org_members').select('org_id, role, email')
    const { data: counts } = await sb.from('records').select('org_id, collection').in('collection', ['clients', 'devices'])
    const rows = (orgs || []).map((o) => ({
      ...o,
      owner: (members || []).find((m) => m.org_id === o.id && m.role === 'owner')?.email,
      staff: (members || []).filter((m) => m.org_id === o.id && m.role !== 'client').length,
      clientUsers: (members || []).filter((m) => m.org_id === o.id && m.role === 'client').length,
      clients: (counts || []).filter((c) => c.org_id === o.id && c.collection === 'clients').length,
      devices: (counts || []).filter((c) => c.org_id === o.id && c.collection === 'devices').length,
      mrr: o.comped || !['active', 'past_due'].includes(o.status) ? 0 : PLANS[o.plan as PlanId].price ?? 0,
    }))
    return ok(res, { orgs: rows, mrr: rows.reduce((a, r) => a + r.mrr, 0) })
  }
  if (action === 'update') {
    const b = await body<{ orgId: string; plan?: PlanId; status?: string; comped?: boolean; extendGraceDays?: number }>(req)
    const patch: Record<string, unknown> = {}
    if (b.plan && PLANS[b.plan]) patch.plan = b.plan
    if (b.status) patch.status = b.status
    if (typeof b.comped === 'boolean') patch.comped = b.comped
    if (b.extendGraceDays) { patch.status = 'past_due'; patch.grace_until = new Date(Date.now() + b.extendGraceDays * 864e5).toISOString() }
    if (patch.status === 'active') patch.grace_until = null
    const { error } = await sb.from('orgs').update(patch).eq('id', b.orgId)
    if (error) return fail(res, 400, error.message)
    return ok(res)
  }
  return fail(res, 404, 'Unknown platform action')
}
