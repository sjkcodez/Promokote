import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MessageSquare, Receipt, Wallet } from 'lucide-react'
import ContactCard from '../components/ContactCard'
import PaymentSteps from '../components/PaymentSteps'
import { Alert, Badge, Field, Loading, PageHeader } from '../components/ui'
import { fmtDate, fmtMoney, gql, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { estimate, ORDER_FIELDS, PAYMENT_FIELDS } from '../lib/pricing'
import type { CreditOrder, CreditPrice, PaymentSettings } from '../lib/types'

interface Data { creditPrices: CreditPrice[]; paymentSettings: PaymentSettings; creditBalance: { sms: number; email: number }; creditOrders: CreditOrder[] }

const PRESETS = { sms: [100, 500, 1000, 5000, 10000], email: [500, 1000, 5000, 10000] }

function QuantityPicker({ channel, value, onChange, prices, currency }: { channel: 'sms' | 'email'; value: string; onChange: (v: string) => void; prices: CreditPrice[]; currency: string }) {
  const { t } = useI18n()
  const qty = Number(value) || 0
  const e = estimate(prices, channel, qty)
  const Icon = channel === 'sms' ? MessageSquare : Mail
  if (!e.onSale) return <p className="text-sm text-muted">{t(channel === 'sms' ? 'buy.smsOff' : 'buy.emailOff')}</p>
  return (
    <div className="space-y-2">
      <Field label={t(channel === 'sms' ? 'buy.smsQty' : 'buy.emailQty')} hint={t('buy.min', { n: e.min!.toLocaleString() })}>
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input className="input pl-9" type="number" inputMode="numeric" min={0} step={1} value={value} placeholder="0" onChange={(ev) => onChange(ev.target.value)} />
        </div>
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS[channel].filter((n) => n >= (e.min ?? 0)).map((n) => (
          <button key={n} type="button" onClick={() => onChange(String(n))}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${qty === n ? 'border-brand-500 bg-brand-500 text-on-brand' : 'border-line-strong text-muted hover:border-brand-500 hover:text-fg'}`}>
            {n.toLocaleString()}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {e.tiers.map((tr) => (
          <span key={tr.minQuantity} className={e.unit === tr.unitPrice && qty >= tr.minQuantity ? 'font-semibold text-accent' : ''}>
            {t('buy.tier', { n: tr.minQuantity.toLocaleString(), price: fmtMoney(tr.unitPrice, currency) })}
          </span>
        ))}
      </div>
    </div>
  )
}

function OrderCard({ o, settings, onChange }: { o: CreditOrder; settings: PaymentSettings; onChange: () => void }) {
  const { t } = useI18n()
  const [txn, setTxn] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const open = o.status === 'pending_payment' || o.status === 'payment_submitted'
  async function paid(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await gql('mutation($i:ID!,$r:String!){submitPayment(id:$i,paymentReference:$r){order{id}}}', { i: o.id, r: txn }); onChange() }
    catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  async function cancel() {
    if (!confirm(t('buy.cancelConfirm', { ref: o.reference }))) return
    try { await gql('mutation($i:ID!){cancelCreditOrder(id:$i){ok}}', { i: o.id }); onChange() } catch (x) { setErr((x as Error).message) }
  }
  const items = [o.smsQuantity ? t('buy.nSms', { n: o.smsQuantity.toLocaleString() }) : '', o.emailQuantity ? t('buy.nEmail', { n: o.emailQuantity.toLocaleString() }) : ''].filter(Boolean).join(' + ')
  return (
    <div className={`card space-y-4 ${open ? 'border-accent-line' : ''}`} id={`order-${o.reference}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">{t('buy.reference')}</p>
          <p className="font-mono text-lg font-bold">{o.reference}</p>
        </div>
        <Badge>{o.status}</Badge>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-y border-line py-3">
        <p className="text-sm">{items}</p>
        <p className="text-xl font-extrabold">{fmtMoney(o.total, o.currency)}</p>
      </div>
      <p className="text-xs text-muted">{t('buy.placed', { date: fmtDate(o.createdAt) })}{o.paymentReference && ` · ${t('buy.txn')}: ${o.paymentReference}`}</p>
      <Alert>{err}</Alert>
      {o.status === 'pending_payment' && (
        <>
          <div className="rounded-lg bg-subtle p-3 text-sm">
            <p className="font-semibold">{t('buy.howToPay', { amount: fmtMoney(o.total, o.currency) })}</p>
            <p className="mt-1 whitespace-pre-line">{settings.paymentInstructions || t('buy.noInstructions')}</p>
            <p className="mt-2 text-accent-ink">{t('buy.useRef', { ref: o.reference })}</p>
          </div>
          <form onSubmit={paid} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1"><Field label={t('buy.txnLabel')} hint={t('buy.txnHint')}><input className="input" required minLength={4} maxLength={80} value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="QK12ABC9" /></Field></div>
            <button className="btn-primary sm:mb-5" disabled={busy}><Receipt className="h-4 w-4" />{t('buy.ivePaid')}</button>
          </form>
          <button className="text-sm text-muted underline hover:text-fg" onClick={cancel}>{t('buy.cancel')}</button>
        </>
      )}
      {o.status === 'payment_submitted' && (
        <>
          <Alert kind="info">{t('buy.checking')}</Alert>
          <ContactCard settings={settings} reference={o.reference} compact />
        </>
      )}
      {o.status === 'approved' && <Alert kind="success">{t('buy.approved')}</Alert>}
      {o.status === 'rejected' && <Alert>{t('buy.rejected', { note: o.adminNote })}</Alert>}
    </div>
  )
}

export default function BuyCredits() {
  const { t } = useI18n()
  const { user } = useAuth()
  const org = user?.organization
  const canBuy = org?.role === 'owner' || org?.role === 'admin'
  const { data, loading, error, reload } = useQuery<Data>(`{
    creditPrices { channel minQuantity unitPrice }
    paymentSettings { ${PAYMENT_FIELDS} }
    creditBalance { sms email }
    creditOrders { ${ORDER_FIELDS} }
  }`)
  const [sms, setSms] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [placed, setPlaced] = useState('')

  if (loading) return <Loading />
  if (!data) return <Alert>{error}</Alert>
  const cur = data.paymentSettings.currency
  const sQ = Number(sms) || 0
  const eQ = Number(email) || 0
  const sE = estimate(data.creditPrices, 'sms', sQ)
  const eE = estimate(data.creditPrices, 'email', eQ)
  const belowMin = (sQ > 0 && sE.min !== null && sQ < sE.min) || (eQ > 0 && eE.min !== null && eQ < eE.min)
  const total = sE.subtotal + eE.subtotal
  const orders = data.creditOrders
  const open = orders.filter((o) => o.status === 'pending_payment' || o.status === 'payment_submitted')

  async function order(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const d = await gql(`mutation($s:Int,$e:Int){createCreditOrder(smsQuantity:$s,emailQuantity:$e){order{reference}}}`, { s: sQ, e: eQ })
      setPlaced(d.createCreditOrder.order.reference); setSms(''); setEmail(''); await reload()
      setTimeout(() => document.getElementById(`order-${d.createCreditOrder.order.reference}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t('buy.title')} subtitle={t('buy.subtitle')} />
      <PaymentSteps />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {canBuy ? (
          <form onSubmit={order} className="card space-y-6">
            <p className="text-lg font-bold">{t('buy.choose')}</p>
            <QuantityPicker channel="sms" value={sms} onChange={setSms} prices={data.creditPrices} currency={cur} />
            {sQ > 0 && org && !org.smsActivated && <Alert kind="info">{t('buy.smsNeedsSender')} <Link to="/sms-activation" className="font-semibold underline">{t('nav.activation')}</Link></Alert>}
            <QuantityPicker channel="email" value={email} onChange={setEmail} prices={data.creditPrices} currency={cur} />
            <div className="space-y-1 rounded-xl bg-subtle p-4 text-sm">
              {sQ > 0 && sE.unit !== null && <div className="flex justify-between gap-2"><span>{t('buy.line', { n: sQ.toLocaleString(), what: 'SMS', price: fmtMoney(sE.unit, cur) })}</span><span>{fmtMoney(sE.subtotal, cur)}</span></div>}
              {eQ > 0 && eE.unit !== null && <div className="flex justify-between gap-2"><span>{t('buy.line', { n: eQ.toLocaleString(), what: t('common.email'), price: fmtMoney(eE.unit, cur) })}</span><span>{fmtMoney(eE.subtotal, cur)}</span></div>}
              <div className="flex items-baseline justify-between gap-2 border-t border-line pt-2"><span className="font-semibold">{t('buy.total')}</span><span className="text-2xl font-extrabold">{fmtMoney(total, cur)}</span></div>
            </div>
            <Alert>{err}</Alert>
            {placed && <Alert kind="success">{t('buy.placedOk', { ref: placed })}</Alert>}
            <button className="btn-primary w-full !py-3" disabled={busy || (!sQ && !eQ) || belowMin}>{busy ? t('common.working') : t('buy.send', { total: fmtMoney(total, cur) })}</button>
            <p className="text-xs text-muted">{t('buy.terms')}</p>
          </form>
        ) : <Alert kind="info">{t('buy.ownerOnly')}</Alert>}

        <div className="space-y-6">
          <div className="card">
            <p className="flex items-center gap-2 font-semibold"><Wallet className="h-5 w-5 text-accent" />{t('buy.balance')}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><p className="text-2xl font-bold">{data.creditBalance.sms.toLocaleString()}</p><p className="text-sm text-muted">SMS</p></div>
              <div><p className="text-2xl font-bold">{data.creditBalance.email.toLocaleString()}</p><p className="text-sm text-muted">{t('dash.emails')}</p></div>
            </div>
            <p className="mt-3 text-xs text-muted">{t('buy.balanceNote')}</p>
          </div>
          <ContactCard settings={data.paymentSettings} reference={open[0]?.reference} />
        </div>
      </div>

      {orders.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('buy.orders')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {orders.map((o) => <OrderCard key={o.id} o={o} settings={data.paymentSettings} onChange={() => void reload()} />)}
          </div>
        </section>
      )}
    </div>
  )
}
