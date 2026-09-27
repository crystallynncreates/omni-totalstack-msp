// Each MSP's own public website + client portal, branded with THEIR name, logo and colors.
// Reached at /m/<slug>, at <slug>.<platform domain>, or at the MSP's own custom domain.
// If the MSP stops paying, these pages go offline until the account is reactivated.
import { useEffect, useState } from 'react'
import { Routes, Route, useParams } from 'react-router-dom'
import { Moon } from 'lucide-react'
import { api } from '../lib/api'
import { cloudEnabled } from '../lib/cloud'
import { BrandProvider, type Brand } from '../lib/brand'
import { useStore } from '../lib/store'
import { defaultCompany } from '../lib/seed'
import type { Company } from '../lib/types'
import Landing from './Landing'
import Portal from './Portal'

interface PublicTenant { slug: string; live: boolean; settings: Partial<Company> }

export function useTenant(slug?: string, host?: string, root = false) {
  const atRoot = !!host || root
  const localCompany = useStore((s) => s.company)
  const [state, setState] = useState<{ loading: boolean; brand?: Brand; offline?: boolean; missing?: boolean }>({ loading: true })
  useEffect(() => {
    const isDemo = !cloudEnabled || slug === 'demo'
    if (isDemo) { setState({ loading: false, brand: { company: localCompany, slug: 'demo', base: atRoot ? '' : '/m/demo', demo: true } }); return }
    let cancelled = false
    api<PublicTenant>(`tenant/public?${slug ? `slug=${encodeURIComponent(slug)}` : `host=${encodeURIComponent(host!)}`}`).then((r) => {
      if (cancelled) return
      if (!r.ok || !r.data) return setState({ loading: false, missing: true })
      if (!r.data.live) return setState({ loading: false, offline: true, brand: { company: { ...defaultCompany, ...r.data.settings }, slug: r.data.slug, base: atRoot ? '' : `/m/${r.data.slug}`, demo: false } })
      setState({ loading: false, brand: { company: { ...defaultCompany, ...r.data.settings } as Company, slug: r.data.slug, base: atRoot ? '' : `/m/${r.data.slug}`, demo: false } })
    })
    return () => { cancelled = true }
  }, [slug, host, atRoot, localCompany])
  return state
}

export function TenantShell({ slug, host, root }: { slug?: string; host?: string; root?: boolean }) {
  const t = useTenant(slug, host, root)
  useEffect(() => { if (t.brand) { document.title = t.brand.company.name; document.documentElement.dataset.accent = t.brand.company.accent } }, [t.brand])
  if (t.loading) return <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>
  if (t.missing) return <Offline title="Page not found" text="We couldn't find this company's page. Check the address and try again." />
  if (t.offline) return <Offline title={`${t.brand!.company.name} is temporarily unavailable`} text="This site and client portal are paused. If you're a client, please contact your IT provider directly." />
  return (
    <BrandProvider value={t.brand!}>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="portal/:clientId?" element={<Portal />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrandProvider>
  )
}

export default function TenantSite({ host, standaloneSlug }: { host?: string; standaloneSlug?: string }) {
  const { slug } = useParams()
  if (standaloneSlug) return <TenantShell slug={standaloneSlug} root />
  return host ? <TenantShell host={host} /> : <TenantShell slug={slug} />
}

function Offline({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="glass max-w-md p-8 text-center">
        <Moon className="mx-auto text-muted" size={36} />
        <h1 className="mt-3 h-display text-xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">{text}</p>
      </div>
    </div>
  )
}
