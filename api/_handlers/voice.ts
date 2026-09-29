// Outbound AI voice calls to a lead, placed with the MSP's own voice provider (Vapi, Retell or ElevenLabs).
import { body, demo, fail, live, ok, orgBySlug, secret, type Ctx, type Req, type Res } from '../_lib/util.js'
import { hasFeature } from '../../shared/plans.js'

export default async function voice(req: Req, res: Res, action: string, ctx: Ctx | null) {
  if (action !== 'call') return fail(res, 404, 'Unknown voice action')
  const b = await body<{ slug?: string; name: string; phone: string; company?: string }>(req)
  const org = ctx?.org ?? (b.slug ? await orgBySlug(b.slug) : null)
  if (!org || !live(org)) return fail(res, 404, 'Calls are not available right now.')
  if (!hasFeature(org.plan, 'ai_voice', org.comped)) return demo(res, 'AI voice calls')
  const provider = (await secret(org.id, 'voice', 'provider', 'VOICE_PROVIDER')) || 'vapi'
  const key = await secret(org.id, 'voice', 'apiKey', 'VOICE_API_KEY')
  const assistant = await secret(org.id, 'voice', 'assistantId', 'VOICE_ASSISTANT_ID')
  const phoneId = await secret(org.id, 'voice', 'phoneNumberId', 'VOICE_PHONE_NUMBER_ID')
  const from = await secret(org.id, 'voice', 'fromNumber', 'VOICE_FROM_NUMBER')
  if (!key || !assistant) return demo(res, 'AI voice provider')
  const to = normalize(b.phone)
  if (!to) return fail(res, 400, 'Valid phone number required')
  const vars = { name: b.name, company: b.company || '', msp: String(org.settings?.name || org.name) }
  let r: Response
  if (provider === 'retell') r = await fetch('https://api.retellai.com/v2/create-phone-call', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from_number: from, to_number: to, override_agent_id: assistant, retell_llm_dynamic_variables: vars }) })
  else if (provider === 'elevenlabs') r = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: assistant, agent_phone_number_id: phoneId, to_number: to, conversation_initiation_client_data: { dynamic_variables: vars } }) })
  else r = await fetch('https://api.vapi.ai/call', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ assistantId: assistant, phoneNumberId: phoneId, customer: { number: to, name: b.name }, assistantOverrides: { variableValues: vars } }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return fail(res, r.status, (j as { message?: string }).message || 'Voice provider error')
  return ok(res, { ok: true, provider })
}

function normalize(p: string) {
  const d = (p || '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return d.length > 7 ? `+${d}` : ''
}
