import { Link } from 'react-router-dom'
import { BadgeCheck, FlaskConical } from 'lucide-react'
import PublicShell from '../components/PublicShell'
import PlanCards from '../components/PlanCards'
import PaymentSteps from '../components/PaymentSteps'
import ContactCard from '../components/ContactCard'
import { PAYMENT_FIELDS } from '../lib/pricing'
import { Alert, Loading } from '../components/ui'
import { fmtMoney, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import type { ActivationConfig, CreditPrice, PaymentSettings, Plan } from '../lib/types'

/** Public pricing page: every active package, straight from the backend. */
export default function Pricing() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data, loading, error } = useQuery<{ plans: Plan[]; smsActivationConfig: ActivationConfig; creditPrices: CreditPrice[]; paymentSettings: PaymentSettings }>(`{
    plans { id name description price currency periodDays smsQuota emailQuota rateLimitPerMinute maxApiKeys }
    smsActivationConfig { senderIdFee currency processingDays demoCredits demoSenderName }
    creditPrices { channel minQuantity unitPrice }
    paymentSettings { ${PAYMENT_FIELDS} }
  }`)
  const cfg = data?.smsActivationConfig
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-bold uppercase tracking-wider text-accent">{t('land.nav.pricing')}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{t('pricing.title')}</h1>
        <p className="mt-3 max-w-2xl text-muted">{t('pricing.intro')}</p>
        <div className="my-8 grid gap-4 md:grid-cols-2">
          <div className="card flex gap-3">
            <FlaskConical className="h-6 w-6 shrink-0 text-accent" />
            <div><p className="font-semibold">{t('pricing.demo.title', { n: cfg?.demoCredits ?? 10 })}</p><p className="mt-1 text-sm text-muted">{t('pricing.demo.text', { name: cfg?.demoSenderName ?? 'PROMOKOTE' })}</p></div>
          </div>
          <div className="card flex gap-3">
            <BadgeCheck className="h-6 w-6 shrink-0 text-accent" />
            <div><p className="font-semibold">{t('pricing.sender.title')}</p><p className="mt-1 text-sm text-muted">
              {cfg && cfg.senderIdFee > 0 ? t('pricing.sender.fee', { fee: fmtMoney(cfg.senderIdFee, cfg.currency), days: cfg.processingDays }) : t('pricing.sender.noFee', { days: cfg?.processingDays ?? 7 })}
            </p></div>
          </div>
        </div>
        {data && data.creditPrices.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-extrabold tracking-tight">{t('pricing.payg.title')}</h2>
            <p className="mt-2 max-w-2xl text-muted">{t('pricing.payg.text')}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {(['sms', 'email'] as const).map((ch) => {
                const rows = data.creditPrices.filter((p) => p.channel === ch)
                if (!rows.length) return null
                return (
                  <div key={ch} className="card">
                    <p className="font-bold">{ch === 'sms' ? 'SMS' : t('common.email')}</p>
                    <table className="mt-3 w-full text-sm">
                      <thead><tr className="text-left text-muted"><th className="pb-2 font-medium">{t('pricing.payg.qty')}</th><th className="pb-2 text-right font-medium">{t('pricing.payg.unit')}</th></tr></thead>
                      <tbody className="divide-y divide-line">
                        {rows.map((r, i) => <tr key={r.minQuantity}><td className="py-2">{rows[i + 1] ? `${r.minQuantity.toLocaleString()} - ${(rows[i + 1].minQuantity - 1).toLocaleString()}` : `${r.minQuantity.toLocaleString()}+`}</td><td className="py-2 text-right font-semibold">{fmtMoney(r.unitPrice, data.paymentSettings.currency)}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
            <div className="mt-6"><PaymentSteps /></div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to={user ? '/buy-credits' : '/register'} className="btn-primary">{user ? t('nav.buy') : t('pricing.start')}</Link>
              <ContactCard settings={data.paymentSettings} compact />
            </div>
          </section>
        )}
        <h2 className="mb-4 text-2xl font-extrabold tracking-tight">{t('pricing.plans.title')}</h2>
        <Alert>{error}</Alert>
        {loading ? <Loading /> : (
          <PlanCards plans={data?.plans ?? []} action={(_, rec) => (
            <Link to={user ? '/plans' : '/register'} className={rec ? 'btn-primary' : 'btn-secondary'}>{user ? t('pricing.choose') : t('pricing.start')}</Link>
          )} />
        )}
      </div>
    </PublicShell>
  )
}
