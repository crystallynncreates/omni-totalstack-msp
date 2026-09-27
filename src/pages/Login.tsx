import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, PlayCircle } from 'lucide-react'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { bootstrap, cloudEnabled } from '../lib/cloud'
import Logo, { OmniMark } from '../components/Logo'

export default function Login() {
  const s = useStore()
  const nav = useNavigate()
  const [p] = useSearchParams()
  const [email, setEmail] = useState(p.get('email') || '')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const exploreDemo = () => {
    useStore.setState({ session: null })
    s.resetDemo()
    s.setUI({ signedIn: true, demoMode: true })
    nav('/app')
  }

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!supabase) return exploreDemo()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) { setBusy(false); return setErr(error.message === 'Invalid login credentials' ? 'That email and password don’t match. Try again or reset your password.' : error.message) }
    const r = await bootstrap()
    setBusy(false)
    if (!r.ok) return setErr(r.reason === 'no_workspace' ? 'This account has no workspace yet. Start one from the pricing page, or ask your MSP for a new invitation.' : r.message || 'Could not load your workspace.')
    nav(r.session.role === 'client' ? `/m/${r.session.slug}/portal` : '/app')
  }

  const reset = async () => {
    if (!supabase || !email) return setErr('Enter your email above first.')
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` })
    setErr('Password reset email sent — check your inbox.')
  }

  return (
    <div className="grid min-h-full place-items-center p-4">
      <div className="glass w-full max-w-md p-8 animate-fadeUp">
        <div className="mb-6 flex flex-col items-center text-center">
          {import.meta.env.VITE_STANDALONE_SLUG ? <Logo size={52} /> : <OmniMark size={52} />}
          <h1 className="mt-3 h-display text-2xl">Sign in</h1>
          <p className="text-sm text-muted">{import.meta.env.VITE_STANDALONE_SLUG ? 'Command Center' : 'Omni TotalStack MSP Command Center'}</p>
        </div>
        {p.get('created') && <p className="mb-4 rounded-xl bg-ok/10 p-3 text-sm text-ok">{p.get('owner') ? 'Your complimentary owner workspace is ready.' : 'Your workspace is ready.'} Sign in to start the setup wizard.</p>}
        <form onSubmit={signIn} className="space-y-3">
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required={cloudEnabled} />
          <input className="input" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required={cloudEnabled} />
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button>
        </form>
        {cloudEnabled && <button onClick={reset} className="mt-2 w-full text-center text-xs text-muted hover:text-accent">Forgot password?</button>}
        <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
        {!import.meta.env.VITE_STANDALONE_SLUG && <button onClick={exploreDemo} className="btn-ghost w-full"><PlayCircle size={16} /> Explore the demo workspace</button>}
        {!cloudEnabled && <p className="mt-4 rounded-xl bg-accent/5 p-3 text-center text-xs text-muted">Demo mode: the database isn't connected on this copy, so everything runs on sample data in your browser.</p>}
        <div className="mt-5 flex justify-between text-xs text-muted">
          <Link to="/" className="hover:text-accent">← Home</Link>
          {!import.meta.env.VITE_STANDALONE_SLUG && <Link to="/signup" className="hover:text-accent">New to Omni? Get started →</Link>}
        </div>
      </div>
    </div>
  )
}
