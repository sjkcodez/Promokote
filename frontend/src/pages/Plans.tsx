import { useState } from 'react'
import { Check } from 'lucide-react'
import { fmtDate, fmtMoney, gql, useQuery } from '../lib/api'
import type { Plan, Subscription } from '../lib/types'
import { Alert, Badge, Loading, PageHeader } from '../components/ui'

export default function Plans() {
  const { data, loading, error, reload } = useQuery<{ plans: Plan[]; subscription: Subscription | null; pendingSubscription: Subscription | null }>(`{
    plans { id name description price currency periodDays smsQuota emailQuota rateLimitPerMinute maxApiKeys }
    subscription { id status endsAt smsUsed emailUsed plan { id name } }
    pendingSubscription { id status plan { id name } }
  }`)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  async function choose(p: Plan) {
    try {
      const d = await gql('mutation($p:ID!){subscribe(planId:$p){subscription{status}}}', { p: p.id })
      setMsg({ kind: 'success', text: d.subscribe.subscription.status === 'active' ? `You are now on the ${p.name} plan.` : `Request received for ${p.name}. Pay ${fmtMoney(p.price, p.currency)} and our team will activate it - you can keep using your current plan meanwhile.` })
      void reload()
    } catch (x) { setMsg({ kind: 'error', text: (x as Error).message }) }
  }
  if (loading) return <Loading />
  const current = data?.subscription
  return (
    <div>
      <PageHeader title="Plan & billing" subtitle={current ? `Current plan: ${current.plan.name} - valid until ${fmtDate(current.endsAt)}` : 'Pick a plan to start sending.'} />
      <div className="mb-4 space-y-3">
        <Alert>{error}</Alert>{msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        {data?.pendingSubscription && <Alert kind="info">Awaiting activation: <b>{data.pendingSubscription.plan.name}</b> <Badge>pending</Badge></Alert>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data?.plans.map((p) => {
          const isCurrent = current?.plan.id === p.id
          return (
            <div key={p.id} className={`card flex flex-col ${isCurrent ? 'ring-2 ring-brand-500' : ''}`}>
              <p className="text-lg font-bold">{p.name}</p><p className="text-sm text-slate-500">{p.description}</p>
              <p className="my-4 text-3xl font-extrabold">{p.price === 0 ? 'Free' : fmtMoney(p.price, p.currency)}<span className="text-sm font-medium text-slate-500"> / {p.periodDays} days</span></p>
              <ul className="mb-5 flex-1 space-y-2 text-sm">
                {[`${p.smsQuota.toLocaleString()} SMS credits`, `${p.emailQuota.toLocaleString()} emails`, `${p.rateLimitPerMinute} API requests / min`, `${p.maxApiKeys} API keys`].map((t) => <li key={t} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{t}</li>)}
              </ul>
              <button className={isCurrent ? 'btn-secondary' : 'btn-primary'} disabled={isCurrent} onClick={() => choose(p)}>{isCurrent ? 'Current plan' : p.price === 0 ? 'Switch to this plan' : 'Request this plan'}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
