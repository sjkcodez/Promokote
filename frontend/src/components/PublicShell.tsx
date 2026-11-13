import { ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { Logo } from './Brand'
import { LanguageSwitcher, ThemeToggle } from './Prefs'

/** Header + footer for public pages (landing, pricing). */
export default function PublicShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const links = [
    { href: '/#services', label: t('land.nav.services') },
    { href: '/#how', label: t('land.nav.how') },
    { href: '/#start', label: t('land.nav.start') },
    { href: '/pricing', label: t('land.nav.pricing') },
    { href: '/#faq', label: t('land.nav.faq') },
  ]
  const auth = user ? (
    <Link to="/" className="btn-primary !py-2">{t('land.nav.console')}</Link>
  ) : (
    <>
      <Link to="/login" className="btn-ghost !px-3 !py-2">{t('auth.signIn')}</Link>
      <Link to="/register" className="btn-primary !py-2">{t('auth.createAccount')}</Link>
    </>
  )
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Promokote"><Logo size="sm" /></Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted lg:flex" aria-label={t('nav.main')}>
            {links.map((l) => <a key={l.href} href={l.href} className="hover:text-fg">{l.label}</a>)}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:block"><LanguageSwitcher /></div>
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">{auth}</div>
            <button className="icon-btn lg:hidden" onClick={() => setOpen(!open)} aria-label={t('nav.menu')} aria-expanded={open}>{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
          </div>
        </div>
        {open && (
          <div className="border-t border-line bg-surface px-4 py-4 lg:hidden">
            <nav className="grid gap-1" aria-label={t('nav.main')}>
              {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-subtle">{l.label}</a>)}
            </nav>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
              <LanguageSwitcher />
              <div className="flex items-center gap-2">{auth}</div>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo size="sm" />
            <p className="mt-3 text-sm text-muted">{t('land.footer.tagline')}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div className="space-y-2">
              <p className="font-semibold">{t('land.footer.product')}</p>
              <a href="/#services" className="block text-muted hover:text-fg">{t('land.nav.services')}</a>
              <Link to="/pricing" className="block text-muted hover:text-fg">{t('land.nav.pricing')}</Link>
              <a href="/#faq" className="block text-muted hover:text-fg">{t('land.nav.faq')}</a>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">{t('land.footer.account')}</p>
              <Link to="/register" className="block text-muted hover:text-fg">{t('auth.createAccount')}</Link>
              <Link to="/login" className="block text-muted hover:text-fg">{t('auth.signIn')}</Link>
            </div>
          </div>
        </div>
        <p className="border-t border-line py-4 text-center text-xs text-muted">&copy; {new Date().getFullYear()} Promokote</p>
      </footer>
    </div>
  )
}
