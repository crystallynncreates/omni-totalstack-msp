import { useStore } from '../lib/store'

export default function Logo({ size = 32 }: { size?: number }) {
  const logo = useStore((s) => s.company.logoDataUrl)
  if (logo) return <img src={logo} alt="" style={{ width: size, height: size }} className="rounded-lg object-contain" />
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs><linearGradient id="og" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="rgb(var(--accent))" /><stop offset="1" stopColor="rgb(var(--accent2))" /></linearGradient></defs>
      <rect width="64" height="64" rx="16" fill="rgb(var(--panel))" stroke="rgb(var(--line))" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="url(#og)" strokeWidth="6" />
      <path d="M24 32h16M32 24v16" stroke="url(#og)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
