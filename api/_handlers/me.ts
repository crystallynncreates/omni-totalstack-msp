// Who am I? Returns the signed-in user's workspace, role and branding.
// The platform owner (PLATFORM_OWNER_EMAILS) gets a complimentary Enterprise workspace automatically.
import { fail, isPlatformOwner, mustDb, ok, userFromReq, type Ctx, type Req, type Res } from '../_lib/util'
import { defaultSettings } from './signup'

const safe = (o: Record<string, unknown>) => { const { stripe_customer_id, stripe_subscription_id, ...rest } = o; void stripe_customer_id; void stripe_subscription_id; return rest }

export default async function me(req: Req, res: Res, _a: string, ctx: Ctx | null) {
  if (ctx) {
    const { data: all } = await mustDb().from('org_members').select('org_id, role, orgs(name, slug)').eq('user_id', ctx.userId)
    return ok(res, { userId: ctx.userId, email: ctx.email, role: ctx.role, clientId: ctx.clientId, platformOwner: ctx.platformOwner, org: safe(ctx.org as unknown as Record<string, unknown>), memberships: all || [] })
  }
  const user = await userFromReq(req)
  if (!user) return fail(res, 401, 'Please sign in.')
  if (isPlatformOwner(user.email)) {
    const sb = mustDb()
    const name = (user.user_metadata?.name as string) || 'Owner'
    const { data: org } = await sb.from('orgs').insert({ name: 'Omni TotalStack MSP', slug: 'omni-hq', plan: 'enterprise', status: 'active', comped: true, settings: defaultSettings('Omni TotalStack MSP', user.email!, name), owner_user_id: user.id }).select('*').single()
    if (org) {
      await sb.from('org_members').insert({ org_id: org.id, user_id: user.id, role: 'owner', name, email: user.email })
      return ok(res, { userId: user.id, email: user.email, role: 'owner', platformOwner: true, org: safe(org), memberships: [] })
    }
  }
  return fail(res, 404, 'No workspace found for this account.', { noWorkspace: true })
}
