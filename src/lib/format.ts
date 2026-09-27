export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3)

export const money = (n: number, cents = false) =>
  (n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 })

export const DAY = 86_400_000
export const now = () => new Date()
export const iso = (d: Date = new Date()) => d.toISOString()
export const isoDate = (d: Date = new Date()) => d.toISOString().slice(0, 10)
export const addDays = (d: Date | string, n: number) => new Date(new Date(d).getTime() + n * DAY)
export const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / DAY)
export const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / DAY)

export const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
export const fmtDateTime = (d?: string) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
export const timeAgo = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + (f(x) || 0), 0)

/** Contract / subscription expiry state. "expired" and "soon" (<= 30 days) render red. */
export const expiryState = (end: string): 'expired' | 'soon' | 'upcoming' | 'ok' => {
  const d = daysUntil(end)
  if (d < 0) return 'expired'
  if (d <= 30) return 'soon'
  if (d <= 90) return 'upcoming'
  return 'ok'
}

export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export const download = (filename: string, content: string, type = 'application/json') => {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
