import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { CircleHelp, X, Info } from 'lucide-react'
import { daysUntil, expiryState, fmtDate } from '../lib/format'

export const cx = clsx

export function Card({ children, className, title, action, icon, help }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; icon?: ReactNode; help?: string }) {
  return (
    <section className={cx('glass p-4 animate-fadeUp', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {icon && <span className="text-accent">{icon}</span>}
            {title}
            {help && <HelpTip text={help} />}
          </h3>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="Help" onClick={() => setOpen((o) => !o)} className="text-muted hover:text-accent"><CircleHelp size={14} /></button>
      {open && <span className="absolute left-5 top-0 z-50 w-64 rounded-xl border border-line bg-panel p-3 text-xs font-normal leading-relaxed text-ink shadow-soft">{text}</span>}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions, help }: { title: string; subtitle?: string; actions?: ReactNode; help?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h-display text-2xl md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
      {help && (
        <div className="flex w-full items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs text-muted">
          <Info size={14} className="mt-0.5 shrink-0 text-accent" /> <span>{help}</span>
        </div>
      )}
    </div>
  )
}

const tones = {
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  info: 'bg-accent/15 text-accent',
  muted: 'bg-ink/5 text-muted',
  violet: 'bg-accent2/15 text-accent2',
}
export type Tone = keyof typeof tones
export const Badge = ({ tone = 'muted', children, className }: { tone?: Tone; children: ReactNode; className?: string }) => <span className={cx('chip', tones[tone], className)}>{children}</span>

export function StatusDot({ status }: { status: 'online' | 'degraded' | 'down' | 'offline' | 'warning' }) {
  const c = status === 'online' ? 'bg-ok' : status === 'down' || status === 'offline' ? 'bg-bad animate-pulseRing' : 'bg-warn'
  return <span className={cx('inline-block h-2.5 w-2.5 rounded-full', c)} />
}

/** Expiration date — shown in RED when expired or within 30 days. */
export function Expiry({ date, compact }: { date: string; compact?: boolean }) {
  const st = expiryState(date)
  const n = daysUntil(date)
  const red = st === 'expired' || st === 'soon'
  return (
    <span className={cx('inline-flex items-center gap-1.5 font-medium', red ? 'text-bad' : st === 'upcoming' ? 'text-warn' : 'text-ink')}>
      {fmtDate(date)}
      {!compact && <span className={cx('chip', red ? 'bg-bad/15 text-bad' : st === 'upcoming' ? 'bg-warn/15 text-warn' : 'bg-ink/5 text-muted')}>{n < 0 ? `expired ${-n}d ago` : `${n}d left`}</span>}
    </span>
  )
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <div className="glass p-4 animate-fadeUp">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">{label}{icon && <span className="text-accent">{icon}</span>}</div>
      <div className={cx('mt-2 h-display text-2xl', tone === 'bad' && 'text-bad', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn')}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cx('glass my-8 w-full bg-panel p-0 animate-fadeUp', wide ? 'max-w-4xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="h-display text-lg">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-ink/5" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel/60 p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cx('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition', value === t.id ? 'bg-accent/15 font-medium text-accent' : 'text-muted hover:text-ink')}>
          {t.icon}{t.label}{t.count !== undefined && <span className="rounded-full bg-ink/10 px-1.5 text-[10px]">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon && <div className="rounded-2xl bg-accent/10 p-3 text-accent">{icon}</div>}
      <div className="font-medium">{title}</div>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  )
}

export function Ring({ value, size = 64, label, tone = 'accent' }: { value: number; size?: number; label?: string; tone?: 'accent' | 'ok' | 'warn' | 'bad' }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={6} className="fill-none stroke-line" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={6} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100} className={cx('fill-none transition-all duration-700', `stroke-${tone}`)} style={{ stroke: `rgb(var(--${tone}))` }} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="rotate-90 fill-ink text-[13px] font-semibold" style={{ transformOrigin: 'center' }}>{Math.round(value)}%</text>
      </svg>
      {label && <span className="max-w-[90px] truncate text-center text-xs text-muted">{label}</span>}
    </div>
  )
}

export function Bar({ value, tone }: { value: number; tone?: Tone }) {
  const t = tone ?? (value > 85 ? 'bad' : value > 70 ? 'warn' : 'ok')
  return <div className="h-1.5 w-full rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: `rgb(var(--${t === 'info' ? 'accent' : t}))` }} /></div>
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm">
      <span className={cx('relative h-5 w-9 rounded-full transition', checked ? 'bg-accent' : 'bg-line')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  )
}

// Tiny toast system
type ToastT = { id: number; text: string; tone: Tone }
let push: (t: Omit<ToastT, 'id'>) => void = () => {}
export const toast = (text: string, tone: Tone = 'ok') => push({ text, tone })
export function Toaster() {
  const [items, setItems] = useState<ToastT[]>([])
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random()
      setItems((x) => [...x, { ...t, id }])
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800)
    }
  }, [])
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={cx('glass bg-panel px-4 py-3 text-sm animate-fadeUp border-l-4', t.tone === 'bad' ? 'border-l-bad' : t.tone === 'warn' ? 'border-l-warn' : 'border-l-ok')}>{t.text}</div>
      ))}
    </div>
  )
}
