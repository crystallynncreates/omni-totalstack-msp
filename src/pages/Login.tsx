import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Lock } from 'lucide-react'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function Login() {
  const setUI = useStore((s) => s.setUI)
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (supabase && email) {
      setBusy(true)
      const { error, data } = await supabase.auth.signInWithPassword({ email, password: pw })
      setBusy(false)
      if (error) return setErr(error.message)
      setUI({ signedIn: true, userName: data.user?.user_metadata?.name || email.split('@')[0] })
    } else {
      setUI({ signedIn: true, userName: email ? email.split('@')[0] : 'Crystal' })
    }
    nav('/app')
  }

  return (
    <div className="grid min-h-full place-items-center p-4">
      <div className="glass w-full max-w-md p-8 animate-fadeUp">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={52} />
          <h1 className="mt-3 h-display text-2xl">Omni TotalStack MSP</h1>
          <p className="text-sm text-muted">Sign in to your Command Center</p>
        </div>
        <form onSubmit={signIn} className="space-y-3">
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button>
        </form>
        {!supabase && <p className="mt-4 rounded-xl bg-accent/5 p-3 text-center text-xs text-muted">Demo mode: any email works (or leave blank). Connect Supabase in <code>.env</code> to enable real accounts — see docs/SETUP.md.</p>}
        <div className="mt-5 flex justify-between text-xs text-muted">
          <Link to="/" className="hover:text-accent">← Back to website</Link>
          <Link to="/portal" className="flex items-center gap-1 hover:text-accent"><Lock size={12} /> Client portal</Link>
        </div>
      </div>
    </div>
  )
}
