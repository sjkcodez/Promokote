import { ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronsUpDown, CreditCard, KeyRound, LayoutDashboard, LogOut, Mail, Megaphone, Menu, MessageSquare, Send, ShieldCheck, Ban, Users, UserCog, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { gql } from '../lib/api'
import { Alert } from './ui'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white"><Mail className="h-5 w-5" /></div>
      <span className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>Promo<span className="text-brand-500">kote</span></span>
    </div>
  )
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/send', label: 'Quick send', icon: Send },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/messages', label: 'Message log', icon: MessageSquare },
  { to: '/opt-outs', label: 'Opt-outs', icon: Ban },
  { to: '/api-keys', label: 'API keys', icon: KeyRound },
  { to: '/docs', label: 'API docs', icon: BookOpen },
  { to: '/plans', label: 'Plan & billing', icon: CreditCard },
  { to: '/team', label: 'Team', icon: UserCog },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const nav = useNavigate()
  const items = user?.isStaff ? [...NAV, { to: '/admin', label: 'Platform admin', icon: ShieldCheck }] : NAV

  const links = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
          <Icon className="h-5 w-5" />{label}
        </NavLink>
      ))}
    </nav>
  )
  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="flex h-16 items-center px-5"><Logo light /></div>
      <div className="mx-3 mb-1 flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-slate-200">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.organization?.name}</p><p className="text-xs capitalize text-slate-400">{user?.organization?.role}</p></div>
        <ChevronsUpDown className="h-4 w-4 text-slate-500" />
      </div>
      {links}
      <div className="border-t border-slate-800 p-3">
        <p className="truncate px-3 pb-2 text-xs text-slate-400">{user?.email}</p>
        <button onClick={() => { signOut(); nav('/login') }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white">
          <LogOut className="h-5 w-5" />Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Logo />
        <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Menu">{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        {user && !user.emailVerified && !sent && (
          <div className="mb-5">
            <Alert kind="info">
              Please verify your email address. We sent a link to <b>{user.email}</b>.{' '}
              <button className="font-semibold underline" onClick={() => { void gql('mutation{resendVerification{ok}}'); setSent(true) }}>Resend</button>
            </Alert>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
