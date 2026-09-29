// Claude (Anthropic Messages API). Omni provides AI to Business/Enterprise workspaces from the platform key;
// an MSP may also connect its own Anthropic key.
import { body, demo, env, fail, ok, secret, type Ctx, type Req, type Res } from '../_lib/util.js'
import { hasFeature } from '../../shared/plans.js'

export default async function claude(req: Req, res: Res, _a: string, ctx: Ctx | null) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only')
  if (ctx && !hasFeature(ctx.org.plan, 'ai_assistant', ctx.org.comped)) return fail(res, 402, 'The Claude AI assistant is included in the Business plan and up.')
  const key = await secret(ctx?.orgId ?? null, 'claude', 'apiKey', 'ANTHROPIC_API_KEY')
  if (!key) return demo(res, 'Claude')
  const { prompt, system } = await body<{ prompt: string; system?: string }>(req)
  if (!prompt) return fail(res, 400, 'prompt required')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env('ANTHROPIC_MODEL') || 'claude-sonnet-4-5', max_tokens: 1200, system: system || 'You are the AI assistant inside Omni TotalStack MSP.', messages: [{ role: 'user', content: prompt }] }),
  })
  const j = await r.json()
  if (!r.ok) return fail(res, r.status, j?.error?.message || 'Claude error')
  return ok(res, { text: (j.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n') })
}
