// Command Console API.
//   POST /api/command/plan  { text }            → what Omni would do (no changes)
//   POST /api/command/run   { text, confirm? }  → re-parses the text on the server, checks role + confirmation, runs it, audits it
// The browser never sends "steps" — the server decides what runs, so a tampered request can't skip safety checks.
import crypto from 'node:crypto'
import { body, connectedIntegrations, env, fail, ok, putRecord, records, secret, type Ctx, type Req, type Res } from '../_lib/util.js'
import { parseCommand, planCommand, COMMAND_EXAMPLES, type ParsedCommand } from '../../shared/commands.js'
import { runStep, type OmniClient, type OmniDevice, type OmniPatch, type RunCtx, type StepResult } from '../_lib/adapters.js'

async function load(ctx: Ctx) {
  const [clients, devices] = await Promise.all([records<OmniClient>(ctx.orgId, 'clients'), records<OmniDevice>(ctx.orgId, 'devices')])
  return { clients, devices }
}

/** When the simple parser doesn't understand, ask Claude to rewrite it as one of the supported command shapes. */
async function interpret(ctx: Ctx, text: string): Promise<string | null> {
  const key = await secret(ctx.orgId, 'claude', 'apiKey', 'ANTHROPIC_API_KEY')
  if (!key) return null
  const examples = COMMAND_EXAMPLES.flatMap((g) => g.items).join('\n')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env('ANTHROPIC_MODEL') || 'claude-sonnet-4-5', max_tokens: 120,
      system: `You rewrite an MSP technician's request into exactly ONE command in the style of these examples (same verbs and word order). Keep names, emails, hostnames and client names exactly as given. If it cannot be expressed as one of these command types, reply UNKNOWN. Reply with the command only.\n\n${examples}`,
      messages: [{ role: 'user', content: text.slice(0, 500) }],
    }),
  }).catch(() => null)
  if (!r?.ok) return null
  const j = await r.json()
  const out = String(j?.content?.[0]?.text || '').trim().split('\n')[0]
  return out && out !== 'UNKNOWN' ? out : null
}

export default async function command(req: Req, res: Res, action: string, ctx: Ctx | null) {
  if (!ctx) return fail(res, 401, 'Please sign in.')
  if (req.method !== 'POST') return fail(res, 405, 'POST only')
  if (!['owner', 'admin', 'technician'].includes(ctx.role)) return fail(res, 403, 'Only your MSP team can run commands.')
  const b = await body<{ text: string; confirm?: string }>(req)
  const text = String(b.text || '').slice(0, 500)
  if (!text.trim()) return fail(res, 400, 'Type a command.')

  const { clients, devices } = await load(ctx)
  const connected = await connectedIntegrations(ctx.orgId)
  let parsed: ParsedCommand | null = parseCommand(text, clients, devices)
  let rewritten: string | undefined
  if (!parsed) {
    const alt = await interpret(ctx, text)
    if (alt) { parsed = parseCommand(alt, clients, devices); if (parsed) rewritten = alt }
  }
  const plan = planCommand(parsed, connected)

  if (action === 'plan') return ok(res, { plan, rewritten })
  if (action !== 'run') return fail(res, 404, 'Unknown command action')

  if (!plan.ok || !plan.parsed) return fail(res, 400, plan.problems[0] || 'That command can’t run yet.', { plan })
  if (plan.role === 'admin' && !['owner', 'admin'].includes(ctx.role)) return fail(res, 403, 'Only owners and admins can do that.')
  if (plan.risk !== 'read' && b.confirm !== (plan.confirmWord || 'yes')) return fail(res, 400, plan.confirmWord ? `Type ${plan.confirmWord} to confirm.` : 'Please confirm first.', { plan })

  const [patches, sites, tickets] = await Promise.all([records<OmniPatch>(ctx.orgId, 'patches'), records<{ id: string; clientId: string; name: string; status?: string }>(ctx.orgId, 'sites'), records<{ number?: number }>(ctx.orgId, 'tickets')])
  const s = ctx.org.settings || {}
  const rc: RunCtx = { orgId: ctx.orgId, who: ctx.email, cmd: plan.parsed, clients, devices, patches, sites, tickets, soakDays: Number(s.patchSoakDays) || 15, brand: String(s.name || ctx.org.name) }

  const results: StepResult[] = []
  for (const step of plan.steps) results.push(await runStep(step.integration, rc))

  // Audit trail (never includes generated passwords)
  await putRecord(ctx.orgId, 'audit', { id: 'a' + crypto.randomBytes(6).toString('hex'), at: new Date().toISOString(), who: ctx.email, action: `Command: ${plan.title} → ${results.map((r) => `${r.integration}: ${r.ok ? 'OK' : 'FAILED'} — ${r.message}`).join(' | ')}`.slice(0, 1000) })
  return ok(res, { plan, rewritten, results })
}
