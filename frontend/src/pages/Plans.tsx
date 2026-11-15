import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtDate, fmtMoney, gql, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import type { PaymentSettings, Plan, Subscription } from '../lib/types'
import PlanCards from '../components/PlanCards'
import ContactCard from '../components/ContactCard'
import { PAYMENT_FIELDS } from '../lib/pricing'
import { Alert, Badge, Loading, PageHeader } from '../components/ui'

export default function Plans() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data, loading, error, reload } = useQuery<{ plans: Plan[]; subscription: Subscription | null; pendingSubscription: Subscription | null; paymentSettings: PaymentSettings }>(`{
    plans { id name description price currency periodDays smsQuota emailQuota rateLimitPerMinute maxApiKeys }
    subscription { id status endsAt smsUsed emailUsed plan { id name } }
    pendingSubscription { id status plan { id name price currency } }
    paymentSettings { ${PAYMENT_FIELDS} }
  }`)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  async function choose(p: Plan) {
    try {
      const d = await gql('mutation($p:ID!){subscribe(planId:$p){subscription{status}}}', { p: p.id })
      setMsg({ kind: 'success', text: d.subscribe.subscription.status === 'active' ? t('plans.nowOn', { name: p.name }) : t('plans.requested', { name: p.name, price: fmtMoney(p.price, p.currency) }) })
      void reload()
    } catch (x) { setMsg({ kind: 'error', text: (x as Error).message }) }
  }
  if (loading) return <Loading />
  const current = data?.subscription
  const pendingId = data?.pendingSubscription?.plan.id
  const smsActive = !!user?.organization?.smsActivated
  return (
    <div>
      <PageHeader title={t('plans.title')} subtitle={current ? t('plans.currentLine', { name: current.plan.name, date: fmtDate(current.endsAt) }) : t('plans.pick')} />
      <div className="mb-6 space-y-3">
        <Alert>{error}</Alert>{msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        {data?.pendingSubscription && (
          <div className="card space-y-3 border-accent-line">
            <p className="font-semibold">{t('plans.awaiting')} {data.pendingSubscription.plan.name} <Badge>pending</Badge></p>
            <div className="rounded-lg bg-subtle p-3 text-sm">
              <p className="font-semibold">{t('buy.howToPay', { amount: fmtMoney(data.pendingSubscription.plan.price, data.pendingSubscription.plan.currency) })}</p>
              <p className="mt-1 whitespace-pre-line">{data.paymentSettings.paymentInstructions || t('buy.noInstructions')}</p>
              <p className="mt-2 text-accent-ink">{t('plans.payRef', { org: user?.organization?.name ?? '', plan: data.pendingSubscription.plan.name })}</p>
            </div>
            <ContactCard settings={data.paymentSettings} reference={`${data.pendingSubscription.plan.name} - ${user?.organization?.name ?? ''}`} compact />
          </div>
        )}
        <Alert kind="info">{t('plans.payg')} <Link to="/buy-credits" className="font-semibold underline">{t('nav.buy')}</Link></Alert>
        {!smsActive && <Alert kind="info">{t('plans.smsNotActive')} <Link to="/sms-activation" className="font-semibold underline">{t('plans.activateFirst')}</Link></Alert>}
      </div>
      <PlanCards plans={data?.plans ?? []} currentPlanId={current?.plan.id} action={(p, rec) => {
        const isCurrent = current?.plan.id === p.id
        const isPending = pendingId === p.id
        return (
          <button className={isCurrent || isPending ? 'btn-secondary' : rec ? 'btn-primary' : 'btn-secondary'} disabled={isCurrent || isPending} onClick={() => choose(p)}>
            {isCurrent ? t('plans.current') : isPending ? t('status.pending') : p.price === 0 ? t('plans.switch') : t('plans.request')}
          </button>
        )
      }} />
    </div>
  )
}
