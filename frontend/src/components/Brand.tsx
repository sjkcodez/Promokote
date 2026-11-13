import { Megaphone } from 'lucide-react'

/** Promokote logo: outline megaphone (lucide, same wireframe style as the rest of the icon set) on an amber tile. */
export function Logo({ onDark = false, size = 'md' }: { onDark?: boolean; size?: 'md' | 'sm' }) {
  const tile = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'
  return (
    <div className="flex items-center gap-2">
      <div className={`flex ${tile} items-center justify-center bg-brand-500 text-on-brand`}><Megaphone className="h-5 w-5" strokeWidth={2.25} aria-hidden /></div>
      <span className={`text-xl font-extrabold tracking-tight ${onDark ? 'text-white' : 'text-fg'}`}>Promo<span className={onDark ? 'text-brand-400' : 'text-accent'}>kote</span></span>
    </div>
  )
}
