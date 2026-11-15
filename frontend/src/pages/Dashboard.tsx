import { Link } from 'react-router-dom'
import { Ban, KeyRound, Mail, MessageSquare, Send, Users, Wallet } from 'lucide-react'
import { fmtDate, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import type { DemoCredits, Message, Subscription } from '../lib/types'
import DemoCard, { DEMO_FIELDS } from '../components/DemoCard'
import { Alert, Badge, Empty, Loading, PageHeader, Progress, Table, Td } from '../components/ui'

interface Data {
  subscription: Subscription | null
  pendingSubscription: { plan: { name: string } } | null
  dashboard: { smsSent: number; emailSent: number; failed: number; blocked: number; contacts: number; campaigns: number }
  messages: Message[]
  demoCredits: DemoCredits
  creditBalance: { sms: number; email: number }
  creditOrders: { reference: string; status: string }[]
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useI18n()
  const { data, loading, error } = useQuery<Data>(`{
    subscription { id status endsAt smsUsed emailUsed plan { name smsQuota emailQuota } }
    pendingSubscription { plan { name } }
    dashboard { smsSent emailSent failed blocked contacts campaigns }
    messages(limit: 6) { id channel recipient status createdAt billingSource }
    demoCredits { ${DEMO_FIELDS} }
    creditBalance { sms email }
    creditOrders { reference status }
  }`)
  if (loading) return <Loading />
  if (error || !data) return <Alert>{error}</Alert>
  const { subscription: sub, dashboard: d, demoCredits: demo } = data
  const inDemo = demo.active

  const usage = (label: string, used: number, total: number, Icon: typeof Mail) => (
    <div key={label} className="card">
      <div className="flex items-center justify-between gap-2"><p className="flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-accent" />{label}</p><p className="text-sm text-muted">{t('dash.planName', { name: sub!.plan.name })}</p></div>
      <p className="mt-3 text-3xl font-bold">{(total - used).toLocaleString()} <span className="text-base font-medium text-muted">{t('dash.leftOf', { total: total.toLocaleString() })}</span></p>
      <div className="mt-3"><Progress used={used} total={total} /></div>
      <p className="mt-2 text-xs text-muted">{t('dash.renews', { date: fmtDate(sub!.endsAt) })}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t('dash.hello', { name: user?.fullName.split(' ')[0] || t('dash.there') })} subtitle={t('dash.subtitle')}
        action={<Link to="/send" className="btn-primary"><Send className="h-4 w-4" />{t('dash.send')}</Link>} />

      {!sub && <Alert kind="info">{t('dash.noPlan')} <Link className="font-semibold underline" to="/buy-credits">{t('dash.buyOrPlan')}</Link></Alert>}
      {data.creditOrders.filter((o) => o.status === 'pending_payment' || o.status === 'payment_submitted').map((o) => (
        <Alert key={o.reference} kind="info">{t(o.status === 'pending_payment' ? 'dash.orderUnpaid' : 'dash.orderChecking', { ref: o.reference })} <Link className="font-semibold underline" to="/buy-credits">{t('dash.viewOrder')}</Link></Alert>
      ))}
      {data.pendingSubscription && <Alert kind="info">{t('dash.pending', { name: data.pendingSubscription.plan.name })}</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        {inDemo ? <DemoCard demo={demo} /> : sub && usage(t('dash.smsCredits'), sub.smsUsed, sub.plan.smsQuota, MessageSquare)}
        {sub && usage(t('dash.emails'), sub.emailUsed, sub.plan.emailQuota, Mail)}
      </div>

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 shrink-0 text-accent" />
          <div><p className="font-semibold">{t('buy.balance')}</p><p className="text-sm text-muted">{t('dash.bought', { sms: data.creditBalance.sms.toLocaleString(), email: data.creditBalance.email.toLocaleString() })}</p></div>
        </div>
        <Link to="/buy-credits" className="btn-primary">{t('nav.buy')}</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([[t('dash.stat.sms'), d.smsSent, MessageSquare], [t('dash.stat.email'), d.emailSent, Mail], [t('dash.stat.contacts'), d.contacts, Users], [t('dash.stat.blocked'), d.blocked, Ban]] as const).map(([l, v, Icon]) => (
          <div key={l} className="card"><Icon className="h-5 w-5 text-accent" /><p className="mt-2 text-2xl font-bold">{v.toLocaleString()}</p><p className="text-sm text-muted">{l}</p></div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{t('dash.recent')}</h2><Link to="/messages" className="link text-sm">{t('dash.viewAll')}</Link></div>
        {data.messages.length === 0 ? (
          <Empty title={t('dash.empty.title')} text={t('dash.empty.text')}
            action={<div className="flex flex-wrap justify-center gap-2"><Link to="/send" className="btn-primary">{t('nav.send')}</Link><Link to="/api-keys" className="btn-secondary"><KeyRound className="h-4 w-4" />{t('dash.getKey')}</Link></div>} />
        ) : (
          <Table head={[t('col.channel'), t('col.recipient'), t('col.status'), t('col.when')]}>
            {data.messages.map((m) => <tr key={m.id}><Td className="uppercase">{m.channel}{m.billingSource === 'demo' && <span className="ml-2"><Badge>demo</Badge></span>}</Td><Td>{m.recipient}</Td><Td><Badge>{m.status}</Badge></Td><Td className="whitespace-nowrap">{fmtDate(m.createdAt)}</Td></tr>)}
          </Table>
        )}
      </div>
    </div>
  )
}
