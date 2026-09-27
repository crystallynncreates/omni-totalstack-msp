import { Link, useSearchParams } from 'react-router-dom'
import { PartyPopper } from 'lucide-react'
import { OmniMark } from '../components/Logo'

export default function Welcome() {
  const [p] = useSearchParams()
  return (
    <div className="grid min-h-full place-items-center p-4">
      <div className="glass max-w-lg p-8 text-center animate-fadeUp">
        <OmniMark size={48} />
        <PartyPopper className="mx-auto mt-4 text-accent" size={36} />
        <h1 className="mt-3 h-display text-2xl">Payment received — welcome to Omni!</h1>
        <p className="mt-2 text-muted">Your workspace{p.get('org') ? <> <b className="text-ink">{p.get('org')}</b></> : ''} is live, along with your branded website and client portal. Sign in and the setup wizard will help you add your logo, colors and first client.</p>
        {p.get('enterprise') && <p className="mt-3 rounded-xl bg-accent2/10 p-3 text-sm">You now own Omni Enterprise. After you sign in, open <b>Plan & Billing → Standalone setup</b> to move to your own copy on your own domain.</p>}
        <Link to="/login" className="btn-primary mt-6 px-6 py-3">Sign in to your Command Center</Link>
        <p className="mt-3 text-xs text-muted">A receipt from Stripe is on its way to your inbox.</p>
      </div>
    </div>
  )
}
