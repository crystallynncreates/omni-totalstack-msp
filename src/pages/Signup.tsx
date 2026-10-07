// Buy Omni: pick a plan → create the MSP's account & workspace → Stripe Checkout → workspace goes live.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Loader2, ShieldCheck, Lock } from 'lucide-react'
import { OmniMark } from '../components/Logo'
import { Field, cx } from '../components/ui'
import { PLANS, PLAN_ORDER, type PlanId } from '../../shared/plans'
import { api } from '../lib/api'
import { cloudEnabled } from '../lib/cloud'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
const DOMAIN = (import.meta.env.VITE_PLATFORM_DOMAIN as string) || 'omni-totalstack.com'

export default function Signup() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [plan, setPlan] = useState<PlanId>((PLANS[params.get('plan') as PlanId] ? params.get('plan') : 'business') as PlanId)
  const [f, setF] = useState({ mspName: '', slug: '', name: '', email: '', password: '' })
  const [slugTouched, setSlugTouched] = useState(false)
  const [avail, setAvail] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(params.get('canceled') ? 'Checkout was canceled — your details are saved, choose a plan to continue.' : '')
  const slug = slugTouched ? slugify(f.slug) : slugify(f.mspName)

  useEffect(() => {
    if (!cloudEnabled || slug.length < 2) { setAvail(null); return }
    const t = setTimeout(() => api<{ available: boolean }>(`signup/check-slug?slug=${slug}`).then((r) => setAvail(r.ok ? !!r.data?.available : null)), 350)
    return () => clearTimeout(t)
  }, [slug])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!cloudEnabled) { setErr('Sign-up opens once Omni is deployed with its database. Meanwhile, explore the demo.'); return }
    setBusy(true)
    const r = await api<{ checkoutUrl?: string; next?: string; comped?: boolean }>('signup', { ...f, slug, plan })
    if (!r.ok) { setBusy(false); return setErr(r.error || 'Something went wrong.') }
    if (r.data?.checkoutUrl) { window.location.href = r.data.checkoutUrl; return }
    nav(`/login?created=1&email=${encodeURIComponent(f.email)}${r.data?.comped ? '&owner=1' : ''}`)
  }

  const p = PLANS[plan]
  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-4"><Link to="/" className="flex items-center gap-2"><OmniMark size={30} /><span className="h-display">Omni TotalStack MSP</span></Link><Link to="/login" className="btn-ghost ml-auto">Sign in</Link></header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-3">
          <h1 className="h-display text-3xl">Launch your MSP platform</h1>
          <p className="text-muted">Pick a plan. You can change it any time.</p>
          {PLAN_ORDER.map((id) => {
            const x = PLANS[id]
            return (
              <button key={id} type="button" onClick={() => setPlan(id)} className={cx('glass flex w-full items-start gap-3 p-4 text-left', plan === id && 'ring-2 ring-accent')}>
                <span className={cx('mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border', plan === id ? 'border-accent bg-accent text-white dark:text-black' : 'border-line')}>{plan === id && <Check size={12} />}</span>
                <span className="flex-1"><span className="flex justify-between font-semibold">{x.name}<span>${x.price.toLocaleString()}<span className="text-sm font-normal text-muted">{x.billing === 'one_time' ? ' one-time' : '/mo'}</span></span></span><span className="text-sm text-muted">{x.blurb}</span></span>
              </button>
            )
          })}
        </section>
        <form onSubmit={submit} className="glass h-fit space-y-4 p-6">
          <h2 className="h-display text-xl">Create your workspace</h2>
          <Field label="Your MSP's business name"><input className="input" required value={f.mspName} onChange={(e) => setF({ ...f, mspName: e.target.value })} placeholder="e.g. Peachtree IT Solutions" /></Field>
          <Field label="Your web address" hint={avail === false ? 'That address is taken — try another.' : undefined}>
            <div className="flex items-center gap-1 rounded-xl border border-line bg-panel pr-3 focus-within:border-accent">
              <input className="w-full rounded-xl bg-transparent px-3 py-2 text-sm outline-none" value={slugTouched ? f.slug : slug} onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value }) }} placeholder="peachtree-it" />
              <span className="shrink-0 text-sm text-muted">.{DOMAIN}</span>
              {avail === true && <Check size={16} className="text-ok" />}
            </div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your name"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Email"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          </div>
          <Field label="Password" hint="At least 8 characters"><input className="input" type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          {err && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{err}</p>}
          <button className="btn-primary w-full py-3 text-base" disabled={busy || avail === false}>{busy ? <><Loader2 size={16} className="animate-spin" /> Setting up…</> : `Continue to secure checkout · $${p.price.toLocaleString()}${p.billing === 'one_time' ? ' one-time' : '/mo'}`}</button>
          <p className="flex items-center gap-1.5 text-xs text-muted"><Lock size={12} /> Payments are processed by Stripe. Your workspace activates the moment payment clears.</p>
          {p.billing === 'one_time' && <p className="rounded-xl bg-accent2/10 p-3 text-xs text-muted"><b className="text-ink">Enterprise:</b> after payment you get a hosted workspace right away, and your own standalone copy is set up on a domain you purchase. After the switch it's fully disconnected from Omni, with no monthly fees.</p>}
          <p className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck size={12} /> Already have an account? <Link to="/login" className="text-accent">Sign in</Link></p>
        </form>
      </main>
    </div>
  )
}
