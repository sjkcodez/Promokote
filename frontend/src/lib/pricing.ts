import type { CreditPrice } from './types'

export const PAYMENT_FIELDS = 'currency paymentInstructions supportPhone supportWhatsapp supportEmail supportHours maxOrderQuantity'
export const ORDER_FIELDS = 'id reference smsQuantity emailQuantity smsUnitPrice emailUnitPrice total currency status paymentReference paymentNote paidAt adminNote reviewedAt createdAt'

/** Instant estimate shown while typing. Mirrors backend billing/credits.py; the server recalculates on order. */
export function estimate(prices: CreditPrice[], channel: 'sms' | 'email', qty: number) {
  const tiers = prices.filter((p) => p.channel === channel).sort((a, b) => a.minQuantity - b.minQuantity)
  const min = tiers[0]?.minQuantity ?? null
  let unit: number | null = null
  for (const t of tiers) if (qty >= t.minQuantity) unit = t.unitPrice
  return { tiers, min, unit, subtotal: unit !== null ? Math.round(unit * qty * 100) / 100 : 0, onSale: tiers.length > 0 }
}
