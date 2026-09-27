// Thin client for the serverless API in /api (Vercel functions).
// Every call degrades gracefully: when the API or an integration isn't configured, callers get
// { ok:false, demo:true } and fall back to local demo data, so novices never see a broken screen.

export interface ApiResult<T = unknown> { ok: boolean; demo?: boolean; data?: T; error?: string }

import { supabase } from './supabase'

export async function api<T = unknown>(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const session = supabase ? (await supabase.auth.getSession()).data.session : null
    if (session) headers.Authorization = `Bearer ${session.access_token}`
    const res = await fetch(`/api/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return { ok: false, demo: true, error: 'API not deployed (running locally in demo mode)' }
    const json = await res.json()
    if (!res.ok) return { ok: false, demo: json.demo, error: json.error || res.statusText }
    return { ok: true, data: json as T }
  } catch (e) {
    return { ok: false, demo: true, error: (e as Error).message }
  }
}

/** Ask Claude (through /api/claude so the API key never touches the browser). */
export async function askClaude(prompt: string, system?: string) {
  const r = await api<{ text: string }>('claude', { prompt, system })
  return r.ok && r.data ? r.data.text : null
}
