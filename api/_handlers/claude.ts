// Claude (Anthropic Messages API). The API key stays on the server.
import { body, demo, env, fail, ok, secret, type Req, type Res } from '../_lib/util'

export default async function claude(req: Req, res: Res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only')
  const key = await secret('claude', 'apiKey', 'ANTHROPIC_API_KEY')
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
