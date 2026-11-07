import { API_URL } from '../lib/api'
import { CopyButton, PageHeader } from '../components/ui'

function Code({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{children}</pre>
      <div className="absolute right-2 top-2"><CopyButton text={children} /></div>
    </div>
  )
}

export default function Docs() {
  const base = `${API_URL}/api/v1`
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="API documentation" subtitle="Send SMS and email from your own system using the key and secret from the API keys page." />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Authentication</h2>
        <p className="text-sm text-slate-600">Send both headers on every request. Keys can be limited to SMS, email or both. Requests are rate-limited per key according to your plan.</p>
        <Code>{`X-API-KEY: pk_live_xxxxxxxx\nX-API-SECRET: ps_xxxxxxxxxxxxxxxx`}</Code>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Send SMS</h2>
        <p className="text-sm text-slate-600"><code>to</code> is one number or a list (up to 1000). Numbers like 0712345678 are converted to +255 format. Each 160-character (GSM-7) or 70-character (Unicode) segment uses one credit.</p>
        <Code>{`curl -X POST ${base}/send-sms/ \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: YOUR_API_KEY" \\
  -H "X-API-SECRET: YOUR_API_SECRET" \\
  -H "Idempotency-Key: order-1042" \\
  -d '{
    "to": ["+255712345678", "0755111222"],
    "text": "Hello from Promokote!"
  }'`}</Code>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Send email</h2>
        <p className="text-sm text-slate-600"><code>recipient</code> is one address or a list (up to 100). Provide <code>html_body</code> (or <code>text_body</code>).</p>
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
        <h2 className="text-lg font-semibold">Response</h2>
        <Code>{`{
  "success": true,
  "messages": [
    { "id": "6f1c...", "channel": "sms", "recipient": "+255712345678",
      "status": "sent", "segments": 1, "error": null, "created_at": "2026-11-07T09:30:00+00:00" }
  ]
}`}</Code>
        <p className="text-sm text-slate-600">A status of <code>blocked</code> means the recipient opted out. Resending the same <code>Idempotency-Key</code> never sends or charges twice.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Other endpoints</h2>
        <Code>{`GET ${base}/messages/?channel=sms&status=failed&limit=50   # recent API messages
GET ${base}/messages/<id>/                                  # one message
GET ${base}/usage/                                          # remaining quota`}</Code>
        <p className="text-sm text-slate-600">Errors: <code>401</code> bad credentials, <code>402</code> quota used up, <code>403</code> key not allowed / service disabled, <code>400</code> invalid input, <code>429</code> rate limit.</p>
      </section>
    </div>
  )
}
