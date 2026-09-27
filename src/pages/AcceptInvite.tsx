// Team members and client-portal users land here from their invitation email and set a password.
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { bootstrap } from '../lib/cloud'
import { Field } from '../components/ui'

interface Lookup { email: string; role: string; org: { name: string; slug: string; logo?: string } }

export default function AcceptInvite() {
  const [p] = useSearchParams()
  const nav = useNavigate()
  const token = p.get('token') || ''
  const [info, setInfo] = useState<Lookup | null>(null)
  const [err, setErr] = useState('')
  const [f, setF] = useState({ name: '', password: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { api<Lookup>(`invites/lookup?token=${token}`).then((r) => (r.ok ? setInfo(r.data!) : setErr(r.error || 'Invalid invitation'))) }, [token])

  const accept = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await api('invites/accept', { token, ...f })
    if (!r.ok) { setBusy(false); return setErr(r.error || 'Could not accept') }
    const { error } = await supabase!.auth.signInWithPassword({ email: info!.email, password: f.password })
    if (error) { setBusy(false); return nav('/login') }
    await bootstrap()
    nav(info!.role === 'client' ? `/m/${info!.org.slug}/portal` : '/app')
  }

  return (
    <div className="grid min-h-full place-items-center p-4">
      <div className="glass w-full max-w-md p-8">
        {err && !info && <p className="text-center text-bad">{err}</p>}
        {info && (
          <form onSubmit={accept} className="space-y-4">
            <div className="text-center">
              {info.org.logo && <img src={info.org.logo} alt="" className="mx-auto h-12 w-12 rounded-lg object-contain" />}
              <h1 className="mt-3 h-display text-2xl">Join {info.org.name}</h1>
              <p className="text-sm text-muted">{info.role === 'client' ? 'Set up your client portal login' : `You've been invited as ${info.role}`} · {info.email}</p>
            </div>
            <Field label="Your name"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Create a password" hint="At least 8 characters"><input className="input" type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
            {err && <p className="text-sm text-bad">{err}</p>}
            <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Setting up…' : 'Accept & continue'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
