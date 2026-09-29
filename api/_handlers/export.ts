// Full workspace export (owner/admin): settings, non-secret integration state, team list and every record.
// Used for Enterprise handoff to a standalone copy (scripts/import-workspace.mjs) and for data portability.
// Integration SECRETS are never exported — the MSP re-enters its keys in the new copy.
import { fail, mustDb, ok, type Ctx, type Req, type Res } from '../_lib/util.js'

export default async function exportData(req: Req, res: Res, _a: string, ctx: Ctx | null) {
  if (!ctx || !['owner', 'admin'].includes(ctx.role)) return fail(res, 403, 'Only the owner or an admin can export the workspace.')
  const sb = mustDb()
  const [{ data: records }, { data: members }] = await Promise.all([
    sb.from('records').select('collection, id, data').eq('org_id', ctx.orgId),
    sb.from('org_members').select('role, client_id, name, email').eq('org_id', ctx.orgId),
  ])
  const o = ctx.org
  res.setHeader('Content-Disposition', `attachment; filename="omni-${o.slug}-export.json"`)
  return ok(res, {
    format: 'omni-workspace/1',
    exportedAt: new Date().toISOString(),
    org: { name: o.name, slug: o.slug, plan: o.plan, settings: o.settings, integrations: o.integrations },
    members: members || [],
    records: records || [],
  })
}
