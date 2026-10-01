// Customer Guides — platform owner only.
//   1. User & Business Guide for MSPs who subscribe to / buy Omni TotalStack MSP
//   2. Client Guide for the owner's own MSP clients (tickets, invoices, paying)
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BookOpenCheck, Download, Copy, Printer, Users, Building2, Lock } from 'lucide-react'
import { useStore } from '../lib/store'
import { Card, Field, PageHeader, Tabs, toast } from '../components/ui'
import { mspGuide, clientGuide, guideText, type Guide } from '../lib/guides'
import { guidePdf } from '../lib/pdf'

const OMNI_SUPPORT = 'omnitotalstack@gmail.com'

export default function Guides() {
  const s = useStore()
  const session = s.session
  const [tab, setTab] = useState<'msp' | 'client'>('msp')
  const c = s.company
  const [hours, setHours] = useState(() => { try { return localStorage.getItem('omni.guide.hours') || 'Monday–Friday, 8 am–6 pm' } catch { return 'Monday–Friday, 8 am–6 pm' } })
  const [emergency, setEmergency] = useState(() => { try { return localStorage.getItem('omni.guide.emergency') || (c.phone ? `call ${c.phone} and choose the emergency option` : '') } catch { return '' } })
  const keep = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const portalUrl = session?.customDomain ? `https://${session.customDomain}/portal` : `${origin}/m/${session?.slug || 'demo'}/portal`
  const guide: Guide = useMemo(() => tab === 'msp'
    ? mspGuide({ supportEmail: OMNI_SUPPORT, site: origin })
    : clientGuide({ name: c.name, phone: c.phone, email: c.email, address: [c.address, c.city, c.state, c.zip].filter(Boolean).join(', '), portalUrl, hours, emergency, paymentTerms: c.paymentTermsDays ? `net ${c.paymentTermsDays} days from the invoice date` : undefined }),
  [tab, c, portalUrl, hours, emergency, origin])

  if (!session) return <Navigate to="/app" replace />
  if (!session.platformOwner) return (
    <div className="glass mx-auto mt-10 max-w-md p-8 text-center"><Lock className="mx-auto text-muted" /><h2 className="mt-3 h-display text-xl">Owner only</h2><p className="mt-2 text-sm text-muted">Customer Guides are available in the Omni owner account.</p></div>
  )

  const pdf = () => {
    const brand = tab === 'msp'
      ? { name: 'Omni TotalStack MSP', line: `Questions? ${OMNI_SUPPORT} · ${origin}`, footer: `Omni TotalStack MSP · ${OMNI_SUPPORT}` }
      : { name: c.name, line: [c.phone, c.email, portalUrl].filter(Boolean).join(' · '), logoDataUrl: c.logoDataUrl, footer: `${c.legalName || c.name} · ${c.website || portalUrl}` }
    guidePdf(guide, brand).save(tab === 'msp' ? 'Omni-TotalStack-MSP-User-and-Business-Guide.pdf' : `${c.name.replace(/[^A-Za-z0-9]+/g, '-')}-Client-Guide.pdf`)
    toast('PDF downloaded')
  }
  const copy = async () => { try { await navigator.clipboard.writeText(guideText(guide)); toast('Copied — paste it into an email') } catch { toast('Copy failed — use Download PDF instead', 'warn') } }

  return (
    <div>
      <PageHeader title="Customer Guides" subtitle="Owner only · guides to send to your customers"
        help="Two ready-to-send guides. The User & Business Guide is for MSPs who subscribe to or buy Omni and explains every feature. The Client Guide is for your own MSP clients and shows them how to submit a support ticket, find invoices and pay. Download a PDF, print it, or copy the text into an email. Only your owner account can see this page." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'msp', label: 'Omni subscribers: User & Business Guide', icon: <Building2 size={14} /> }, { id: 'client', label: 'My MSP clients: Client Guide', icon: <Users size={14} /> }]} />
        <div className="flex gap-2">
          <button className="btn-primary" onClick={pdf}><Download size={15} /> Download PDF</button>
          <button className="btn-ghost" onClick={copy}><Copy size={15} /> Copy text</button>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print</button>
        </div>
      </div>
      {tab === 'client' && (
        <Card title="Your details in this guide" className="mb-4" help="Name, phone, email, address, logo and payment terms come from Admin & Branding. Add your support hours and emergency instructions here.">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Support hours"><input className="input" value={hours} onChange={(e) => { setHours(e.target.value); keep('omni.guide.hours', e.target.value) }} /></Field>
            <Field label="After-hours emergencies"><input className="input" value={emergency} placeholder="call (555) 555-0100 and press 1" onChange={(e) => { setEmergency(e.target.value); keep('omni.guide.emergency', e.target.value) }} /></Field>
          </div>
          <p className="mt-2 text-xs text-muted">Client portal address in the guide: <span className="font-mono">{portalUrl}</span></p>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Contents" className="lg:sticky lg:top-20 lg:self-start">
          <ol className="space-y-1 text-sm">{guide.sections.map((x) => <li key={x.id}><a href={`#g-${x.id}`} className="text-muted hover:text-accent">{x.title}</a></li>)}</ol>
        </Card>
        <article className="glass p-6 lg:col-span-3" data-testid="guide">
          <div className="flex items-start gap-3"><BookOpenCheck className="mt-1 shrink-0 text-accent" /><div><h2 className="h-display text-2xl">{guide.title}</h2><p className="text-muted">{guide.subtitle}</p><p className="mt-1 text-xs text-muted">{guide.audience}</p></div></div>
          {guide.sections.map((x) => (
            <section key={x.id} id={`g-${x.id}`} className="mt-6 scroll-mt-24">
              <h3 className="text-lg font-semibold text-accent">{x.title}</h3>
              {x.intro && <p className="mt-1 text-sm">{x.intro}</p>}
              {x.steps && <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">{x.steps.map((t) => <li key={t}>{t}</li>)}</ol>}
              {x.bullets && <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">{x.bullets.map((t) => <li key={t}>{t}</li>)}</ul>}
              {x.tip && <p className="mt-2 rounded-lg bg-accent/10 p-2.5 text-sm"><b>Tip:</b> {x.tip}</p>}
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}
