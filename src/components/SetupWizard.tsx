// First-login setup wizard: business info → branding → policies → integrations → first client & tech → done.
import { useState } from 'react'
import { Rocket, Building, Palette, ShieldCheck, Plug, Users, CircleCheck, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { Field, cx } from './ui'
import { uid, iso, isoDate } from '../lib/format'
import { WEEKDAYS } from '../lib/patchPolicy'
import Logo from './Logo'

const STEPS = [
  { t: 'Welcome', i: Rocket },
  { t: 'Your business', i: Building },
  { t: 'Branding', i: Palette },
  { t: 'Policies', i: ShieldCheck },
  { t: 'Connect tools', i: Plug },
  { t: 'First client & tech', i: Users },
  { t: 'Ready', i: CircleCheck },
]

export default function SetupWizard() {
  const s = useStore()
  const [step, setStep] = useState(0)
  const [c, setC] = useState({ ...s.company })
  const [dataMode, setDataMode] = useState<'demo' | 'fresh'>('demo')
  const [client, setClient] = useState({ name: '', contact: '', email: '', phone: '', group: 'General' })
  const [tech, setTech] = useState({ name: '', email: '' })
  const up = (p: Partial<typeof c>) => setC({ ...c, ...p })

  const finish = () => {
    s.setCompany(c)
    if (dataMode === 'fresh') s.startFresh()
    if (client.name) s.add('clients', { id: uid('c'), name: client.name, group: client.group, status: 'onboarding', primaryContact: { name: client.contact, email: client.email, phone: client.phone }, address: '', ownerName: client.name, ownerAddress: '', slaTier: 'Essential', mrr: 0, autopay: false, notes: '', createdAt: iso() })
    if (tech.name) s.add('employees', { id: uid('e'), name: tech.name, email: tech.email, role: 'Technician', appRole: 'technician', type: 'W2', rate: 25, hoursThisPeriod: 0, ptoBalance: 0, directDeposit: 'none', startDate: isoDate(), certifications: [], w4OnFile: false, i9OnFile: false })
    s.log('Completed first-login setup wizard')
    s.setUI({ setupDone: true })
  }

  const onLogo = (f?: File) => {
    if (!f) return
    const r = new FileReader()
    r.onload = () => up({ logoDataUrl: String(r.result) })
    r.readAsDataURL(f)
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md">
      <div className="glass flex w-full max-w-3xl flex-col overflow-hidden bg-panel md:flex-row">
        <ol className="flex gap-1 overflow-x-auto border-b border-line p-3 md:w-56 md:flex-col md:border-b-0 md:border-r">
          {STEPS.map((x, i) => (
            <li key={x.t} className={cx('flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm', i === step ? 'bg-accent/15 text-accent' : i < step ? 'text-ink' : 'text-muted')}>
              <x.i size={15} /> <span className="hidden md:inline">{x.t}</span>
            </li>
          ))}
        </ol>
        <div className="flex min-h-[420px] flex-1 flex-col p-6">
          <div className="flex-1">
            {step === 0 && (
              <div className="text-center">
                <div className="mx-auto mb-4 w-fit"><Logo size={64} /></div>
                <h2 className="h-display text-2xl">Welcome to <span className="gradient-text">Omni TotalStack MSP</span></h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">This 2-minute setup personalizes your command center. You can change anything later in Admin. No technical knowledge needed.</p>
                <div className="mx-auto mt-6 grid max-w-md gap-3 text-left sm:grid-cols-2">
                  {(['demo', 'fresh'] as const).map((m) => (
                    <button key={m} onClick={() => setDataMode(m)} className={cx('rounded-xl border p-4 text-sm', dataMode === m ? 'border-accent bg-accent/10' : 'border-line')}>
                      <div className="font-semibold">{m === 'demo' ? 'Explore with demo data' : 'Start fresh'}</div>
                      <div className="mt-1 text-xs text-muted">{m === 'demo' ? 'Sample clients, sites and invoices so you can learn safely.' : 'An empty workspace for your real business.'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <h2 className="h-display text-xl sm:col-span-2">Tell us about your business</h2>
                <Field label="MSP name"><input className="input" value={c.name} onChange={(e) => up({ name: e.target.value })} /></Field>
                <Field label="Legal name" hint="Used on contracts & notices"><input className="input" value={c.legalName} onChange={(e) => up({ legalName: e.target.value })} /></Field>
                <Field label="Street address" className="sm:col-span-2"><input className="input" value={c.address} onChange={(e) => up({ address: e.target.value })} /></Field>
                <Field label="City"><input className="input" value={c.city} onChange={(e) => up({ city: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3"><Field label="State"><input className="input" value={c.state} onChange={(e) => up({ state: e.target.value })} /></Field><Field label="ZIP"><input className="input" value={c.zip} onChange={(e) => up({ zip: e.target.value })} /></Field></div>
                <Field label="Phone"><input className="input" value={c.phone} onChange={(e) => up({ phone: e.target.value })} /></Field>
                <Field label="Email"><input className="input" value={c.email} onChange={(e) => up({ email: e.target.value })} /></Field>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="h-display text-xl">Make it yours</h2>
                <Field label="Logo" hint="PNG or SVG. Appears on proposals, invoices and your portal.">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line p-4 hover:border-accent">
                    {c.logoDataUrl ? <img src={c.logoDataUrl} className="h-12 w-12 rounded object-contain" /> : <Upload className="text-muted" />}
                    <span className="text-sm text-muted">Click to upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
                  </label>
                </Field>
                <Field label="Accent color">
                  <div className="flex gap-3">
                    {(['blue', 'purple', 'gold'] as const).map((a) => (
                      <button key={a} onClick={() => { up({ accent: a }); document.documentElement.dataset.accent = a }} className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm capitalize', c.accent === a ? 'border-accent' : 'border-line')}>
                        <span className="h-4 w-4 rounded-full" style={{ background: a === 'blue' ? '#38bdf8' : a === 'purple' ? '#c084fc' : '#facc15' }} /> Neon {a}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Theme">
                  <div className="flex gap-3">
                    {(['dark', 'light'] as const).map((t) => <button key={t} onClick={() => s.setUI({ theme: t })} className={cx('rounded-xl border px-3 py-2 text-sm capitalize', s.ui.theme === t ? 'border-accent' : 'border-line')}>{t === 'dark' ? 'Matte black' : 'Light'}</button>)}
                  </div>
                </Field>
              </div>
            )}
            {step === 3 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <h2 className="h-display text-xl sm:col-span-2">Your policies</h2>
                <Field label="Standard labor rate ($/hr)"><input type="number" className="input" value={c.laborRate} onChange={(e) => up({ laborRate: +e.target.value })} /></Field>
                <Field label="After-hours rate ($/hr)"><input type="number" className="input" value={c.afterHoursRate} onChange={(e) => up({ afterHoursRate: +e.target.value })} /></Field>
                <Field label="Payment terms (days)"><input type="number" className="input" value={c.paymentTermsDays} onChange={(e) => up({ paymentTermsDays: +e.target.value })} /></Field>
                <Field label="Sales tax on hardware (%)"><input type="number" className="input" value={c.taxRate} onChange={(e) => up({ taxRate: +e.target.value })} /></Field>
                <Field label="Patch stability period (days)" hint="Updates deploy only after this many bug-free days. Recommended: 15."><input type="number" className="input" value={c.patchSoakDays} onChange={(e) => up({ patchSoakDays: +e.target.value })} /></Field>
                <Field label="Weekly client update email">
                  <div className="flex gap-2">
                    <select className="input" value={c.weeklyEmailDay} onChange={(e) => up({ weeklyEmailDay: +e.target.value })}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
                    <select className="input" value={c.weeklyEmailHour} onChange={(e) => up({ weeklyEmailHour: +e.target.value })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{((h + 11) % 12) + 1}:00 {h < 12 ? 'AM' : 'PM'}</option>)}</select>
                  </div>
                </Field>
                <Field label="Huntress partner portal URL" className="sm:col-span-2"><input className="input" value={c.huntressPortalUrl} onChange={(e) => up({ huntressPortalUrl: e.target.value })} /></Field>
              </div>
            )}
            {step === 4 && (
              <div>
                <h2 className="h-display text-xl">Connect your tools (optional)</h2>
                <p className="mt-1 text-sm text-muted">You can skip this. Everything works with demo data until you connect. Each integration has a step-by-step guide in <b>Integrations</b>.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {['Claude (AI)', 'RMM', 'Huntress', 'Microsoft 365', 'Entra ID', 'UniFi', 'QuickBooks', 'Stripe payments', 'AI voice calls', 'Email (weekly updates)'].map((n) => (
                    <div key={n} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">{n}<span className="chip bg-ink/5 text-muted">Later</span></div>
                  ))}
                </div>
              </div>
            )}
            {step === 5 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <h2 className="h-display text-xl sm:col-span-2">Add your first client & technician <span className="text-sm font-normal text-muted">(optional)</span></h2>
                <Field label="Client business name"><input className="input" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></Field>
                <Field label="Client group" hint="e.g. Healthcare, Legal, Retail"><input className="input" value={client.group} onChange={(e) => setClient({ ...client, group: e.target.value })} /></Field>
                <Field label="Contact name"><input className="input" value={client.contact} onChange={(e) => setClient({ ...client, contact: e.target.value })} /></Field>
                <Field label="Contact email"><input className="input" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></Field>
                <Field label="Technician name"><input className="input" value={tech.name} onChange={(e) => setTech({ ...tech, name: e.target.value })} /></Field>
                <Field label="Technician email"><input className="input" value={tech.email} onChange={(e) => setTech({ ...tech, email: e.target.value })} /></Field>
              </div>
            )}
            {step === 6 && (
              <div className="text-center">
                <CircleCheck size={56} className="mx-auto text-ok" />
                <h2 className="mt-3 h-display text-2xl">You're all set, {s.ui.userName}!</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">Next, a quick tour will show you around. You can replay it any time from the <b>?</b> button at the top.</p>
              </div>
            )}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            {step < STEPS.length - 1 ? <button className="btn-primary" onClick={() => setStep(step + 1)}>{step === 0 ? "Let's go" : 'Continue'}</button> : <button className="btn-primary" onClick={finish}>Enter Command Center</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
