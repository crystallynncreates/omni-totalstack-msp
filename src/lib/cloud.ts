// Cloud mode: when Supabase is configured, every MSP workspace lives in the database.
// bootstrap() loads the signed-in user's workspace into the store, keeps it live (realtime),
// and writes every change back — with Row Level Security doing the enforcement server-side.
import { supabase } from './supabase'
import { api } from './api'
import { useStore, setSyncer, emptyCollections, emptyIntegrations, COLLECTION_KEYS, type CollectionKey, type Session } from './store'
import { defaultCompany } from './seed'
import type { Company, IntegrationState } from './types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export const cloudEnabled = !!supabase
let channel: RealtimeChannel | null = null

interface MeResponse {
  userId: string; email: string; role: Session['role']; clientId?: string | null; platformOwner: boolean
  org: { id: string; slug: string; name: string; plan: Session['plan']; status: Session['status']; comped: boolean; grace_until?: string | null; current_period_end?: string | null; custom_domain?: string | null; settings: Partial<Company>; integrations: Record<string, IntegrationState> }
}

export type BootResult = { ok: true; session: Session } | { ok: false; reason: 'signed_out' | 'no_workspace' | 'error'; message?: string }

export async function bootstrap(): Promise<BootResult> {
  if (!supabase) return { ok: false, reason: 'signed_out' }
  const { data } = await supabase.auth.getSession()
  if (!data.session) return { ok: false, reason: 'signed_out' }
  const r = await api<MeResponse>('me')
  if (!r.ok || !r.data) return { ok: false, reason: r.error?.includes('No workspace') ? 'no_workspace' : 'error', message: r.error }
  const me = r.data
  const o = me.org
  const session: Session = { orgId: o.id, slug: o.slug, plan: o.plan, status: o.status, comped: o.comped, graceUntil: o.grace_until, currentPeriodEnd: o.current_period_end, customDomain: o.custom_domain, role: me.role, clientId: me.clientId, email: me.email, platformOwner: me.platformOwner }

  // Load every record this user may see (RLS filters by role / client)
  const cols = emptyCollections() as unknown as Record<string, { id: string }[]>
  const { data: rows, error } = await supabase.from('records').select('collection, data').eq('org_id', o.id)
  if (error) return { ok: false, reason: 'error', message: error.message }
  for (const row of rows || []) (cols[row.collection] ||= []).push(row.data)
  for (const k of COLLECTION_KEYS) cols[k].sort((a, b) => String((b as unknown as { createdAt?: string; at?: string }).createdAt ?? (b as unknown as { at?: string }).at ?? '').localeCompare(String((a as unknown as { createdAt?: string; at?: string }).createdAt ?? (a as unknown as { at?: string }).at ?? '')))

  const company: Company = { ...defaultCompany, ...o.settings, name: o.settings?.name || o.name }
  const s = useStore.getState()
  useStore.setState({
    ...(cols as object),
    company,
    integrations: { ...emptyIntegrations(), ...(o.integrations || {}) },
    session,
    ui: { ...s.ui, signedIn: true, demoMode: false, role: me.role, userName: (company as Company & { ownerName?: string }).ownerName && me.role === 'owner' ? String((company as Company & { ownerName?: string }).ownerName).split(' ')[0] : me.email.split('@')[0], setupDone: me.role !== 'owner' || !!(o.settings as { setupDone?: boolean })?.setupDone || s.ui.setupDone },
  })

  // Write-through sync
  setSyncer({
    put: (k, item) => { void supabase!.from('records').upsert({ org_id: o.id, collection: k, id: item.id, data: item }).then(({ error }) => error && reportWriteError(k, error.message)) },
    del: (k, id) => { void supabase!.from('records').delete().eq('org_id', o.id).eq('collection', k).eq('id', id) },
    company: (c) => { void supabase!.from('orgs').update({ settings: { ...c, setupDone: true }, name: c.name }).eq('id', o.id) },
    integrations: (i) => { void supabase!.from('orgs').update({ integrations: i }).eq('id', o.id) },
  })

  // Realtime: other people's changes in the same workspace appear instantly
  channel?.unsubscribe()
  channel = supabase.channel('org-' + o.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `org_id=eq.${o.id}` }, (p) => {
      const row = (p.new && Object.keys(p.new).length ? p.new : p.old) as { collection: CollectionKey; id: string; data?: { id: string } }
      const st = useStore.getState() as unknown as Record<string, { id: string }[]>
      const list = st[row.collection]
      if (!list) return
      if (p.eventType === 'DELETE') useStore.setState({ [row.collection]: list.filter((x) => x.id !== row.id) } as never)
      else if (row.data) useStore.setState({ [row.collection]: list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row.data! : x)) : [row.data, ...list] } as never)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orgs', filter: `id=eq.${o.id}` }, (p) => {
      const n = p.new as MeResponse['org']
      const cur = useStore.getState().session
      if (cur) useStore.setState({ session: { ...cur, plan: n.plan, status: n.status, comped: n.comped, graceUntil: n.grace_until, customDomain: n.custom_domain } })
    })
    .subscribe()

  return { ok: true, session }
}

let limitCb: (m: string) => void = () => {}
export const onWriteError = (fn: (m: string) => void) => { limitCb = fn }
function reportWriteError(k: string, msg: string) {
  if (msg.includes('PLAN_LIMIT') || msg.includes('SEAT_LIMIT')) limitCb(msg.replace(/^.*?(PLAN|SEAT)_LIMIT: /, ''))
  else if (msg.includes('row-level security')) limitCb(`You don't have permission to change ${k}, or this workspace is paused.`)
  else limitCb(`Couldn't save ${k}: ${msg}`)
  void bootstrap() // resync with the database
}

export async function signOut() {
  channel?.unsubscribe(); channel = null
  setSyncer(null)
  await supabase?.auth.signOut()
  useStore.setState({ session: null, ui: { ...useStore.getState().ui, signedIn: false } })
}
