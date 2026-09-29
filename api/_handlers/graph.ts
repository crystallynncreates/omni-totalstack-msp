// Microsoft 365 + Entra ID via Microsoft Graph (client credentials; use GDAP to reach client tenants).
import { body, demo, putRecord, fail, ok, secret, type Ctx, type Req, type Res } from '../_lib/util.js'

async function token(tenant: string, clientId: string, clientSecret: string) {
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }) })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error_description || 'Graph token error')
  return j.access_token as string
}
const g = async (t: string, path: string) => { const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, { headers: { Authorization: `Bearer ${t}` } }); if (!r.ok) throw new Error(`Graph ${path}: ${r.status}`); return r.json() }

export default async function graph(req: Req, res: Res, action: string, ctx: Ctx | null) {
  const clientId = await secret(ctx?.orgId ?? null, 'm365', 'clientId', 'MS_CLIENT_ID')
  const clientSecret = await secret(ctx?.orgId ?? null, 'm365', 'clientSecret', 'MS_CLIENT_SECRET')
  const partnerTenant = await secret(ctx?.orgId ?? null, 'm365', 'tenantId', 'MS_TENANT_ID')
  if (!clientId || !clientSecret) return demo(res, 'Microsoft 365 / Entra ID')
  const b = req.method === 'POST' ? await body<{ tenant?: string; clientId?: string }>(req) : {}
  const tenant = b.tenant || String(req.query.tenant || partnerTenant)
  const t = await token(tenant, clientId, clientSecret)
  if (action === 'users') return ok(res, await g(t, '/users?$select=id,displayName,userPrincipalName,accountEnabled,assignedLicenses,signInActivity&$top=999'))
  if (action === 'groups') return ok(res, await g(t, '/groups?$select=id,displayName,groupTypes,mail&$top=999'))
  if (action === 'mfa') return ok(res, await g(t, '/reports/authenticationMethods/userRegistrationDetails?$top=999'))
  if (action === 'licenses') return ok(res, await g(t, '/subscribedSkus'))
  if (action === 'secure-score') return ok(res, await g(t, '/security/secureScores?$top=1'))
  if (action === 'service-health') return ok(res, await g(t, '/admin/serviceAnnouncement/healthOverviews'))
  if (action === 'sync') {
    if (!ctx || !b.clientId) return fail(res, 400, 'Choose which client this tenant belongs to.')
    const [users, mfa] = await Promise.all([g(t, '/users?$select=id,displayName,userPrincipalName,accountEnabled,signInActivity&$top=999'), g(t, '/reports/authenticationMethods/userRegistrationDetails?$top=999')])
    const mfaMap = new Map<string, boolean>((mfa.value || []).map((m: { userPrincipalName: string; isMfaRegistered: boolean }) => [m.userPrincipalName, m.isMfaRegistered]))
    const rows = (users.value || []).map((u: { id: string; displayName: string; userPrincipalName: string; accountEnabled: boolean; signInActivity?: { lastSignInDateTime?: string } }) => ({ id: u.id, clientId: b.clientId, displayName: u.displayName, upn: u.userPrincipalName, license: '', mfa: mfaMap.get(u.userPrincipalName) ?? false, groups: [] as string[], lastSignIn: u.signInActivity?.lastSignInDateTime ?? new Date(0).toISOString(), enabled: u.accountEnabled }))
    for (const r of rows) await putRecord(ctx.orgId, 'directoryUsers', r)
    return ok(res, { users: rows.length })
  }
  return fail(res, 404, 'Unknown Graph action')
}
