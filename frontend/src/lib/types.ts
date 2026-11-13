export interface Org { id: string; name: string; role: string; smsEnabled: boolean; emailEnabled: boolean; smsActivated: boolean; smsSenderId: string }
export interface User { id: string; email: string; fullName: string; emailVerified: boolean; isStaff: boolean; language: string; organization: Org | null }
export interface Plan {
  id: string; name: string; description: string; price: number; currency: string; periodDays: number
  smsQuota: number; emailQuota: number; rateLimitPerMinute: number; maxApiKeys: number
  isActive: boolean; isDefault: boolean; sortOrder: number
}
export interface Subscription {
  id: string; status: string; startsAt: string | null; endsAt: string | null; smsUsed: number; emailUsed: number
  plan: Plan; organizationName?: string
}
export interface ApiKey { id: string; name: string; service: string; key: string; secretHint: string; lastUsedAt: string | null; createdAt: string; isActive: boolean }
export interface Message {
  id: string; channel: string; source: string; recipient: string; subject: string; body: string
  segments: number; status: string; error: string; createdAt: string; sentAt: string | null; campaignName: string | null
  billingSource?: string; senderId?: string
}
export interface ContactList { id: string; name: string; contactCount: number; createdAt: string }
export interface Campaign {
  id: string; name: string; channel: string; subject: string; body: string; status: string
  scheduledAt: string | null; createdAt: string; listNames: string[]; total: number; sent: number; failed: number; blocked: number; queued: number
}
export interface DemoCredits {
  granted: number; used: number; remaining: number; active: boolean; ineligibleReason: string
  requiresVerifiedEmail: boolean; emailVerified: boolean; senderName: string
  history?: { id: string; kind: string; units: number; recipient: string | null; createdAt: string }[]
}
export interface ActivationConfig {
  senderIdFee: number; currency: string; processingDays: number; paymentInstructions: string; demoCredits: number; demoSenderName: string
}
export interface SenderIdRequest {
  id: string; senderId: string; businessName: string; registrationNumber: string; contactPhone: string; useCase: string
  sampleMessage: string; status: string; feeAmount: number; feeCurrency: string; feePaidAt: string | null; adminNote: string
  createdAt: string; reviewedAt: string | null; organizationId?: string; organizationName?: string; requestedByEmail?: string
}
