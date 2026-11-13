import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Check, CircleDot, FileText, Info } from 'lucide-react'
import DemoCard, { DEMO_FIELDS } from '../components/DemoCard'
import { Alert, Badge, Field, Loading, PageHeader } from '../components/ui'
import { fmtDate, fmtMoney, gql, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { TKey, useI18n } from '../lib/i18n'
import type { ActivationConfig, DemoCredits, SenderIdRequest } from '../lib/types'

const REQ_FIELDS = 'id senderId businessName registrationNumber contactPhone useCase sampleMessage status feeAmount feeCurrency feePaidAt adminNote createdAt reviewedAt'
const BLANK = { senderId: '', businessName: '', registrationNumber: '', contactPhone: '', useCase: '', sampleMessage: '' }

/** Where the organisation is in: demo -> request -> fee -> review -> approved -> buy a package. */
function stageOf(activated: boolean, open?: SenderIdRequest) {
  if (activated) return 4
  if (!open) return 0
  return open.status === 'submitted' ? 2 : 3
}

export default function SmsActivation() {
  const { t } = useI18n()
  const { user, refresh } = useAuth()
  const org = user?.organization
  const canRequest = org?.role === 'owner' || org?.role === 'admin'
  const { data, loading, error, reload } = useQuery<{ demoCredits: DemoCredits; smsActivationConfig: ActivationConfig; senderIdRequests: SenderIdRequest[] }>(`{
    demoCredits { ${DEMO_FIELDS} }
    smsActivationConfig { senderIdFee currency processingDays paymentInstructions demoCredits demoSenderName }
    senderIdRequests { ${REQ_FIELDS} }
  }`)
  const [f, setF] = useState(BLANK)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const set = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  useEffect(() => { void refresh() }, [refresh])   // pick up an approval made since sign-in

  if (loading) return <Loading />
  if (!data) return <Alert>{error}</Alert>
  const cfg = data.smsActivationConfig
  const requests = data.senderIdRequests
  const open = requests.find((r) => r.status === 'submitted' || r.status === 'under_review')
  const lastRejected = !open && requests[0]?.status === 'rejected' ? requests[0] : undefined
  const activated = !!org?.smsActivated
  const stage = stageOf(activated, open)
  const fee = cfg.senderIdFee > 0 ? fmtMoney(cfg.senderIdFee, cfg.currency) : null

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      await gql(`mutation($s:String!,$b:String!,$r:String!,$p:String!,$u:String!,$m:String!){requestSenderId(senderId:$s,businessName:$b,registrationNumber:$r,contactPhone:$p,useCase:$u,sampleMessage:$m){request{id}}}`,
        { s: f.senderId, b: f.businessName, r: f.registrationNumber, p: f.contactPhone, u: f.useCase, m: f.sampleMessage })
      setF(BLANK); setDone(t('act.submitted')); void reload()
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  async function cancel(r: SenderIdRequest) {
    if (!confirm(t('act.cancelConfirm'))) return
    try { await gql('mutation($i:ID!){cancelSenderIdRequest(id:$i){ok}}', { i: r.id }); setDone(''); void reload() } catch (x) { setErr((x as Error).message) }
  }

  const steps: TKey[] = ['act.step.demo', 'act.step.request', 'act.step.fee', 'act.step.review', 'act.step.package']

  return (
    <div className="space-y-6">
      <PageHeader title={t('act.title')} subtitle={t('act.subtitle')} />

      {/* progress */}
      <ol className="card grid gap-3 sm:grid-cols-5" aria-label={t('act.progress')}>
        {steps.map((k, i) => {
          const state = i < stage ? 'done' : i === stage ? 'now' : 'next'
          return (
            <li key={k} className="flex items-center gap-2 sm:flex-col sm:items-start">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${state === 'done' ? 'bg-success text-surface' : state === 'now' ? 'bg-brand-500 text-on-brand' : 'bg-subtle text-muted'}`}>
                {state === 'done' ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-sm ${state === 'next' ? 'text-muted' : 'font-semibold'}`}>{t(k)}</span>
            </li>
          )
        })}
      </ol>

      <Alert kind="success">{done}</Alert>
      <Alert>{err}</Alert>

      {activated ? (
        <div className="card flex flex-col gap-4 border-success/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <BadgeCheck className="h-8 w-8 shrink-0 text-success" />
            <div>
              <p className="text-lg font-bold">{t('act.active.title')}</p>
              <p className="text-sm text-muted">{org?.smsSenderId ? t('act.active.sender', { sender: org.smsSenderId }) : t('act.active.legacy')}</p>
            </div>
          </div>
          <Link to="/plans" className="btn-primary">{t('act.active.cta')}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-6">
            <DemoCard demo={data.demoCredits} compact />
            <div className="card space-y-3">
              <p className="flex items-center gap-2 font-semibold"><Info className="h-5 w-5 text-accent" />{t('act.what.title')}</p>
              <p className="text-sm text-muted">{t('act.what.text')}</p>
              <div className="rounded-lg bg-subtle p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-muted">{t('act.what.example')}</p>
                <p className="mt-1"><span className="font-semibold">{t('act.what.demo')}:</span> {cfg.demoSenderName}</p>
                <p><span className="font-semibold">{t('act.what.official')}:</span> {org?.name?.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 11) || 'DUKALANGU'}</p>
              </div>
            </div>
            <div className="card space-y-3">
              <p className="flex items-center gap-2 font-semibold"><FileText className="h-5 w-5 text-accent" />{t('act.req.title')}</p>
              <ul className="space-y-2 text-sm">
                {(['act.req.1', 'act.req.2', 'act.req.3', 'act.req.4', 'act.req.5'] as TKey[]).map((k) => <li key={k} className="flex gap-2"><CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t(k)}</li>)}
              </ul>
              <div className="border-t border-line pt-3 text-sm">
                <p><span className="font-semibold">{t('act.fee')}:</span> {fee ?? t('act.feeTbc')}</p>
                <p><span className="font-semibold">{t('act.time')}:</span> {t('act.days', { n: cfg.processingDays })}</p>
                {cfg.paymentInstructions && <p className="mt-2 whitespace-pre-line rounded-lg bg-subtle p-3"><span className="font-semibold">{t('act.howToPay')}:</span> {cfg.paymentInstructions}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {open ? (
              <div className="card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-bold">{t('act.yourRequest')}</p><Badge>{open.status}</Badge>
                </div>
                <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-muted">{t('act.f.sender')}</dt><dd className="font-semibold">{open.senderId}</dd>
                  <dt className="text-muted">{t('act.f.business')}</dt><dd>{open.businessName}</dd>
                  <dt className="text-muted">{t('act.f.reg')}</dt><dd>{open.registrationNumber}</dd>
                  <dt className="text-muted">{t('act.sentOn')}</dt><dd>{fmtDate(open.createdAt)}</dd>
                  <dt className="text-muted">{t('act.fee')}</dt><dd>{open.feeAmount > 0 ? fmtMoney(open.feeAmount, open.feeCurrency) : t('act.feeTbc')}{open.feePaidAt && <> · <span className="text-success">{t('act.paid')}</span></>}</dd>
                </dl>
                <Alert kind="info">{open.status === 'submitted' ? t('act.next.pay', { days: cfg.processingDays }) : t('act.next.review', { days: cfg.processingDays })}</Alert>
                {open.status === 'submitted' && canRequest && <button className="btn-secondary w-full" onClick={() => cancel(open)}>{t('act.cancel')}</button>}
              </div>
            ) : !canRequest ? (
              <Alert kind="info">{t('act.ownerOnly')}</Alert>
            ) : (
              <form onSubmit={submit} className="card space-y-4">
                <div>
                  <p className="text-lg font-bold">{t('act.form.title')}</p>
                  <p className="text-sm text-muted">{t('act.form.text')}</p>
                </div>
                {lastRejected && <Alert>{t('act.rejected', { sender: lastRejected.senderId, note: lastRejected.adminNote })}</Alert>}
                <Field label={t('act.f.sender')} hint={t('act.f.senderHint')}>
                  <input className="input font-semibold uppercase" required maxLength={11} minLength={3} value={f.senderId} onChange={set('senderId')} placeholder="DUKALANGU" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('act.f.business')}><input className="input" required value={f.businessName} onChange={set('businessName')} /></Field>
                  <Field label={t('act.f.reg')} hint={t('act.f.regHint')}><input className="input" required value={f.registrationNumber} onChange={set('registrationNumber')} /></Field>
                </div>
                <Field label={t('act.f.phone')}><input className="input" required type="tel" value={f.contactPhone} onChange={set('contactPhone')} placeholder="0712345678" /></Field>
                <Field label={t('act.f.use')} hint={t('act.f.useHint')}><textarea className="input min-h-[80px]" required maxLength={500} value={f.useCase} onChange={set('useCase')} /></Field>
                <Field label={t('act.f.sample')} hint={t('act.f.sampleHint')}><textarea className="input min-h-[80px]" required maxLength={320} value={f.sampleMessage} onChange={set('sampleMessage')} /></Field>
                <p className="text-xs text-muted">{fee ? t('act.form.feeNote', { fee }) : t('act.form.feeNoteTbc')}</p>
                <button className="btn-primary w-full" disabled={busy}>{busy ? t('common.working') : t('act.form.submit')}</button>
              </form>
            )}
            {requests.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-muted">{t('act.history')}</p>
                <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
                  {requests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <span className="font-semibold">{r.senderId}</span>
                      <span className="text-muted">{fmtDate(r.createdAt)}</span>
                      <Badge>{r.status}</Badge>
                      {r.status === 'rejected' && r.adminNote && <p className="w-full text-xs text-danger">{r.adminNote}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      {!activated && <p className="text-center text-sm text-muted">{t('act.afterApproval')} <Link to="/plans" className="link">{t('act.seePlans')}</Link></p>}
    </div>
  )
}
