// Guided client-needs intake. Plain-English questions → three formal solutions.
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Sparkles, ShieldCheck, Wifi, Building, Target } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Intake, Proposal } from '../lib/types'
import { Card, Field, PageHeader, cx } from '../components/ui'
import { analyze, generateOptions, executiveSummary } from '../lib/proposalEngine'
import { uid, iso } from '../lib/format'

const COMPLIANCE = ['HIPAA', 'PCI-DSS', 'FTC Safeguards', 'CMMC', 'SOC 2', 'Cyber insurance requirements']
const PAINS = ['Slow computers', 'Unreliable Wi-Fi', 'Internet outages', 'Email / spam problems', 'Printer headaches', 'No one to call for IT', 'Too many passwords', 'Manual / paper processes', 'Remote work access', 'Old hardware', 'Unclear IT spending']

function Choice<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string; d?: string }[]; onChange: (v: T) => void }) {
  return <div className="grid gap-2 sm:grid-cols-3">{options.map((o) => <button type="button" key={o.v} onClick={() => onChange(o.v)} className={cx('rounded-xl border p-3 text-left text-sm', value === o.v ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/50')}><div className="font-medium">{o.l}</div>{o.d && <div className="text-xs text-muted">{o.d}</div>}</button>)}</div>
}
const Multi = ({ value, options, onChange }: { value: string[]; options: string[]; onChange: (v: string[]) => void }) => (
  <div className="flex flex-wrap gap-2">{options.map((o) => { const on = value.includes(o); return <button type="button" key={o} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} className={cx('chip border px-3 py-1.5', on ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted')}>{o}</button> })}</div>
)

export default function ProposalWizard() {
  const s = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const [i, setI] = useState<Intake>({
    clientId: params.get('client') || s.clients[0]?.id || '', industry: '', users: 10, devices: 10, servers: 0, sites: 1, printers: 1, compliance: [],
    emailPlatform: 'Microsoft 365', hasFirewall: 'consumer', wifiQuality: 'spotty', internetRedundancy: false, backupStatus: 'untested', mfaEnabled: 'some', securityTraining: false,
    pastIncidents: '', painPoints: [], goals: '', budgetMonthly: 1500, timeline: '30 days', notes: '',
  })
  const up = (p: Partial<Intake>) => setI({ ...i, ...p })
  const client = s.clients.find((c) => c.id === i.clientId)

  const steps = [
    { t: 'Client & size', icon: Building },
    { t: 'Cybersecurity', icon: ShieldCheck },
    { t: 'Network', icon: Wifi },
    { t: 'Goals & budget', icon: Target },
  ]

  const generate = () => {
    if (!client) return
    const n = s.proposals.length + 1
    const p: Proposal = {
      id: uid('pr'), number: `PRO-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`, clientId: client.id, createdAt: iso(), status: 'draft', intake: { ...i, industry: i.industry || client.group },
      executiveSummary: executiveSummary(i, client.name, s.company), findings: analyze(i), options: generateOptions(i),
    }
    s.add('proposals', p)
    s.log(`Generated proposal ${p.number} for ${client.name}`)
    nav(`/app/proposals/${p.id}`)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New proposal" subtitle="Answer in plain English — we'll handle the technical design." />
      <div className="mb-5 grid grid-cols-4 gap-2">
        {steps.map((x, k) => <button key={x.t} onClick={() => setStep(k)} className={cx('flex items-center gap-2 rounded-xl border p-2.5 text-xs sm:text-sm', k === step ? 'border-accent bg-accent/10 text-accent' : k < step ? 'border-line text-ink' : 'border-line text-muted')}><x.icon size={15} /><span className="hidden sm:inline">{x.t}</span></button>)}
      </div>
      <Card>
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client" className="sm:col-span-2"><select className="input" value={i.clientId} onChange={(e) => up({ clientId: e.target.value })}>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}</select></Field>
            <Field label="Industry"><input className="input" placeholder={client?.group} value={i.industry} onChange={(e) => up({ industry: e.target.value })} /></Field>
            <Field label="Email platform"><select className="input" value={i.emailPlatform} onChange={(e) => up({ emailPlatform: e.target.value as Intake['emailPlatform'] })}>{['Microsoft 365', 'Google Workspace', 'On-prem Exchange', 'Other / None'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="How many people use a computer?"><input type="number" min={1} className="input" value={i.users} onChange={(e) => up({ users: +e.target.value })} /></Field>
            <Field label="Computers & laptops"><input type="number" min={0} className="input" value={i.devices} onChange={(e) => up({ devices: +e.target.value })} /></Field>
            <Field label="Servers" hint="Physical or virtual servers in the office"><input type="number" min={0} className="input" value={i.servers} onChange={(e) => up({ servers: +e.target.value })} /></Field>
            <Field label="Locations / sites"><input type="number" min={1} className="input" value={i.sites} onChange={(e) => up({ sites: +e.target.value })} /></Field>
            <Field label="Printers / copiers"><input type="number" min={0} className="input" value={i.printers} onChange={(e) => up({ printers: +e.target.value })} /></Field>
            <Field label="Regulations they must follow" className="sm:col-span-2"><Multi value={i.compliance} options={COMPLIANCE} onChange={(v) => up({ compliance: v })} /></Field>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-5">
            <Field label="Is multi-factor authentication (MFA) turned on?"><Choice value={i.mfaEnabled} onChange={(v) => up({ mfaEnabled: v })} options={[{ v: 'all', l: 'Yes, for everyone' }, { v: 'some', l: 'Some people' }, { v: 'none', l: 'No / not sure' }]} /></Field>
            <Field label="Backups"><Choice value={i.backupStatus} onChange={(v) => up({ backupStatus: v })} options={[{ v: 'tested', l: 'Backed up & tested', d: 'Restores tested recently' }, { v: 'untested', l: 'Backed up, never tested' }, { v: 'none', l: 'No backups / not sure' }]} /></Field>
            <Field label="Do staff get security-awareness training?"><Choice value={i.securityTraining ? 'yes' : 'no'} onChange={(v) => up({ securityTraining: v === 'yes' })} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]} /></Field>
            <Field label="Any past security incidents? (phishing, ransomware, hacked email…)"><textarea className="input" rows={2} value={i.pastIncidents} onChange={(e) => up({ pastIncidents: e.target.value })} placeholder="Leave blank if none" /></Field>
            <div className="rounded-xl border border-accent2/40 bg-accent2/10 p-3 text-sm"><ShieldCheck className="mr-1.5 inline text-accent2" size={16} /> <b>Huntress 24/7 managed security is required</b> and will be included in all three options, managed under your business Huntress account.</div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <Field label="What firewall/router do they have?"><Choice value={i.hasFirewall} onChange={(v) => up({ hasFirewall: v })} options={[{ v: 'business', l: 'Business-grade', d: 'UniFi, Fortinet, SonicWall, Meraki…' }, { v: 'consumer', l: 'Consumer / ISP router' }, { v: 'none', l: 'None / not sure' }]} /></Field>
            <Field label="How is the Wi-Fi?"><Choice value={i.wifiQuality} onChange={(v) => up({ wifiQuality: v })} options={[{ v: 'good', l: 'Great everywhere' }, { v: 'spotty', l: 'Spotty in places' }, { v: 'poor', l: 'Frequently drops' }]} /></Field>
            <Field label="Do they have a backup internet connection?"><Choice value={i.internetRedundancy ? 'yes' : 'no'} onChange={(v) => up({ internetRedundancy: v === 'yes' })} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No — one ISP' }]} /></Field>
            <Field label="Day-to-day pain points"><Multi value={i.painPoints} options={PAINS} onChange={(v) => up({ painPoints: v })} /></Field>
          </div>
        )}
        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business goals for technology" className="sm:col-span-2"><textarea className="input" rows={3} value={i.goals} onChange={(e) => up({ goals: e.target.value })} placeholder="e.g. open a second location, pass HIPAA audit, stop downtime" /></Field>
            <Field label="Monthly budget they mentioned ($)"><input type="number" className="input" value={i.budgetMonthly} onChange={(e) => up({ budgetMonthly: +e.target.value })} /></Field>
            <Field label="Timeline"><select className="input" value={i.timeline} onChange={(e) => up({ timeline: e.target.value as Intake['timeline'] })}>{['ASAP', '30 days', '90 days', 'Planning'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Other notes" className="sm:col-span-2"><textarea className="input" rows={2} value={i.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
          </div>
        )}
        <div className="mt-6 flex justify-between">
          <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Back</button>
          {step < 3 ? <button className="btn-primary" onClick={() => setStep(step + 1)}>Next <ArrowRight size={15} /></button> : <button className="btn-primary" disabled={!client} onClick={generate}><Sparkles size={15} /> Generate 3 solutions</button>}
        </div>
      </Card>
    </div>
  )
}
