import { Link } from 'react-router-dom'
import { BadgeCheck, FlaskConical } from 'lucide-react'
import PublicShell from '../components/PublicShell'
import PlanCards from '../components/PlanCards'
import { Alert, Loading } from '../components/ui'
import { fmtMoney, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import type { ActivationConfig, Plan } from '../lib/types'

/** Public pricing page: every active package, straight from the backend. */
export default function Pricing() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data, loading, error } = useQuery<{ plans: Plan[]; smsActivationConfig: ActivationConfig }>(`{
    plans { id name description price currency periodDays smsQuota emailQuota rateLimitPerMinute maxApiKeys }
    smsActivationConfig { senderIdFee currency processingDays demoCredits demoSenderName }
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
