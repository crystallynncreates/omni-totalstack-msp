// Payroll adapter (Gusto). Omni prepares hours; the provider calculates taxes and runs direct deposit.
import { body, demo, fail, ok, secret, type Req, type Res } from '../_lib/util'

export default async function payroll(req: Req, res: Res, action: string) {
  const token = await secret('gusto', 'token', 'PAYROLL_TOKEN')
  const company = await secret('gusto', 'companyId', 'GUSTO_COMPANY_ID')
  if (!token || !company) return demo(res, 'Payroll provider')
  const g = async (path: string, init: RequestInit = {}) => { const r = await fetch(`https://api.gusto.com/v1${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } }); if (!r.ok) throw new Error(`Gusto ${path}: ${r.status}`); return r.json() }
  if (action === 'employees') return ok(res, await g(`/companies/${company}/employees`))
  if (action === 'payrolls') return ok(res, await g(`/companies/${company}/payrolls?processing_statuses=unprocessed`))
  if (action === 'run') {
    const b = await body<{ periodStart: string; periodEnd: string }>(req)
    const list = await g(`/companies/${company}/payrolls?processing_statuses=unprocessed&start_date=${b.periodStart}&end_date=${b.periodEnd}`)
    return ok(res, { ok: true, payrolls: list, note: 'Review & submit the unprocessed payroll in Gusto (or call PUT /payrolls/{id}/submit once hours are synced).' })
  }
  return fail(res, 404, 'Unknown payroll action')
}
