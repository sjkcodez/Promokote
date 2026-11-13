import { Link } from 'react-router-dom'
import { ArrowRight, FlaskConical } from 'lucide-react'
import type { DemoCredits } from '../lib/types'
import { useI18n } from '../lib/i18n'
import { Progress } from './ui'

export const DEMO_FIELDS = 'granted used remaining active ineligibleReason requiresVerifiedEmail emailVerified senderName'

/** Free demo SMS balance (shown while the organisation has no approved Sender ID). */
export default function DemoCard({ demo, compact = false }: { demo: DemoCredits; compact?: boolean }) {
  const { t } = useI18n()
  const notEligible = demo.granted === 0
  const needsVerify = !notEligible && demo.requiresVerifiedEmail && !demo.emailVerified
  const done = !notEligible && demo.remaining === 0
  return (
    <div className="card border-accent-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold"><FlaskConical className="h-5 w-5 text-accent" />{t('demo.title')}</p>
        <p className="text-xs text-muted">{t('demo.sender', { name: demo.senderName })}</p>
      </div>
      {notEligible ? (
        <p className="mt-3 text-sm text-muted">{t(demo.ineligibleReason === 'ip_limit' ? 'demo.ineligible.ip' : 'demo.ineligible.claimed')}</p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold">{demo.remaining} <span className="text-base font-medium text-muted">{t('demo.leftOf', { total: demo.granted })}</span></p>
          <div className="mt-3"><Progress used={demo.used} total={demo.granted} /></div>
          <p className="mt-2 text-xs text-muted">{t('demo.usedCount', { used: demo.used, total: demo.granted })}</p>
          {needsVerify && <p className="mt-3 text-sm font-medium text-accent-ink">{t('demo.verifyFirst')}</p>}
          {done && <p className="mt-3 text-sm font-medium text-accent-ink">{t('demo.finished')}</p>}
        </>
      )}
      {!compact && <p className="mt-3 text-sm text-muted">{t('demo.explain')}</p>}
      <Link to="/sms-activation" className={`${done || notEligible ? 'btn-primary' : 'btn-secondary'} mt-4 w-full`}>{t('demo.activateCta')}<ArrowRight className="h-4 w-4" /></Link>
    </div>
  )
}
