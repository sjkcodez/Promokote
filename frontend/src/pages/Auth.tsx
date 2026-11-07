import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, MessageSquare, Mail, KeyRound, Zap } from 'lucide-react'
import { gql } from '../lib/api'
import { USER_FIELDS, useAuth } from '../lib/auth'
import { Alert, Field } from '../components/ui'
import { Logo } from '../components/Layout'

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 p-12 text-white lg:flex">
        <Logo light />
        <div>
          <h2 className="text-4xl font-extrabold leading-tight">Reach every customer,<br />by SMS and email.</h2>
          <p className="mt-4 max-w-md text-brand-100">Launch campaigns in minutes or plug our API into your own system.</p>
          <ul className="mt-8 space-y-4 text-brand-50">
            <li className="flex items-center gap-3"><MessageSquare className="h-5 w-5" />Bulk SMS with live segment &amp; cost count</li>
            <li className="flex items-center gap-3"><Mail className="h-5 w-5" />Email campaigns with one-click unsubscribe</li>
            <li className="flex items-center gap-3"><KeyRound className="h-5 w-5" />API key &amp; secret for your own apps</li>
            <li className="flex items-center gap-3"><Zap className="h-5 w-5" />Start sending in under 10 minutes</li>
          </ul>
        </div>
        <p className="text-sm text-brand-200">&copy; {new Date().getFullYear()} Promokote</p>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
          {children}
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
    <Shell title="Welcome back" subtitle="Sign in to your Promokote account.">
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="Email"><input className="input" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <div className="text-right text-sm"><Link to="/forgot-password" className="font-medium text-brand-600 hover:underline">Forgot password?</Link></div>
        <Submit busy={busy}>Sign in</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">New to Promokote? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create an account</Link></p>
    </Shell>
  )
}

export function Register() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ fullName: '', organizationName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const d = await gql(`mutation($e:String!,$p:String!,$n:String!,$o:String!){register(email:$e,password:$p,fullName:$n,organizationName:$o){token user{${USER_FIELDS}}}}`,
        { e: f.email, p: f.password, n: f.fullName, o: f.organizationName })
      signIn(d.register.token, d.register.user); nav('/')
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <Shell title="Create your account" subtitle="Free trial included. No card needed.">
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="Your full name"><input className="input" required value={f.fullName} onChange={set('fullName')} /></Field>
        <Field label="Business / organisation name"><input className="input" required value={f.organizationName} onChange={set('organizationName')} /></Field>
        <Field label="Work email"><input className="input" type="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="At least 8 characters."><input className="input" type="password" required minLength={8} value={f.password} onChange={set('password')} /></Field>
        <Submit busy={busy}>Create account</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link></p>
    </Shell>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try { await gql('mutation($e:String!){requestPasswordReset(email:$e){ok}}', { e: email }); setDone(true) } finally { setBusy(false) }
  }
  return (
    <Shell title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {done ? <Alert kind="success">If an account exists for {email}, a reset link is on its way.</Alert> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Submit busy={busy}>Send reset link</Submit>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-brand-600 hover:underline">Back to sign in</Link></p>
    </Shell>
  )
}

export function ResetPassword() {
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
    <Shell title="Choose a new password" subtitle="Use at least 8 characters.">
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="New password"><input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Submit busy={busy}>Save password</Submit>
      </form>
    </Shell>
  )
}

export function VerifyEmail() {
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const [state, setState] = useState<'work' | 'ok' | 'bad'>('work')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    gql('mutation($t:String!){verifyEmail(token:$t){ok}}', { t: params.get('token') ?? '' })
      .then(() => { setState('ok'); void refresh() }).catch((e: Error) => { setMsg(e.message); setState('bad') })
  }, [params, refresh])
  return (
    <Shell title="Email verification" subtitle="">
      {state === 'work' && <p className="text-slate-500">Verifying...</p>}
      {state === 'ok' && <Alert kind="success">Your email is verified. You're all set.</Alert>}
      {state === 'bad' && <Alert>{msg}</Alert>}
      <p className="mt-6 text-center text-sm"><Link to="/" className="font-semibold text-brand-600 hover:underline">Continue to Promokote</Link></p>
    </Shell>
  )
}
