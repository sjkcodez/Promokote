import { BadgeCheck, Calculator, MessageCircle, Receipt, Wallet } from 'lucide-react'
import { TKey, useI18n } from '../lib/i18n'

/** "How payment works": choose amount -> send order -> pay -> confirm -> approved. */
export default function PaymentSteps() {
  const { t } = useI18n()
  const steps: [typeof Wallet, TKey, TKey][] = [
    [Calculator, 'pay.s1.t', 'pay.s1.d'],
    [Receipt, 'pay.s2.t', 'pay.s2.d'],
    [Wallet, 'pay.s3.t', 'pay.s3.d'],
    [MessageCircle, 'pay.s4.t', 'pay.s4.d'],
    [BadgeCheck, 'pay.s5.t', 'pay.s5.d'],
  ]
  return (
    <div>
      <p className="mb-3 font-semibold">{t('pay.title')}</p>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map(([Icon, title, text], i) => (
          <li key={title} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-on-brand">{i + 1}</span>
              <Icon className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-2 text-sm font-semibold">{t(title)}</p>
            <p className="mt-1 text-xs text-muted">{t(text)}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
