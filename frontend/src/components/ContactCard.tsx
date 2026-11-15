import { Clock, Mail, MessageCircle, Phone } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import type { PaymentSettings } from '../lib/types'

/** Ways to reach the Promokote team (configured in Platform admin). With `reference`, messages are prefilled. */
export default function ContactCard({ settings, reference, compact = false }: { settings: PaymentSettings; reference?: string; compact?: boolean }) {
  const { t } = useI18n()
  const s = settings
  if (!s.supportPhone && !s.supportWhatsapp && !s.supportEmail) return null
  const text = reference ? t('contact.prefill', { ref: reference }) : t('contact.prefillGeneral')
  const wa = s.supportWhatsapp.replace(/\D/g, '')
  return (
    <div className={compact ? 'space-y-2' : 'card space-y-3'}>
      {!compact && (
        <div>
          <p className="font-semibold">{t('contact.title')}</p>
          <p className="text-sm text-muted">{reference ? t('contact.textOrder') : t('contact.text')}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {wa && <a className="btn-primary !py-2" href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
        {s.supportPhone && <a className="btn-secondary !py-2" href={`tel:${s.supportPhone.replace(/\s/g, '')}`}><Phone className="h-4 w-4" />{s.supportPhone}</a>}
        {s.supportEmail && <a className="btn-secondary !py-2" href={`mailto:${s.supportEmail}?subject=${encodeURIComponent(reference ? `Promokote ${reference}` : 'Promokote')}&body=${encodeURIComponent(text)}`}><Mail className="h-4 w-4" />{t('contact.email')}</a>}
      </div>
      {s.supportHours && <p className="flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3.5 w-3.5" />{s.supportHours}</p>}
    </div>
  )
}
