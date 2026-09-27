// Brand context: whose name, logo and colors a public page shows.
// Inside an MSP's public site (/m/:slug or their own domain) it's that MSP; inside the app it's the signed-in workspace.
import { createContext, useContext, type ReactNode } from 'react'
import { useStore } from './store'
import type { Company } from './types'

export interface Brand {
  company: Company
  slug: string
  base: string // URL prefix for this MSP's public pages: '/m/acme' or '' on their own domain
  demo: boolean // true = sample workspace in this browser (no server)
}
const BrandCtx = createContext<Brand | null>(null)
export const BrandProvider = ({ value, children }: { value: Brand; children: ReactNode }) => <BrandCtx.Provider value={value}>{children}</BrandCtx.Provider>

export function useBrand(): Brand {
  const ctx = useContext(BrandCtx)
  const company = useStore((s) => s.company)
  const session = useStore((s) => s.session)
  return ctx ?? { company, slug: session?.slug ?? 'demo', base: `/m/${session?.slug ?? 'demo'}`, demo: !session }
}
