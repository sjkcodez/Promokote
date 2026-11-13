import { ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BadgeCheck, BookOpen, CreditCard, KeyRound, LayoutDashboard, LogOut, Menu, MessageSquare, Radio, Send, ShieldCheck, Ban, Users, UserCog, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { gql } from '../lib/api'
import { TKey, useI18n } from '../lib/i18n'
import { Alert } from './ui'
import { Logo } from './Brand'
import { LanguageSwitcher, ThemeToggle } from './Prefs'

export { Logo }

const NAV: { to: string; label: TKey; icon: typeof Send }[] = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/send', label: 'nav.send', icon: Send },
  { to: '/campaigns', label: 'nav.campaigns', icon: Radio },
  { to: '/contacts', label: 'nav.contacts', icon: Users },
  { to: '/messages', label: 'nav.messages', icon: MessageSquare },
  { to: '/opt-outs', label: 'nav.optOuts', icon: Ban },
  { to: '/sms-activation', label: 'nav.activation', icon: BadgeCheck },
  { to: '/plans', label: 'nav.plans', icon: CreditCard },
  { to: '/api-keys', label: 'nav.apiKeys', icon: KeyRound },
  { to: '/docs', label: 'nav.docs', icon: BookOpen },
  { to: '/team', label: 'nav.team', icon: UserCog },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const nav = useNavigate()
  const items = user?.isStaff ? [...NAV, { to: '/admin', label: 'nav.admin' as TKey, icon: ShieldCheck }] : NAV
  const org = user?.organization

  const links = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3" aria-label={t('nav.main')}>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-500 text-on-brand' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
          <Icon className="h-5 w-5 shrink-0" />
          <span className="flex-1 truncate">{t(label)}</span>
          {to === '/sms-activation' && org && !org.smsActivated && <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-400">{t('status.demo')}</span>}
        </NavLink>
      ))}
    </nav>
  )
  const sidebar = (
    <div className="flex h-full flex-col border-r border-white/5 bg-ink">
      <div className="flex h-16 items-center px-5"><Logo onDark /></div>
      <div className="mx-3 mb-1 rounded-lg bg-white/5 px-3 py-2 text-zinc-200">
        <p className="truncate text-sm font-semibold">{org?.name}</p>
        <p className="text-xs text-zinc-400">{org ? t(`role.${org.role}` as TKey) : ''}</p>
      </div>
      {links}
      <div className="space-y-2 border-t border-white/10 p-3">
        <div className="flex items-center justify-between px-1"><LanguageSwitcher onDark /><ThemeToggle onDark /></div>
        <p className="truncate px-2 text-xs text-zinc-500">{user?.email}</p>
        <button onClick={() => { signOut(); nav('/') }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white">
          <LogOut className="h-5 w-5" />{t('nav.signOut')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={() => setOpen(!open)} className="icon-btn" aria-label={t('nav.menu')} aria-expanded={open}>{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        {user && !user.emailVerified && !sent && (
          <div className="mb-5">
            <Alert kind="info">
              {t('layout.verifyEmail', { email: user.email })}{' '}
              <button className="font-semibold underline" onClick={() => { void gql('mutation{resendVerification{ok}}'); setSent(true) }}>{t('layout.resend')}</button>
            </Alert>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
