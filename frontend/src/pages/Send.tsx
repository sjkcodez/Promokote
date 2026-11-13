import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Mail, MessageSquare, Send as SendIcon } from 'lucide-react'
import { gql, smsInfo, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import type { DemoCredits } from '../lib/types'
import { DEMO_FIELDS } from '../components/DemoCard'
import { Alert, Badge, Field } from '../components/ui'

export default function Send() {
  const { user } = useAuth()
  const { t } = useI18n()
  const org = user?.organization
  const demoQ = useQuery<{ demoCredits: DemoCredits }>(`{ demoCredits { ${DEMO_FIELDS} } }`)
  const demo = demoQ.data?.demoCredits
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
      if (channel === 'sms') void demoQ.reload()
    } catch (x) { setError((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{t('send.title')}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{t('send.subtitle')}</p>
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-subtle p-1" role="tablist">
        {([['sms', t('common.sms'), MessageSquare], ['email', t('common.email'), Mail]] as const).map(([v, l, Icon]) => (
          <button key={v} type="button" role="tab" aria-selected={channel === v} onClick={() => { setChannel(v); setResult(null) }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${channel === v ? 'bg-surface text-fg shadow' : 'text-muted hover:text-fg'}`}><Icon className={`h-4 w-4 ${channel === v ? 'text-accent' : ''}`} />{l}</button>
        ))}
      </div>
      <form onSubmit={submit} className="card space-y-4">
        {channel === 'sms' && demo?.active && (
          <div className="flex gap-3 rounded-lg border border-accent-line bg-accent-soft p-3 text-sm text-accent-ink">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{demo.granted > 0 ? t('send.demoNote', { name: demo.senderName, left: demo.remaining, total: demo.granted }) : t('send.demoNone')}{' '}
              <Link to="/sms-activation" className="font-semibold underline">{t('send.activate')}</Link></p>
          </div>
        )}
        {channel === 'sms' && org && !org.smsEnabled && <Alert>{t('send.smsDisabled')}</Alert>}
        {channel === 'email' && org && !org.emailEnabled && <Alert>{t('send.emailDisabled')}</Alert>}
        <Alert>{error}</Alert>
        {result && <Alert kind={result.status === 'sent' ? 'success' : 'error'}>{t('send.status')}: <Badge>{result.status}</Badge> {result.error}</Alert>}
        <Field label={channel === 'sms' ? t('send.phone') : t('send.recipientEmail')} hint={channel === 'sms' ? t('send.phoneHint') : undefined}>
          <input className="input" required type={channel === 'sms' ? 'tel' : 'email'} value={to} onChange={(e) => setTo(e.target.value)} placeholder={channel === 'sms' ? '0712345678' : 'mteja@mfano.co.tz'} />
        </Field>
        {channel === 'email' && <Field label={t('send.subject')}><input className="input" required value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>}
        <Field label={channel === 'sms' ? t('send.message') : t('send.messageHtml')}>
          <textarea className="input min-h-[140px]" required value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {channel === 'sms' && <p className="text-xs text-muted">{t('send.counter', { len: info.length, enc: info.encoding, n: info.segments })}</p>}
        <button className="btn-primary w-full" disabled={busy}><SendIcon className="h-4 w-4" />{busy ? t('send.sending') : t('send.now')}</button>
      </form>
    </div>
  )
}
