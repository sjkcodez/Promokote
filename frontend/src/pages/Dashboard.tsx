import { Link } from 'react-router-dom'
import { Ban, KeyRound, Mail, MessageSquare, Send, Users } from 'lucide-react'
import { fmtDate, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Message, Subscription } from '../lib/types'
import { Alert, Badge, Empty, Loading, PageHeader, Progress, Table, Td } from '../components/ui'

interface Data {
  subscription: Subscription | null
  pendingSubscription: { plan: { name: string } } | null
  dashboard: { smsSent: number; emailSent: number; failed: number; blocked: number; contacts: number; campaigns: number }
  messages: Message[]
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, loading, error } = useQuery<Data>(`{
    subscription { id status endsAt smsUsed emailUsed plan { name smsQuota emailQuota } }
    pendingSubscription { plan { name } }
    dashboard { smsSent emailSent failed blocked contacts campaigns }
    messages(limit: 6) { id channel recipient status createdAt }
  }`)
  if (loading) return <Loading />
  if (error || !data) return <Alert>{error}</Alert>
  const { subscription: sub, dashboard: d } = data

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${user?.fullName.split(' ')[0] || 'there'}`} subtitle="Here is what is happening in your account."
        action={<Link to="/send" className="btn-primary"><Send className="h-4 w-4" />Send a message</Link>} />

      {!sub && <Alert kind="info">You have no active plan. <Link className="font-semibold underline" to="/plans">Choose a plan</Link> to start sending.</Alert>}
      {data.pendingSubscription && <Alert kind="info">Your <b>{data.pendingSubscription.plan.name}</b> plan is waiting for payment confirmation. It activates as soon as the Promokote team confirms it.</Alert>}

      {sub && (
        <div className="grid gap-4 md:grid-cols-2">
          {([['SMS credits', sub.smsUsed, sub.plan.smsQuota, MessageSquare], ['Emails', sub.emailUsed, sub.plan.emailQuota, Mail]] as const).map(([label, used, total, Icon]) => (
            <div key={label} className="card">
              <div className="flex items-center justify-between"><p className="flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-brand-600" />{label}</p><p className="text-sm text-slate-500">{sub.plan.name} plan</p></div>
              <p className="mt-3 text-3xl font-bold">{(total - used).toLocaleString()} <span className="text-base font-medium text-slate-500">left of {total.toLocaleString()}</span></p>
              <div className="mt-3"><Progress used={used} total={total} /></div>
              <p className="mt-2 text-xs text-slate-500">Renews / expires {fmtDate(sub.endsAt)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[['SMS sent', d.smsSent, MessageSquare], ['Emails sent', d.emailSent, Mail], ['Contacts', d.contacts, Users], ['Opted out / blocked', d.blocked, Ban]].map(([l, v, I]) => {
          const Icon = I as typeof Mail
          return <div key={l as string} className="card"><Icon className="h-5 w-5 text-brand-600" /><p className="mt-2 text-2xl font-bold">{(v as number).toLocaleString()}</p><p className="text-sm text-slate-500">{l as string}</p></div>
        })}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent messages</h2><Link to="/messages" className="text-sm font-medium text-brand-600 hover:underline">View all</Link></div>
        {data.messages.length === 0 ? (
          <Empty title="Nothing sent yet" text="Send a test SMS or email, or create an API key to send from your own system."
            action={<div className="flex justify-center gap-2"><Link to="/send" className="btn-primary">Quick send</Link><Link to="/api-keys" className="btn-secondary"><KeyRound className="h-4 w-4" />Get API key</Link></div>} />
        ) : (
          <Table head={['Channel', 'Recipient', 'Status', 'When']}>
            {data.messages.map((m) => <tr key={m.id}><Td className="capitalize">{m.channel}</Td><Td>{m.recipient}</Td><Td><Badge>{m.status}</Badge></Td><Td>{fmtDate(m.createdAt)}</Td></tr>)}
          </Table>
        )}
      </div>
    </div>
  )
}
