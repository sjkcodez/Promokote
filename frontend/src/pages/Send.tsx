import { FormEvent, useState } from 'react'
import { Mail, MessageSquare, Send as SendIcon } from 'lucide-react'
import { gql, smsInfo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Alert, Badge, Field } from '../components/ui'

export default function Send() {
  const { user } = useAuth()
  const org = user?.organization
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ status: string; error: string } | null>(null)
  const info = smsInfo(body)

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setResult(null)
    try {
      const d = await gql('mutation($c:String!,$r:String!,$s:String,$b:String!){sendTest(channel:$c,recipient:$r,subject:$s,body:$b){message{status error}}}', { c: channel, r: to, s: subject, b: body })
      setResult(d.sendTest.message)
    } catch (x) { setError((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Quick send</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Send a single SMS or email to test your setup. Uses one credit from your plan.</p>
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-200 p-1">
        {([['sms', 'SMS', MessageSquare], ['email', 'Email', Mail]] as const).map(([v, l, Icon]) => (
          <button key={v} type="button" onClick={() => { setChannel(v); setResult(null) }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${channel === v ? 'bg-white text-brand-700 shadow' : 'text-slate-600'}`}><Icon className="h-4 w-4" />{l}</button>
        ))}
      </div>
      <form onSubmit={submit} className="card space-y-4">
        {channel === 'sms' && org && !org.smsEnabled && <Alert>SMS is not enabled for your organisation.</Alert>}
        {channel === 'email' && org && !org.emailEnabled && <Alert>Email is not enabled for your organisation.</Alert>}
        <Alert>{error}</Alert>
        {result && <Alert kind={result.status === 'sent' ? 'success' : 'error'}>Status: <Badge>{result.status}</Badge> {result.error}</Alert>}
        <Field label={channel === 'sms' ? 'Phone number' : 'Recipient email'} hint={channel === 'sms' ? 'e.g. 0712 345 678 or +255712345678' : undefined}>
          <input className="input" required value={to} onChange={(e) => setTo(e.target.value)} placeholder={channel === 'sms' ? '0712345678' : 'customer@example.com'} />
        </Field>
        {channel === 'email' && <Field label="Subject"><input className="input" required value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>}
        <Field label={channel === 'sms' ? 'Message' : 'Message (HTML allowed)'}>
          <textarea className="input min-h-[140px]" required value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {channel === 'sms' && <p className="text-xs text-slate-500">{info.length} characters &middot; {info.encoding} &middot; <b>{info.segments}</b> SMS segment{info.segments > 1 ? 's' : ''} (credits)</p>}
        <button className="btn-primary w-full" disabled={busy}><SendIcon className="h-4 w-4" />{busy ? 'Sending...' : 'Send now'}</button>
      </form>
    </div>
  )
}
