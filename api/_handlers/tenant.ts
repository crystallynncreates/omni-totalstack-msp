// Public branding for each MSP's own landing page & client portal (by slug, subdomain or custom domain),
// plus custom-domain setup. Locked (unpaid) workspaces report live:false so their public pages go dark.
import { body, context, env, fail, live, mustDb, ok, orgByHost, orgBySlug, type Req, type Res } from '../_lib/util'
import { hasFeature } from '../../shared/plans'

const PUBLIC_KEYS = ['name', 'legalName', 'address', 'city', 'state', 'zip', 'phone', 'email', 'website', 'logoDataUrl', 'accent', 'huntressPortalUrl', 'patchSoakDays', 'laborRate', 'tagline', 'services', 'pricing']

export default async function tenant(req: Req, res: Res, action: string) {
  if (action === 'public') {
    const slug = String(req.query.slug || '')
    const host = String(req.query.host || '')
    const org = slug ? await orgBySlug(slug) : host ? await orgByHost(host) : null
    if (!org) return fail(res, 404, 'Not found')
    const s = org.settings || {}
    return ok(res, { slug: org.slug, live: live(org), plan: org.plan, settings: Object.fromEntries(PUBLIC_KEYS.filter((k) => k in s).map((k) => [k, s[k]])) })
  }
  if (action === 'domain') {
    const ctx = await context(req)
    if (!ctx || !['owner', 'admin'].includes(ctx.role)) return fail(res, 403, 'Only the owner can change domains.')
    if (!hasFeature(ctx.org.plan, 'custom_domain', ctx.org.comped)) return fail(res, 402, 'Custom domains are included in the Business plan and up.')
    const { domain } = await body<{ domain: string }>(req)
    const d = (domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return fail(res, 400, 'Enter a domain like it.yourcompany.com')
    const { error } = await mustDb().from('orgs').update({ custom_domain: d }).eq('id', ctx.orgId)
    if (error) return fail(res, 409, 'That domain is already connected to another workspace.')
    let vercel: unknown = null
    if (env('VERCEL_TOKEN') && env('VERCEL_PROJECT_ID')) {
      const team = env('VERCEL_TEAM_ID') ? `?teamId=${env('VERCEL_TEAM_ID')}` : ''
      const r = await fetch(`https://api.vercel.com/v10/projects/${env('VERCEL_PROJECT_ID')}/domains${team}`, { method: 'POST', headers: { Authorization: `Bearer ${env('VERCEL_TOKEN')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: d }) })
      vercel = await r.json()
    }
    return ok(res, { ok: true, domain: d, dns: { type: d.split('.').length > 2 ? 'CNAME' : 'A', name: d.split('.').length > 2 ? d.split('.')[0] : '@', value: d.split('.').length > 2 ? 'cname.vercel-dns.com' : '76.76.21.21' }, vercel })
  }
  return fail(res, 404, 'Unknown tenant action')
}
