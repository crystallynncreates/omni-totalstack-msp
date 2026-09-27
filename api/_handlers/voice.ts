// Outbound AI voice calls for website leads. Providers: Vapi (default), Retell, ElevenLabs Conversational AI.
import { body, demo, env, fail, ok, secret, type Req, type Res } from '../_lib/util'

export default async function voice(req: Req, res: Res, action: string) {
  if (action !== 'call') return fail(res, 404, 'Unknown voice action')
  const provider = (await secret('voice', 'provider', 'VOICE_PROVIDER')) || 'vapi'
  const key = await secret('voice', 'apiKey', 'VOICE_API_KEY')
  const assistant = await secret('voice', 'assistantId', 'VOICE_ASSISTANT_ID')
  const phoneId = await secret('voice', 'phoneNumberId', 'VOICE_PHONE_NUMBER_ID')
  if (!key || !assistant) return demo(res, 'AI voice provider')
  const { name, phone, company } = await body<{ name: string; phone: string; company?: string }>(req)
  const to = normalize(phone)
  if (!to) return fail(res, 400, 'Valid phone number required')
  let r: Response
  if (provider === 'retell') {
    r = await fetch('https://api.retellai.com/v2/create-phone-call', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from_number: env('VOICE_FROM_NUMBER'), to_number: to, override_agent_id: assistant, retell_llm_dynamic_variables: { name, company: company || '' } }) })
  } else if (provider === 'elevenlabs') {
    r = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: assistant, agent_phone_number_id: phoneId, to_number: to, conversation_initiation_client_data: { dynamic_variables: { name, company: company || '' } } }) })
  } else {
    r = await fetch('https://api.vapi.ai/call', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ assistantId: assistant, phoneNumberId: phoneId, customer: { number: to, name }, assistantOverrides: { variableValues: { name, company: company || '' } } }) })
  }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return fail(res, r.status, (j as { message?: string }).message || 'Voice provider error')
  return ok(res, { ok: true, provider, call: j })
}

function normalize(p: string) {
  const d = (p || '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return d.length > 7 ? `+${d}` : ''
}
