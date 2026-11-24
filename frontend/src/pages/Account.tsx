import { FormEvent, ReactNode, useState } from 'react'
import { KeyRound, LogOut, Mail, UserRound } from 'lucide-react'
import { gql } from '../lib/api'
import { USER_FIELDS, useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { LanguageSwitcher, ThemeToggle } from '../components/Prefs'
import { Alert, Badge, Field, PageHeader } from '../components/ui'

type Msg = { kind: 'success' | 'error'; text: string } | null

function Section({ icon: Icon, title, text, children }: { icon: typeof Mail; title: string; text: string; children: ReactNode }) {
  return (
    <section className="card grid gap-5 md:grid-cols-[240px_1fr]">
      <div>
        <p className="flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-accent" />{title}</p>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

export default function Account() {
  const { t } = useI18n()
  const { user, signIn, refresh } = useAuth()
  const [profile, setProfile] = useState({ fullName: user?.fullName ?? '', phone: user?.phone ?? '' })
  const [email, setEmail] = useState({ newEmail: '', password: '' })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [msg, setMsg] = useState<Record<string, Msg>>({})
  const [busy, setBusy] = useState('')
  const say = (k: string, m: Msg) => setMsg((s) => ({ ...s, [k]: m }))

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key); say(key, null)
    try { await fn() } catch (x) { say(key, { kind: 'error', text: (x as Error).message }) } finally { setBusy('') }
  }
  const saveProfile = (e: FormEvent) => { e.preventDefault(); void run('profile', async () => {
    const d = await gql(`mutation($n:String!,$p:String){updateProfile(fullName:$n,phone:$p){user{fullName phone}}}`, { n: profile.fullName, p: profile.phone })
    setProfile({ fullName: d.updateProfile.user.fullName, phone: d.updateProfile.user.phone ?? '' }); await refresh(); say('profile', { kind: 'success', text: t('account.saved') })
  }) }
  const saveEmail = (e: FormEvent) => { e.preventDefault(); void run('email', async () => {
    await gql('mutation($e:String!,$p:String!){changeEmail(newEmail:$e,password:$p){user{email}}}', { e: email.newEmail, p: email.password })
    say('email', { kind: 'success', text: t('account.email.done', { email: email.newEmail.trim().toLowerCase() }) }); setEmail({ newEmail: '', password: '' }); await refresh()
  }) }
  const savePassword = (e: FormEvent) => { e.preventDefault()
    if (pw.next !== pw.confirm) { say('pw', { kind: 'error', text: t('account.pw.mismatch') }); return }
    void run('pw', async () => {
      const d = await gql(`mutation($c:String!,$n:String!){changePassword(currentPassword:$c,newPassword:$n){token user{${USER_FIELDS}}}}`, { c: pw.current, n: pw.next })
      signIn(d.changePassword.token, d.changePassword.user); setPw({ current: '', next: '', confirm: '' }); say('pw', { kind: 'success', text: t('account.pw.done') })
    })
  }
  const signOutAll = () => { if (!confirm(t('account.sessions.confirm'))) return; void run('sessions', async () => {
    const d = await gql(`mutation{signOutEverywhere{token user{${USER_FIELDS}}}}`)
    signIn(d.signOutEverywhere.token, d.signOutEverywhere.user); say('sessions', { kind: 'success', text: t('account.sessions.done') })
  }) }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t('account.title')} subtitle={t('account.subtitle')} />

      <Section icon={UserRound} title={t('account.profile')} text={t('account.profileText')}>
        <form onSubmit={saveProfile} className="space-y-4">
          {msg.profile && <Alert kind={msg.profile.kind}>{msg.profile.text}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('auth.fullName')}><input className="input" required autoComplete="name" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></Field>
            <Field label={t('send.phone')} hint={t('send.phoneHint')}><input className="input" type="tel" autoComplete="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">{t('account.prefs')}:</span><LanguageSwitcher /><ThemeToggle />
          </div>
          <button className="btn-primary" disabled={busy === 'profile'}>{t('common.save')}</button>
        </form>
      </Section>

      <Section icon={Mail} title={t('auth.email')} text={t('account.emailText')}>
        <form onSubmit={saveEmail} className="space-y-4">
          <p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">{user?.email}</span><Badge>{user?.emailVerified ? 'verified' : 'unverified'}</Badge></p>
          {msg.email && <Alert kind={msg.email.kind}>{msg.email.text}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('account.email.new')}><input className="input" type="email" required autoComplete="email" value={email.newEmail} onChange={(e) => setEmail({ ...email, newEmail: e.target.value })} /></Field>
            <Field label={t('account.pw.current')}><input className="input" type="password" required autoComplete="current-password" value={email.password} onChange={(e) => setEmail({ ...email, password: e.target.value })} /></Field>
          </div>
          <button className="btn-secondary" disabled={busy === 'email'}>{t('account.email.submit')}</button>
        </form>
      </Section>

      <Section icon={KeyRound} title={t('auth.password')} text={t('account.pwText')}>
        <form onSubmit={savePassword} className="space-y-4">
          {msg.pw && <Alert kind={msg.pw.kind}>{msg.pw.text}</Alert>}
          <Field label={t('account.pw.current')}><input className="input" type="password" required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('auth.reset.new')} hint={t('auth.passwordHint')}><input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Field label={t('account.pw.confirm')}><input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          </div>
          <button className="btn-secondary" disabled={busy === 'pw'}>{t('account.pw.submit')}</button>
        </form>
      </Section>

      <Section icon={LogOut} title={t('account.sessions')} text={t('account.sessionsText')}>
        <div className="space-y-3">
          {msg.sessions && <Alert kind={msg.sessions.kind}>{msg.sessions.text}</Alert>}
          <button className="btn-secondary" onClick={signOutAll} disabled={busy === 'sessions'}><LogOut className="h-4 w-4" />{t('account.sessions.submit')}</button>
        </div>
      </Section>
    </div>
  )
}
