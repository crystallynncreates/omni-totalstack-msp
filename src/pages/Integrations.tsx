// Integrations hub: guided connection for Claude, RMM, Huntress, M365, Entra ID, UniFi, inventory, QuickBooks, Stripe, payroll, voice, email…
import { useState } from 'react'
import { Plug, CheckCircle2, ExternalLink, Lock, Search } from 'lucide-react'
import { useStore } from '../lib/store'
import { INTEGRATIONS, MARKETPLACE, MARKETPLACE_COUNT, type IntegrationDef } from '../lib/integrations'
import { Badge, Card, Field, Modal, PageHeader, toast, cx } from '../components/ui'
import { api } from '../lib/api'
import { iso, timeAgo } from '../lib/format'
import { useCan } from '../components/Gate'
import { Link } from 'react-router-dom'
import type { IntegrationId } from '../lib/types'

// Integrations included on Free Forever; everything else needs a paid plan.
const FREE_SET: IntegrationId[] = ['rmm', 'huntress', 'm365', 'entra', 'unifi']
const PLAN_FEATURE: Partial<Record<IntegrationId, 'ai_assistant' | 'ai_voice' | 'quickbooks' | 'payroll'>> = { claude: 'ai_assistant', voice: 'ai_voice', quickbooks: 'quickbooks', gusto: 'payroll' }

export default function Integrations() {
  const s = useStore()
  const [open, setOpen] = useState<IntegrationDef | null>(null)
  const [q, setQ] = useState('')
  const connected = INTEGRATIONS.filter((i) => s.integrations[i.id]?.connected).length
  const can = useCan()
  const allowed = (id: IntegrationId) => (PLAN_FEATURE[id] ? can(PLAN_FEATURE[id]!) : FREE_SET.includes(id) || can('all_integrations'))

  return (
    <div>
      <PageHeader title="Integrations" subtitle={`${connected} of ${INTEGRATIONS.length} core integrations connected · ${MARKETPLACE_COUNT}+ in the marketplace`}
        help="Each card has step-by-step instructions. API keys are sent to your secure server (Vercel environment / Supabase vault) — never stored in the browser. Until something is connected, Omni uses demo data so nothing breaks." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((i) => {
          const st = s.integrations[i.id]
          return (
            <div key={i.id} className={cx('glass flex flex-col p-4', st?.connected && 'ring-1 ring-ok/50')}>
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">{i.name}</div><Badge className="mt-1">{i.category}</Badge></div>
                {st?.connected ? <Badge tone="ok"><CheckCircle2 size={12} /> Connected</Badge> : <Badge>Not connected</Badge>}
              </div>
              <p className="mt-2 flex-1 text-sm text-muted">{i.blurb}</p>
              <div className="mt-2 flex flex-wrap gap-1">{i.powers.map((p) => <span key={p} className="chip bg-accent/10 text-accent">{p}</span>)}</div>
              {st?.lastSync && <div className="mt-2 text-xs text-muted">Last sync {timeAgo(st.lastSync)}</div>}
              <div className="mt-3 flex gap-2">
                {allowed(i.id) ? <button className={st?.connected ? 'btn-ghost flex-1' : 'btn-primary flex-1'} onClick={() => setOpen(i)}><Plug size={14} /> {st?.connected ? 'Manage' : 'Connect'}</button> : <Link to="/app/billing" className="btn-ghost flex-1"><Lock size={14} /> Upgrade to connect</Link>}
                {i.docs && <a href={i.docs} target="_blank" rel="noreferrer" className="btn-ghost" title="API docs"><ExternalLink size={14} /></a>}
              </div>
            </div>
          )
        })}
      </div>

      <Card title="Integration marketplace" className="mt-6" action={<div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><input className="input w-56 py-1.5 pl-8" placeholder="Find an integration" value={q} onChange={(e) => setQ(e.target.value)} /></div>}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(MARKETPLACE).map(([cat, list]) => {
            const l = list.filter((n) => n.toLowerCase().includes(q.toLowerCase()))
            if (!l.length) return null
            return <div key={cat}><div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">{cat}</div><div className="flex flex-wrap gap-1.5">{l.map((n) => <button key={n} onClick={() => toast(`${n}: adapter slot ready — request activation in Admin → Integrations roadmap`, 'warn')} className="chip border border-line px-2.5 py-1 text-muted hover:border-accent hover:text-accent">{n}</button>)}</div></div>
          })}
        </div>
      </Card>
      {open && <ConnectModal def={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ConnectModal({ def, onClose }: { def: IntegrationDef; onClose: () => void }) {
  const s = useStore()
  const st = s.integrations[def.id]
  const [vals, setVals] = useState<Record<string, string>>(st.config)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const r = await api('integrations/save', { id: def.id, config: vals })
    // Only non-secret fields are kept in the browser.
    const publicCfg = Object.fromEntries(def.fields.filter((f) => !f.secret).map((f) => [f.key, vals[f.key] ?? '']))
    const test = await api<{ ok: boolean }>(`integrations/test?id=${def.id}`)
    s.setIntegration(def.id, { connected: true, config: publicCfg, lastSync: iso() })
    s.log(`Connected integration: ${def.name}`)
    if (def.id === 'quickbooks' && s.session) {
      const c = await api<{ url: string }>('quickbooks/connect')
      if (c.ok && c.data?.url) { window.location.href = c.data.url; return }
    }
    setBusy(false); onClose()
    toast(r.ok && test.ok ? `${def.name} connected and verified` : s.session ? `${def.name} saved. We couldn't verify it yet — double-check the keys.` : `${def.name} saved (demo). Live data starts once Omni is deployed.`, r.ok ? 'ok' : 'warn')
  }

  return (
    <Modal open onClose={onClose} wide title={`Connect ${def.name}`} footer={<>{st.connected && <button className="btn-danger" onClick={() => { s.setIntegration(def.id, { connected: false, config: {} }); onClose() }}>Disconnect</button>}<button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Connecting…' : 'Save & connect'}</button></>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-semibold">How to get your keys</div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">{def.howTo.map((h) => <li key={h}>{h}</li>)}</ol>
          {s.session ? (
            <div className="mt-4 rounded-xl bg-ok/5 p-3 text-xs text-muted">Your keys are encrypted and stored for <b>your workspace only</b>. No other MSP on Omni can ever use them.</div>
          ) : (
            <div className="mt-4 rounded-xl bg-ink/5 p-3 text-xs">
              <div className="mb-1 font-semibold">Server environment variables (single-company install)</div>
              {def.envVars.map((e) => <div key={e} className="font-mono">{e}</div>)}
            </div>
          )}
        </div>
        <div className="space-y-3">
          {s.session && def.id === 'quickbooks' ? <p className="rounded-xl bg-accent/5 p-3 text-sm">Click <b>Save & connect</b>, sign in to Intuit, and choose your company. No keys needed.</p> : def.fields.map((f) => (
            <Field key={f.key} label={f.label} hint={f.help}>
              <div className="relative">
                <input type={f.secret ? 'password' : 'text'} className="input pr-8" placeholder={f.secret && st.connected ? '•••••••• (saved on server)' : f.placeholder} value={vals[f.key] ?? ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
                {f.secret && <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />}
              </div>
            </Field>
          ))}
          <p className="flex items-center gap-1.5 text-xs text-muted"><Lock size={12} /> Secrets go straight to your server and are never saved in this browser.</p>
        </div>
      </div>
    </Modal>
  )
}
