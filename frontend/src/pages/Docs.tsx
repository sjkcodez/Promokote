import { API_URL } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { CopyButton, PageHeader } from '../components/ui'

function Code({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-ink p-4 pr-24 text-xs leading-relaxed text-zinc-100">{children}</pre>
      <div className="absolute right-2 top-2"><CopyButton text={children} /></div>
    </div>
  )
}

export default function Docs() {
  const { t } = useI18n()
  const base = `${API_URL}/api/v1`
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title={t('docs.title')} subtitle={t('docs.subtitle')} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('docs.auth')}</h2>
        <p className="text-sm text-muted">{t('docs.authText')}</p>
        <Code>{`X-API-KEY: pk_live_xxxxxxxx\nX-API-SECRET: ps_xxxxxxxxxxxxxxxx`}</Code>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('docs.sms')}</h2>
        <p className="text-sm text-muted">{t('docs.smsText')}</p>
        <Code>{`curl -X POST ${base}/send-sms/ \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: YOUR_API_KEY" \\
  -H "X-API-SECRET: YOUR_API_SECRET" \\
  -H "Idempotency-Key: order-1042" \\
  -d '{
    "to": ["+255712345678", "0755111222"],
    "text": "Hello from Promokote!"
  }'`}</Code>
        <p className="text-sm text-muted">{t('docs.smsDemo')}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('docs.email')}</h2>
        <p className="text-sm text-muted">{t('docs.emailText')}</p>
        <Code>{`curl -X POST ${base}/send-email/ \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: YOUR_API_KEY" \\
  -H "X-API-SECRET: YOUR_API_SECRET" \\
  -d '{
    "recipient": "customer@example.com",
    "subject": "Welcome!",
    "html_body": "<h1>Hello</h1><p>Thanks for joining.</p>"
  }'`}</Code>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('docs.response')}</h2>
        <Code>{`{
  "success": true,
  "messages": [
    { "id": "6f1c...", "channel": "sms", "recipient": "+255712345678",
      "status": "sent", "segments": 1, "error": null, "created_at": "2026-11-07T09:30:00+00:00" }
  ]
}`}</Code>
        <p className="text-sm text-muted">{t('docs.responseText')}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('docs.other')}</h2>
        <Code>{`GET ${base}/messages/?channel=sms&status=failed&limit=50   # recent API messages
GET ${base}/messages/<id>/                                  # one message
GET ${base}/usage/                                          # remaining quota + sms_mode / sms_demo`}</Code>
        <p className="text-sm text-muted">{t('docs.errors')}</p>
      </section>
    </div>
  )
}
