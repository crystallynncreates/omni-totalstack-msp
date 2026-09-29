// Team & client-portal invitations. Owners/admins invite technicians, finance staff and client users;
// the invitee sets a password and lands in the right workspace with the right role.
import { body, context, fail, mustDb, ok, origin, sendEmail, type Ctx, type Req, type Res } from '../_lib/util.js'

export default async function invites(req: Req, res: Res, action: string, ctx: Ctx | null) {
  const sb = mustDb()

  if (action === 'lookup') {
    const { data } = await sb.from('invites').select('email, role, accepted_at, expires_at, orgs(name, slug, settings)').eq('token', String(req.query.token || '')).maybeSingle()
    if (!data || data.accepted_at || new Date(data.expires_at) < new Date()) return fail(res, 404, 'This invitation is invalid or has expired. Ask for a new one.')
    const o = (data as unknown as { orgs: { name: string; slug: string; settings: { logoDataUrl?: string; accent?: string } } }).orgs
    return ok(res, { email: data.email, role: data.role, org: { name: o.name, slug: o.slug, logo: o.settings?.logoDataUrl, accent: o.settings?.accent } })
  }

  if (action === 'accept') {
    const b = await body<{ token: string; name: string; password: string }>(req)
    const { data: inv } = await sb.from('invites').select('*').eq('token', b.token).maybeSingle()
    if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) return fail(res, 404, 'This invitation is invalid or has expired.')
    let userId: string | undefined
    const existing = await context(req) // already signed in with this email?
    if (existing && existing.email.toLowerCase() === inv.email.toLowerCase()) userId = existing.userId
    if (!userId) {
      if ((b.password || '').length < 8) return fail(res, 400, 'Choose a password with at least 8 characters.')
      const { data: u, error } = await sb.auth.admin.createUser({ email: inv.email, password: b.password, email_confirm: true, user_metadata: { name: b.name } })
      if (error) return fail(res, 409, error.message.includes('already') ? 'You already have an account — sign in first, then open this invite link again.' : error.message)
      userId = u.user!.id
    }
    const { error: me } = await sb.from('org_members').insert({ org_id: inv.org_id, user_id: userId, role: inv.role, client_id: inv.client_id, name: b.name, email: inv.email })
    if (me) return fail(res, 402, me.message.replace(/^.*SEAT_LIMIT: /, ''))
    await sb.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', inv.id)
    return ok(res, { ok: true, role: inv.role })
  }

  if (!ctx) return fail(res, 401, 'Please sign in.')
  if (!['owner', 'admin'].includes(ctx.role)) return fail(res, 403, 'Only owners and admins manage the team.')

  if (action === 'list') {
    const [{ data: members }, { data: pending }] = await Promise.all([
      sb.from('org_members').select('user_id, role, client_id, name, email, created_at').eq('org_id', ctx.orgId),
      sb.from('invites').select('id, email, role, client_id, created_at, expires_at').eq('org_id', ctx.orgId).is('accepted_at', null),
    ])
    return ok(res, { members: members || [], pending: pending || [] })
  }
  if (action === 'create') {
    const b = await body<{ email: string; role: string; clientId?: string; name?: string }>(req)
    const email = (b.email || '').trim().toLowerCase()
    if (!email.includes('@')) return fail(res, 400, 'Enter a valid email.')
    if (b.role === 'client' && !b.clientId) return fail(res, 400, 'Pick which client this person belongs to.')
    const { data: inv, error } = await sb.from('invites').insert({ org_id: ctx.orgId, email, role: b.role, client_id: b.clientId || null, invited_by: ctx.userId }).select('token').single()
    if (error) return fail(res, 400, error.message)
    const link = `${origin(req)}/accept-invite?token=${inv.token}`
    const brand = (ctx.org.settings?.name as string) || ctx.org.name
    const what = b.role === 'client' ? `your client portal with ${brand}` : `${brand}'s Command Center as ${b.role}`
    const sent = await sendEmail(email, b.role === 'client' ? `${brand}: your client portal` : `Join ${brand} on Omni`, `<p>Hi${b.name ? ' ' + b.name : ''},</p><p>You've been invited to ${what}.</p><p><a href="${link}">Accept invitation</a> (expires in 14 days)</p>`, brand)
    return ok(res, { ok: true, link, emailed: sent.ok })
  }
  if (action === 'revoke') {
    const b = await body<{ inviteId?: string; userId?: string }>(req)
    if (b.inviteId) await sb.from('invites').delete().eq('id', b.inviteId).eq('org_id', ctx.orgId)
    if (b.userId) {
      if (b.userId === ctx.org.owner_user_id) return fail(res, 400, 'The owner cannot be removed.')
      await sb.from('org_members').delete().eq('org_id', ctx.orgId).eq('user_id', b.userId)
    }
    return ok(res)
  }
  return fail(res, 404, 'Unknown invites action')
}
