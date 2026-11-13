import { ReactNode, useState } from 'react'
import { AlertCircle, CheckCircle2, Copy, Check, Info, Loader2, X } from 'lucide-react'
import { TKey, useI18n } from '../lib/i18n'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-accent ${className}`} />
}
export function Loading() {
  const { t } = useI18n()
  return <div className="flex justify-center py-16" role="status" aria-label={t('common.loading')}><Spinner className="h-7 w-7" /></div>
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children?: ReactNode }) {
  if (!children) return null
  const styles = {
    error: 'border-danger/30 bg-danger-soft text-danger',
    success: 'border-success/30 bg-success-soft text-success',
    info: 'border-accent-line bg-accent-soft text-accent-ink',
  }
  const Icon = kind === 'success' ? CheckCircle2 : kind === 'info' ? Info : AlertCircle
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${styles[kind]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0">{children}</div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const OK = 'bg-success-soft text-success'
const WAIT = 'bg-accent-soft text-accent-ink'
const BAD = 'bg-danger-soft text-danger'
const NEUTRAL = 'bg-subtle text-muted'
const BADGES: Record<string, string> = {
  sent: OK, active: OK, completed: OK, approved: OK,
  queued: WAIT, sending: WAIT, pending: WAIT, scheduled: WAIT, running: WAIT, submitted: WAIT, under_review: WAIT, demo: WAIT,
  failed: BAD, rejected: BAD,
  blocked: NEUTRAL, cancelled: NEUTRAL, expired: NEUTRAL, draft: NEUTRAL, revoked: NEUTRAL,
}
/** Status pill. `children` is the status code; the label is translated. */
export function Badge({ children }: { children: string }) {
  const { t } = useI18n()
  const key = `status.${children}` as TKey
  const label = t(key)
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGES[children] ?? NEUTRAL}`}>{label === key ? children : label}</span>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="icon-btn !p-1" aria-label={t('common.close')}><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => { void navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}>
      {done ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}{done ? t('common.copied') : label ?? t('common.copy')}
    </button>
  )
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <p className="font-semibold text-fg">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Progress({ used, total }: { used: number; total: number }) {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-subtle"><tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 text-left font-semibold text-muted">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => <td className={`px-4 py-3 align-top ${className}`}>{children}</td>
