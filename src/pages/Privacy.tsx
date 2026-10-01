// Privacy policy for the Omni TotalStack MSP platform and Android app (required by Google Play).
import { Link } from 'react-router-dom'
import { OmniMark } from '../components/Logo'

const CONTACT = 'omnitotalstack@gmail.com'
const UPDATED = 'September 30, 2026'

const S = ({ t, children }: { t: string; children: React.ReactNode }) => <section className="mt-6"><h2 className="text-lg font-semibold">{t}</h2><div className="mt-2 space-y-2 text-sm text-muted">{children}</div></section>

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link to="/" className="flex items-center gap-2 text-sm text-muted hover:text-accent"><OmniMark size={28} /> Omni TotalStack MSP</Link>
      <h1 className="mt-6 h-display text-3xl">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted">Last updated {UPDATED}. Applies to the Omni TotalStack MSP website, web app and mobile apps (“Omni”).</p>
      <S t="Who we are">
        <p>Omni is a software platform that managed service providers (“MSPs”) use to run their business. Questions about this policy: <a className="text-accent" href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
        <p>Each MSP controls the information about its own clients that it puts into Omni. If you are a client of an MSP, that MSP is responsible for your information; Omni processes it on the MSP’s behalf.</p>
      </S>
      <S t="Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Account information</b> — name, email address, company name and password (stored only as a secure hash by our authentication provider).</li>
          <li><b>Workspace information</b> — what MSPs and their staff enter or sync: clients, contacts, sites, devices, tickets, documents, proposals, invoices and similar business records.</li>
          <li><b>Integration keys</b> — API keys an MSP connects (for example RMM or Microsoft 365). These are encrypted and used only to run that MSP’s own features.</li>
          <li><b>Payments</b> — subscriptions and client invoice payments are processed by Stripe. We never receive or store full card or bank account numbers.</li>
          <li><b>Technical information</b> — basic logs (date, time, IP address, browser/app version) used for security and troubleshooting.</li>
        </ul>
        <p>The mobile app does not access your contacts, photos, location, microphone or camera.</p>
      </S>
      <S t="How we use information">
        <p>To provide and secure the service, process payments, send service emails (such as invitations, receipts and payment notices), provide support, and improve Omni. We do not sell personal information and do not use it for advertising.</p>
      </S>
      <S t="Who we share it with">
        <p>Only with service providers that run Omni for us, under contracts that protect it: hosting (Vercel), database and sign-in (Supabase), payments (Stripe), email delivery, and — only when an MSP uses AI features — Anthropic (Claude). Integrations an MSP connects receive the data needed to carry out that MSP’s requests. We may disclose information if required by law.</p>
      </S>
      <S t="Security">
        <p>Data is encrypted in transit (HTTPS) and integration keys are encrypted at rest. Each MSP’s data is separated by database-level access rules, and client users can see only their own company’s records.</p>
      </S>
      <S t="Keeping and deleting data">
        <p>We keep workspace data while the account is active. MSP owners can download all of their data at any time from Plan &amp; Billing. To delete an account or ask for a copy or correction of your information, email <a className="text-accent" href={`mailto:${CONTACT}`}>{CONTACT}</a>; we respond within 30 days. Clients of an MSP should contact that MSP first.</p>
      </S>
      <S t="Children">
        <p>Omni is a business tool and is not directed to children under 13. We do not knowingly collect their information.</p>
      </S>
      <S t="Changes">
        <p>If we change this policy we will update the date above and, for significant changes, notify account owners by email.</p>
      </S>
    </div>
  )
}
