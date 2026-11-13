import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FlaskConical, Loader2, MessageSquare, Mail, KeyRound } from 'lucide-react'
import { gql } from '../lib/api'
import { USER_FIELDS, useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { Alert, Field } from '../components/ui'
import { Logo } from '../components/Brand'
import { LanguageSwitcher, ThemeToggle } from '../components/Prefs'

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
        <Link to="/" aria-label="Promokote"><Logo onDark /></Link>
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight">{t('auth.side.title1')}<br /><span className="text-brand-400">{t('auth.side.title2')}</span></h2>
          <p className="mt-4 max-w-md text-zinc-400">{t('auth.side.text')}</p>
          <ul className="mt-8 space-y-4 text-zinc-200">
            <li className="flex items-center gap-3"><FlaskConical className="h-5 w-5 text-brand-400" />{t('auth.side.p1')}</li>
            <li className="flex items-center gap-3"><MessageSquare className="h-5 w-5 text-brand-400" />{t('auth.side.p2')}</li>
            <li className="flex items-center gap-3"><Mail className="h-5 w-5 text-brand-400" />{t('auth.side.p3')}</li>
            <li className="flex items-center gap-3"><KeyRound className="h-5 w-5 text-brand-400" />{t('auth.side.p4')}</li>
          </ul>
        </div>
        <p className="relative text-sm text-zinc-500">&copy; {new Date().getFullYear()} Promokote</p>
      </div>
      <div className="flex flex-col px-5 py-6">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="lg:invisible" aria-label="Promokote"><Logo size="sm" /></Link>
          <div className="flex items-center gap-1"><LanguageSwitcher /><ThemeToggle /></div>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>
}

export function Login() {
  const { signIn } = useAuth()
  const { t } = useI18n()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const d = await gql(`mutation($e:String!,$p:String!){login(email:$e,password:$p){token user{${USER_FIELDS}}}}`, { e: email, p: password })
      signIn(d.login.token, d.login.user); nav('/')
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <Shell title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <Field label={t('auth.email')}><input className="input" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label={t('auth.password')}><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <div className="text-right text-sm"><Link to="/forgot-password" className="link">{t('auth.forgot')}</Link></div>
        <Submit busy={busy}>{t('auth.signIn')}</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-muted">{t('auth.newHere')} <Link to="/register" className="link">{t('auth.createAccount')}</Link></p>
    </Shell>
  )
}

export function Register() {
  const { signIn } = useAuth()
  const { t, lang } = useI18n()
  const nav = useNavigate()
  const [f, setF] = useState({ fullName: '', organizationName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const d = await gql(`mutation($e:String!,$p:String!,$n:String!,$o:String!,$l:String){register(email:$e,password:$p,fullName:$n,organizationName:$o,language:$l){token user{${USER_FIELDS}}}}`,
        { e: f.email, p: f.password, n: f.fullName, o: f.organizationName, l: lang })
      signIn(d.register.token, d.register.user); nav('/')
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <Shell title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <Field label={t('auth.fullName')}><input className="input" autoComplete="name" required value={f.fullName} onChange={set('fullName')} /></Field>
        <Field label={t('auth.orgName')}><input className="input" autoComplete="organization" required value={f.organizationName} onChange={set('organizationName')} /></Field>
        <Field label={t('auth.workEmail')} hint={t('auth.emailHint')}><input className="input" type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHint')}><input className="input" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={set('password')} /></Field>
        <Submit busy={busy}>{t('auth.createAccount')}</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-muted">{t('auth.haveAccount')} <Link to="/login" className="link">{t('auth.signIn')}</Link></p>
    </Shell>
  )
}

export function ForgotPassword() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await gql('mutation($e:String!){requestPasswordReset(email:$e){ok}}', { e: email }); setDone(true) }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <Shell title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      {done ? <Alert kind="success">{t('auth.forgot.done', { email })}</Alert> : (
        <form onSubmit={submit} className="space-y-4">
          <Alert>{error}</Alert>
          <Field label={t('auth.email')}><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Submit busy={busy}>{t('auth.forgot.submit')}</Submit>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="link">{t('auth.backToLogin')}</Link></p>
    </Shell>
  )
}

export function ResetPassword() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await gql('mutation($t:String!,$p:String!){resetPassword(token:$t,password:$p){ok}}', { t: params.get('token') ?? '', p: password }); nav('/login') }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <Shell title={t('auth.reset.title')} subtitle={t('auth.passwordHint')}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <Field label={t('auth.reset.new')}><input className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Submit busy={busy}>{t('auth.reset.submit')}</Submit>
      </form>
    </Shell>
  )
}

export function VerifyEmail() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const [state, setState] = useState<'work' | 'ok' | 'bad'>('work')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    gql('mutation($t:String!){verifyEmail(token:$t){ok}}', { t: params.get('token') ?? '' })
      .then(() => { setState('ok'); void refresh() }).catch((e: Error) => { setMsg(e.message); setState('bad') })
  }, [params, refresh])
  return (
    <Shell title={t('auth.verify.title')} subtitle="">
      {state === 'work' && <p className="text-muted">{t('auth.verify.working')}</p>}
      {state === 'ok' && <Alert kind="success">{t('auth.verify.ok')}</Alert>}
      {state === 'bad' && <Alert>{msg}</Alert>}
      <p className="mt-6 text-center text-sm"><Link to="/" className="link">{t('auth.verify.continue')}</Link></p>
    </Shell>
  )
}
