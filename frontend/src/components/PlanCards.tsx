import { ReactNode, useMemo, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { fmtMoney } from '../lib/api'
import { useI18n } from '../lib/i18n'
import type { Plan } from '../lib/types'

/**
 * Subscription packages, read from the backend `plans` query (admin-managed; nothing is hard-coded here).
 * Used by the public /pricing page, the landing page teaser and the in-app Plans page.
 */
export function usePlanText() {
  const { t } = useI18n()
  return {
    price: (p: Plan) => (p.price === 0 ? t('plans.free') : fmtMoney(p.price, p.currency)),
    // zero-quota lines are left out (e.g. a free plan whose SMS come from the demo allowance instead)
    features: (p: Plan) => [
      ...(p.smsQuota ? [t('plans.f.sms', { n: p.smsQuota.toLocaleString() })] : []),
      ...(p.emailQuota ? [t('plans.f.email', { n: p.emailQuota.toLocaleString() })] : []),
      t('plans.f.rate', { n: p.rateLimitPerMinute }),
      t('plans.f.keys', { n: p.maxApiKeys }),
    ],
  }
}

/** Cheapest paid plan whose SMS credits cover the monthly volume the visitor typed. */
function recommend(plans: Plan[], volume: number) {
  if (!volume) return null
  const fits = plans.filter((p) => p.price > 0 && p.smsQuota * (30 / Math.max(1, p.periodDays)) >= volume)
  return (fits.sort((a, b) => a.price - b.price)[0] ?? [...plans].sort((a, b) => b.smsQuota - a.smsQuota)[0])?.id ?? null
}

interface Props {
  plans: Plan[]
  currentPlanId?: string | null
  action: (p: Plan, recommended: boolean) => ReactNode
  showHelper?: boolean
  showCompare?: boolean
}

export default function PlanCards({ plans, currentPlanId, action, showHelper = true, showCompare = true }: Props) {
  const { t } = useI18n()
  const text = usePlanText()
  const [volume, setVolume] = useState('')
  const rec = useMemo(() => recommend(plans, Number(volume) || 0), [plans, volume])
  const cols = plans.length >= 4 ? 'xl:grid-cols-4' : plans.length === 3 ? 'lg:grid-cols-3' : ''

  return (
    <div className="space-y-8">
      {showHelper && (
        <div className="card flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium">{t('plans.helper.q')}</span>
            <input className="input" type="number" min={0} inputMode="numeric" placeholder={t('plans.helper.ph')} value={volume} onChange={(e) => setVolume(e.target.value)} />
          </label>
          <p className="text-sm text-muted sm:max-w-xs">{rec ? t('plans.helper.result', { name: plans.find((p) => p.id === rec)?.name ?? '' }) : t('plans.helper.hint')}</p>
        </div>
      )}

      <div className={`grid gap-4 sm:grid-cols-2 ${cols}`}>
        {plans.map((p) => {
          const isCurrent = currentPlanId === p.id
          const isRec = rec === p.id
          return (
            <div key={p.id} className={`card relative flex flex-col ${isRec ? 'ring-2 ring-brand-500' : isCurrent ? 'ring-2 ring-line-strong' : ''}`}>
              {(isRec || isCurrent) && (
                <span className={`absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${isRec ? 'bg-brand-500 text-on-brand' : 'bg-fg text-surface'}`}>
                  {isRec && <Sparkles className="h-3 w-3" />}{isRec ? t('plans.recommended') : t('plans.current')}
                </span>
              )}
              <p className="text-lg font-bold">{p.name}</p>
              <p className="min-h-[2.5rem] text-sm text-muted">{p.description}</p>
              <p className="my-4 text-3xl font-extrabold">{text.price(p)}<span className="text-sm font-medium text-muted"> {t('plans.perDays', { n: p.periodDays })}</span></p>
              <ul className="mb-5 flex-1 space-y-2 text-sm">
                {text.features(p).map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-accent" />{f}</li>)}
              </ul>
              {action(p, isRec)}
            </div>
          )
        })}
      </div>

      {showCompare && plans.length > 1 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t('plans.compare')}</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-subtle">
                <tr><th className="px-4 py-3 text-left font-semibold text-muted">{t('plans.col.feature')}</th>{plans.map((p) => <th key={p.id} className="whitespace-nowrap px-4 py-3 text-left font-semibold">{p.name}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {([
                  ['plans.col.price', (p: Plan) => text.price(p)],
                  ['plans.col.period', (p: Plan) => t('plans.days', { n: p.periodDays })],
                  ['plans.col.sms', (p: Plan) => p.smsQuota.toLocaleString()],
                  ['plans.col.perSms', (p: Plan) => (p.price > 0 && p.smsQuota ? fmtMoney(p.price / p.smsQuota, p.currency) : '-')],
                  ['plans.col.email', (p: Plan) => p.emailQuota.toLocaleString()],
                  ['plans.col.rate', (p: Plan) => p.rateLimitPerMinute.toLocaleString()],
                  ['plans.col.keys', (p: Plan) => p.maxApiKeys.toLocaleString()],
                ] as const).map(([k, fn]) => (
                  <tr key={k}><td className="whitespace-nowrap px-4 py-3 font-medium text-muted">{t(k)}</td>{plans.map((p) => <td key={p.id} className="whitespace-nowrap px-4 py-3">{fn(p)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">{t('plans.terms')}</p>
        </div>
      )}
    </div>
  )
}
