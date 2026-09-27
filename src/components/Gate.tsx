// Plan-based access: features outside the workspace's plan show an upgrade card instead of the page.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Sparkles } from 'lucide-react'
import { useStore } from '../lib/store'
import { hasFeature, PLANS, PLAN_ORDER, type Feature } from '../../shared/plans'

export function useCan() {
  const session = useStore((s) => s.session)
  return (f: Feature) => !session || hasFeature(session.plan, f, session.comped)
}

export function FeatureGate({ feature, name, children }: { feature: Feature; name: string; children: ReactNode }) {
  const can = useCan()
  if (can(feature)) return <>{children}</>
  const plan = PLAN_ORDER.map((p) => PLANS[p]).find((p) => p.features.includes(feature))!
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="glass max-w-md p-8 text-center">
        <div className="mx-auto w-fit rounded-2xl bg-accent/10 p-3 text-accent"><Lock /></div>
        <h1 className="mt-3 h-display text-2xl">{name} is on the {plan.name} plan</h1>
        <p className="mt-2 text-sm text-muted">Upgrade to unlock {name.toLowerCase()} plus {plan.highlights.slice(0, 2).join(' and ').toLowerCase()}.</p>
        <Link to="/app/billing" className="btn-primary mt-5"><Sparkles size={15} /> See upgrade options</Link>
      </div>
    </div>
  )
}
