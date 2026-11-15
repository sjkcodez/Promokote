import { FormEvent, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { fmtDate, fmtMoney, gql, useQuery } from '../lib/api'
import { useI18n } from '../lib/i18n'
import type { ActivationConfig, CreditOrder, CreditPrice, PaymentSettings, Plan, SenderIdRequest, Subscription } from '../lib/types'
import { ORDER_FIELDS, PAYMENT_FIELDS } from '../lib/pricing'
import { Alert, Badge, Field, Loading, Modal, PageHeader, Table, Td } from '../components/ui'

interface Org { id: string; name: string; ownerEmail: string; planName: string; subscriptionStatus: string; smsEnabled: boolean; emailEnabled: boolean; isSuspended: boolean; messagesSent: number; createdAt: string; smsActivated: boolean; smsSenderId: string; demoUsed: number; demoGranted: number }
interface Data {
  adminStats: { organizations: number; users: number; messagesSent: number; pendingSubscriptions: number }
  adminPlans: Plan[]; adminOrganizations: Org[]; pending: (Subscription & { organizationName: string; organization?: { id: string } })[]
  adminSenderIdRequests: SenderIdRequest[]; smsActivationConfig: ActivationConfig
  adminCreditOrders: CreditOrder[]; creditPrices: CreditPrice[]; paymentSettings: PaymentSettings
}

const BLANK = { id: '', name: '', description: '', price: 0, currency: 'TZS', periodDays: 30, smsQuota: 100, emailQuota: 500, rateLimitPerMinute: 60, maxApiKeys: 3, isActive: true, isDefault: false, sortOrder: 0 }
const Q = `{
  adminStats { organizations users messagesSent pendingSubscriptions }
  adminPlans { id name description price currency periodDays smsQuota emailQuota rateLimitPerMinute maxApiKeys isActive isDefault sortOrder }
  adminOrganizations { id name ownerEmail planName subscriptionStatus smsEnabled emailEnabled isSuspended messagesSent createdAt smsActivated smsSenderId demoUsed demoGranted }
  adminSenderIdRequests { id senderId businessName registrationNumber contactPhone useCase sampleMessage status feeAmount feeCurrency feePaidAt adminNote createdAt organizationName requestedByEmail }
  smsActivationConfig { senderIdFee currency processingDays paymentInstructions }
  adminCreditOrders { ${ORDER_FIELDS} organizationName organizationSmsActivated requestedByEmail }
  creditPrices { channel minQuantity unitPrice }
  paymentSettings { ${PAYMENT_FIELDS} }
}`

export default function Admin() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useQuery<Data>(Q)
  const [plan, setPlan] = useState<typeof BLANK | null>(null)
  const [assign, setAssign] = useState<Org | null>(null)
  const [assignPlan, setAssignPlan] = useState('')
  const [days, setDays] = useState('')
  const [err, setErr] = useState('')
  const [review, setReview] = useState<SenderIdRequest | null>(null)
  const [note, setNote] = useState('')
  const [cfg, setCfg] = useState<ActivationConfig | null>(null)
  const [cfgMsg, setCfgMsg] = useState('')
  const [order, setOrder] = useState<CreditOrder | null>(null)
  const [orderNote, setOrderNote] = useState('')
  const [pay, setPay] = useState<PaymentSettings | null>(null)
  const [tiers, setTiers] = useState<{ channel: 'sms' | 'email'; rows: { minQuantity: string; unitPrice: string }[] } | null>(null)
  const [orderFilter, setOrderFilter] = useState('open')

  async function savePlan(e: FormEvent) {
    e.preventDefault(); setErr('')
    const { id, ...rest } = plan!
    try {
      await gql('mutation($i:PlanInput!){upsertPlan(input:$i){plan{id}}}', { i: { ...(id ? { id } : {}), ...rest } }); setPlan(null); void reload()
    } catch (x) { setErr((x as Error).message) }
  }
  async function doAssign(e: FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await gql('mutation($o:ID!,$p:ID!,$d:Int){setSubscription(organizationId:$o,planId:$p,days:$d){subscription{id}}}', { o: assign!.id, p: assignPlan, d: days ? Number(days) : null }); setAssign(null); void reload()
    } catch (x) { setErr((x as Error).message) }
  }
  async function toggle(o: Org, field: 'smsEnabled' | 'emailEnabled' | 'isSuspended') {
    await gql(`mutation($i:ID!,$v:Boolean){updateOrganization(id:$i,${field}:$v){ok}}`, { i: o.id, v: !o[field] }); void reload()
  }
  async function act(action: 'confirm_payment' | 'approve' | 'reject') {
    setErr('')
    try {
      await gql('mutation($i:ID!,$a:String!,$n:String){reviewSenderIdRequest(id:$i,action:$a,note:$n){request{id}}}', { i: review!.id, a: action, n: note })
      setReview(null); setNote(''); void reload()
    } catch (x) { setErr((x as Error).message) }
  }
  async function saveCfg(e: FormEvent) {
    e.preventDefault(); setCfgMsg('')
    try {
      await gql('mutation($f:Float!,$c:String,$d:Int!,$p:String){updateSmsActivationConfig(senderIdFee:$f,currency:$c,processingDays:$d,paymentInstructions:$p){config{senderIdFee}}}',
        { f: Number(cfg!.senderIdFee), c: cfg!.currency, d: Number(cfg!.processingDays), p: cfg!.paymentInstructions })
      setCfg(null); setCfgMsg(t('admin.cfg.saved')); void reload()
    } catch (x) { setCfgMsg((x as Error).message) }
  }
  async function reviewOrder(action: 'approve' | 'reject') {
    setErr('')
    try {
      await gql('mutation($i:ID!,$a:String!,$n:String){reviewCreditOrder(id:$i,action:$a,note:$n){order{id}}}', { i: order!.id, a: action, n: orderNote })
      setOrder(null); setOrderNote(''); void reload()
    } catch (x) { setErr((x as Error).message) }
  }
  async function savePay(e: FormEvent) {
    e.preventDefault(); setErr('')
    const { currency, paymentInstructions, supportPhone, supportWhatsapp, supportEmail, supportHours, maxOrderQuantity } = pay!
    try {
      await gql('mutation($c:String,$p:String,$ph:String,$w:String,$e:String,$h:String,$m:Int){updatePaymentSettings(currency:$c,paymentInstructions:$p,supportPhone:$ph,supportWhatsapp:$w,supportEmail:$e,supportHours:$h,maxOrderQuantity:$m){settings{currency}}}',
        { c: currency, p: paymentInstructions, ph: supportPhone, w: supportWhatsapp, e: supportEmail, h: supportHours, m: Number(maxOrderQuantity) })
      setPay(null); void reload()
    } catch (x) { setErr((x as Error).message) }
  }
  async function saveTiers(e: FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await gql('mutation($c:String!,$t:[PriceTierInput!]!){setCreditPrices(channel:$c,tiers:$t){prices{minQuantity}}}',
        { c: tiers!.channel, t: tiers!.rows.filter((r) => r.minQuantity && r.unitPrice).map((r) => ({ minQuantity: Number(r.minQuantity), unitPrice: Number(r.unitPrice) })) })
      setTiers(null); void reload()
    } catch (x) { setErr((x as Error).message) }
  }
  const num = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => setPlan({ ...plan!, [k]: Number(e.target.value) })
  if (loading) return <Loading />
  if (!data) return <Alert>{error}</Alert>
  const s = data.adminStats
  const openReqs = data.adminSenderIdRequests.filter((r) => r.status === 'submitted' || r.status === 'under_review')
  const c = data.smsActivationConfig
  const isOpen = (o: CreditOrder) => o.status === 'pending_payment' || o.status === 'payment_submitted'
  const orders = data.adminCreditOrders.filter((o) => orderFilter === 'all' || (orderFilter === 'open' ? isOpen(o) : o.status === orderFilter))
  const ps = data.paymentSettings
  const editTiers = (channel: 'sms' | 'email') => { setErr(''); setTiers({ channel, rows: [...data.creditPrices.filter((p) => p.channel === channel).map((p) => ({ minQuantity: String(p.minQuantity), unitPrice: String(p.unitPrice) })), { minQuantity: '', unitPrice: '' }] }) }

  return (
    <div className="space-y-10">
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {([[t('admin.stat.orgs'), s.organizations], [t('admin.stat.users'), s.users], [t('admin.stat.sent'), s.messagesSent], [t('admin.stat.pending'), s.pendingSubscriptions], [t('admin.stat.sender'), openReqs.length], [t('admin.orders.title'), data.adminCreditOrders.filter(isOpen).length]] as const).map(([l, v]) => <div key={l} className="card"><p className="text-2xl font-bold">{v.toLocaleString()}</p><p className="text-sm text-muted">{l}</p></div>)}
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('admin.orders.title')}</h2>
          <select className="input !w-auto" value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} aria-label={t('col.status')}>
            <option value="open">{t('admin.orders.open')}</option><option value="approved">{t('status.approved')}</option><option value="rejected">{t('status.rejected')}</option><option value="all">{t('admin.orders.all')}</option>
          </select>
        </div>
        {orders.length === 0 ? <p className="text-sm text-muted">{t('admin.orders.none')}</p> : (
          <Table head={[t('buy.reference'), t('admin.col.org'), t('admin.orders.items'), t('buy.total'), t('buy.txn'), t('col.status'), t('col.created'), '']}>
            {orders.map((o) => (
              <tr key={o.id}>
                <Td className="font-mono font-semibold">{o.reference}</Td>
                <Td>{o.organizationName}<p className="text-xs text-muted">{o.requestedByEmail}</p></Td>
                <Td className="whitespace-nowrap">{[o.smsQuantity ? `${o.smsQuantity.toLocaleString()} SMS` : '', o.emailQuantity ? `${o.emailQuantity.toLocaleString()} ${t('common.email')}` : ''].filter(Boolean).join(' + ')}</Td>
                <Td className="whitespace-nowrap font-semibold">{fmtMoney(o.total, o.currency)}</Td>
                <Td>{o.paymentReference || '-'}</Td><Td><Badge>{o.status}</Badge></Td><Td className="whitespace-nowrap">{fmtDate(o.createdAt)}</Td>
                <Td>{isOpen(o) && <button className="btn-primary !px-3 !py-1.5" onClick={() => { setOrder(o); setOrderNote(''); setErr('') }}>{t('admin.sender.review')}</button>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {(['sms', 'email'] as const).map((ch) => (
          <div key={ch} className="card">
            <div className="flex items-center justify-between gap-2"><p className="font-semibold">{t('admin.tiers.title', { what: ch === 'sms' ? 'SMS' : t('common.email') })}</p><button className="icon-btn" onClick={() => editTiers(ch)} aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></button></div>
            <ul className="mt-2 space-y-1 text-sm">
              {data.creditPrices.filter((p) => p.channel === ch).map((p) => <li key={p.minQuantity} className="flex justify-between"><span className="text-muted">{p.minQuantity.toLocaleString()}+</span><span className="font-semibold">{fmtMoney(p.unitPrice, ps.currency)}</span></li>)}
              {!data.creditPrices.some((p) => p.channel === ch) && <li className="text-muted">{t('admin.tiers.none')}</li>}
            </ul>
          </div>
        ))}
        <div className="card">
          <div className="flex items-center justify-between gap-2"><p className="font-semibold">{t('admin.pay.title')}</p><button className="icon-btn" onClick={() => { setErr(''); setPay({ ...ps }) }} aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></button></div>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>WhatsApp: {ps.supportWhatsapp || '-'}</li><li>{t('act.f.phone')}: {ps.supportPhone || '-'}</li><li>{t('auth.email')}: {ps.supportEmail || '-'}</li>
            {!ps.paymentInstructions && <li className="text-danger">{t('admin.pay.missing')}</li>}
          </ul>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('admin.sender.title')}</h2>
          <button className="btn-secondary" onClick={() => { setCfg({ ...c }); setCfgMsg('') }}>{t('admin.cfg.edit')}</button>
        </div>
        <p className="mb-3 text-sm text-muted">{t('admin.cfg.line', { fee: c.senderIdFee > 0 ? fmtMoney(c.senderIdFee, c.currency) : t('act.feeTbc'), days: c.processingDays })}</p>
        {cfgMsg && <div className="mb-3"><Alert kind="success">{cfgMsg}</Alert></div>}
        {data.adminSenderIdRequests.length === 0 ? <p className="text-sm text-muted">{t('admin.sender.none')}</p> : (
          <Table head={[t('act.f.sender'), t('admin.col.org'), t('act.f.business'), t('act.f.reg'), t('col.status'), t('act.sentOn'), '']}>
            {data.adminSenderIdRequests.map((r) => (
              <tr key={r.id}>
                <Td className="font-semibold">{r.senderId}</Td><Td>{r.organizationName}<p className="text-xs text-muted">{r.requestedByEmail}</p></Td>
                <Td>{r.businessName}</Td><Td>{r.registrationNumber}</Td><Td><Badge>{r.status}</Badge></Td><Td className="whitespace-nowrap">{fmtDate(r.createdAt)}</Td>
                <Td>{(r.status === 'submitted' || r.status === 'under_review') && <button className="btn-primary !px-3 !py-1.5" onClick={() => { setReview(r); setNote(''); setErr('') }}>{t('admin.sender.review')}</button>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{t('admin.plans')}</h2><button className="btn-primary" onClick={() => { setPlan({ ...BLANK }); setErr('') }}><Plus className="h-4 w-4" />{t('admin.newPlan')}</button></div>
        <Table head={[t('admin.col.plan'), t('plans.col.price'), t('plans.col.period'), t('common.sms'), t('dash.emails'), t('admin.col.rate'), t('admin.col.keys'), t('col.status'), '']}>
          {data.adminPlans.map((p) => (
            <tr key={p.id}>
              <Td className="font-medium">{p.name}{p.isDefault && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent-ink">{t('admin.default')}</span>}</Td>
              <Td>{p.price === 0 ? t('plans.free') : fmtMoney(p.price, p.currency)}</Td><Td>{p.periodDays}d</Td><Td>{p.smsQuota.toLocaleString()}</Td><Td>{p.emailQuota.toLocaleString()}</Td><Td>{p.rateLimitPerMinute}</Td><Td>{p.maxApiKeys}</Td>
              <Td><Badge>{p.isActive ? 'active' : 'cancelled'}</Badge></Td>
              <Td><button className="icon-btn" onClick={() => { setPlan({ ...BLANK, ...p, description: p.description ?? '' }); setErr('') }} aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></button></Td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('admin.orgs')}</h2>
        <Table head={[t('admin.col.org'), t('admin.col.owner'), t('admin.col.plan'), t('admin.col.smsMode'), t('admin.col.sent'), t('common.sms'), t('common.email'), t('admin.col.suspended'), t('admin.col.joined'), '']}>
          {data.adminOrganizations.map((o) => (
            <tr key={o.id}>
              <Td className="font-medium">{o.name}</Td><Td>{o.ownerEmail}</Td>
              <Td>{o.planName || '-'} {o.subscriptionStatus === 'pending' && <Badge>pending</Badge>}</Td>
              <Td className="whitespace-nowrap">{o.smsActivated ? <><Badge>active</Badge> <span className="text-xs text-muted">{o.smsSenderId}</span></> : <><Badge>demo</Badge> <span className="text-xs text-muted">{o.demoUsed}/{o.demoGranted}</span></>}</Td>
              <Td>{o.messagesSent}</Td>
              {(['smsEnabled', 'emailEnabled', 'isSuspended'] as const).map((f) => <Td key={f}><input type="checkbox" className="h-4 w-4 accent-brand-500" checked={o[f]} onChange={() => toggle(o, f)} aria-label={f} /></Td>)}
              <Td className="whitespace-nowrap">{fmtDate(o.createdAt)}</Td>
              <Td><button className="btn-secondary !px-3 !py-1.5" onClick={() => { setAssign(o); setAssignPlan(data.adminPlans[0]?.id ?? ''); setDays(''); setErr('') }}>{o.subscriptionStatus === 'pending' ? t('admin.activate') : t('admin.setPlan')}</button></Td>
            </tr>
          ))}
        </Table>
      </section>

      {review && (
        <Modal title={t('admin.sender.reviewTitle', { sender: review.senderId })} onClose={() => setReview(null)}>
          <div className="space-y-4">
            <Alert>{err}</Alert>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">{t('admin.col.org')}</dt><dd>{review.organizationName} ({review.requestedByEmail})</dd>
              <dt className="text-muted">{t('act.f.business')}</dt><dd>{review.businessName}</dd>
              <dt className="text-muted">{t('act.f.reg')}</dt><dd>{review.registrationNumber}</dd>
              <dt className="text-muted">{t('act.f.phone')}</dt><dd>{review.contactPhone}</dd>
              <dt className="text-muted">{t('act.f.use')}</dt><dd className="whitespace-pre-line">{review.useCase}</dd>
              <dt className="text-muted">{t('act.f.sample')}</dt><dd className="whitespace-pre-line">{review.sampleMessage}</dd>
              <dt className="text-muted">{t('act.fee')}</dt><dd>{review.feeAmount > 0 ? fmtMoney(review.feeAmount, review.feeCurrency) : t('act.feeTbc')} {review.feePaidAt && <span className="text-success">· {t('act.paid')}</span>}</dd>
            </dl>
            <Field label={t('admin.sender.note')} hint={t('admin.sender.noteHint')}><textarea className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="grid gap-2 sm:grid-cols-3">
              {review.status === 'submitted' && <button className="btn-secondary" onClick={() => act('confirm_payment')}>{t('admin.sender.confirmPay')}</button>}
              <button className="btn-primary" onClick={() => act('approve')}>{t('admin.sender.approve')}</button>
              <button className="btn-danger" onClick={() => act('reject')}>{t('admin.sender.reject')}</button>
            </div>
          </div>
        </Modal>
      )}
      {order && (
        <Modal title={t('admin.orders.reviewTitle', { ref: order.reference })} onClose={() => setOrder(null)}>
          <div className="space-y-4">
            <Alert>{err}</Alert>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">{t('admin.col.org')}</dt><dd>{order.organizationName} ({order.requestedByEmail})</dd>
              {order.smsQuantity > 0 && <><dt className="text-muted">SMS</dt><dd>{order.smsQuantity.toLocaleString()} × {fmtMoney(order.smsUnitPrice, order.currency)}</dd></>}
              {order.emailQuantity > 0 && <><dt className="text-muted">{t('common.email')}</dt><dd>{order.emailQuantity.toLocaleString()} × {fmtMoney(order.emailUnitPrice, order.currency)}</dd></>}
              <dt className="text-muted">{t('buy.total')}</dt><dd className="font-bold">{fmtMoney(order.total, order.currency)}</dd>
              <dt className="text-muted">{t('buy.txn')}</dt><dd>{order.paymentReference || t('admin.orders.notPaid')}</dd>
              <dt className="text-muted">{t('admin.col.smsMode')}</dt><dd>{order.organizationSmsActivated ? <Badge>active</Badge> : <Badge>demo</Badge>}</dd>
            </dl>
            {order.smsQuantity > 0 && !order.organizationSmsActivated && <Alert kind="info">{t('admin.orders.noSender')}</Alert>}
            <Alert kind="info">{t('admin.orders.verify')}</Alert>
            <Field label={t('admin.sender.note')} hint={t('admin.sender.noteHint')}><textarea className="input min-h-[70px]" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} /></Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn-primary" onClick={() => reviewOrder('approve')}>{t('admin.orders.approve')}</button>
              <button className="btn-danger" onClick={() => reviewOrder('reject')}>{t('admin.sender.reject')}</button>
            </div>
          </div>
        </Modal>
      )}
      {tiers && (
        <Modal title={t('admin.tiers.title', { what: tiers.channel === 'sms' ? 'SMS' : t('common.email') })} onClose={() => setTiers(null)}>
          <form onSubmit={saveTiers} className="space-y-3">
            <Alert>{err}</Alert>
            <p className="text-sm text-muted">{t('admin.tiers.help')}</p>
            {tiers.rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <Field label={t('admin.tiers.from')}><input className="input" type="number" min={1} value={r.minQuantity} onChange={(e) => setTiers({ ...tiers, rows: tiers.rows.map((x, j) => (j === i ? { ...x, minQuantity: e.target.value } : x)) })} /></Field>
                <Field label={t('admin.tiers.price', { cur: ps.currency })}><input className="input" type="number" min={0} step="0.01" value={r.unitPrice} onChange={(e) => setTiers({ ...tiers, rows: tiers.rows.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)) })} /></Field>
              </div>
            ))}
            <button type="button" className="btn-secondary w-full" onClick={() => setTiers({ ...tiers, rows: [...tiers.rows, { minQuantity: '', unitPrice: '' }] })}><Plus className="h-4 w-4" />{t('admin.tiers.add')}</button>
            <button className="btn-primary w-full">{t('common.save')}</button>
          </form>
        </Modal>
      )}
      {pay && (
        <Modal title={t('admin.pay.title')} onClose={() => setPay(null)}>
          <form onSubmit={savePay} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Alert>{err}</Alert></div>
            <div className="sm:col-span-2"><Field label={t('admin.cfg.pay')} hint={t('admin.pay.instrHint')}><textarea className="input min-h-[100px]" value={pay.paymentInstructions} onChange={(e) => setPay({ ...pay, paymentInstructions: e.target.value })} /></Field></div>
            <Field label="WhatsApp" hint="+255712345678"><input className="input" value={pay.supportWhatsapp} onChange={(e) => setPay({ ...pay, supportWhatsapp: e.target.value })} /></Field>
            <Field label={t('act.f.phone')}><input className="input" value={pay.supportPhone} onChange={(e) => setPay({ ...pay, supportPhone: e.target.value })} /></Field>
            <Field label={t('auth.email')} hint={t('admin.pay.emailHint')}><input className="input" type="email" value={pay.supportEmail} onChange={(e) => setPay({ ...pay, supportEmail: e.target.value })} /></Field>
            <Field label={t('admin.pay.hours')}><input className="input" value={pay.supportHours} onChange={(e) => setPay({ ...pay, supportHours: e.target.value })} placeholder={t('admin.pay.hoursPh')} /></Field>
            <Field label={t('admin.cfg.currency')}><input className="input" maxLength={5} value={pay.currency} onChange={(e) => setPay({ ...pay, currency: e.target.value })} /></Field>
            <Field label={t('admin.pay.max')}><input className="input" type="number" min={1} value={pay.maxOrderQuantity} onChange={(e) => setPay({ ...pay, maxOrderQuantity: Number(e.target.value) })} /></Field>
            <div className="sm:col-span-2"><button className="btn-primary w-full">{t('common.save')}</button></div>
          </form>
        </Modal>
      )}
      {cfg && (
        <Modal title={t('admin.cfg.title')} onClose={() => setCfg(null)}>
          <form onSubmit={saveCfg} className="grid grid-cols-2 gap-4">
            <Field label={t('admin.cfg.fee')}><input className="input" type="number" min={0} required value={cfg.senderIdFee} onChange={(e) => setCfg({ ...cfg, senderIdFee: Number(e.target.value) })} /></Field>
            <Field label={t('admin.cfg.currency')}><input className="input" maxLength={5} value={cfg.currency} onChange={(e) => setCfg({ ...cfg, currency: e.target.value })} /></Field>
            <div className="col-span-2"><Field label={t('admin.cfg.days')}><input className="input" type="number" min={1} required value={cfg.processingDays} onChange={(e) => setCfg({ ...cfg, processingDays: Number(e.target.value) })} /></Field></div>
            <div className="col-span-2"><Field label={t('admin.cfg.pay')} hint={t('admin.cfg.payHint')}><textarea className="input min-h-[90px]" value={cfg.paymentInstructions} onChange={(e) => setCfg({ ...cfg, paymentInstructions: e.target.value })} /></Field></div>
            <div className="col-span-2"><button className="btn-primary w-full">{t('common.save')}</button></div>
          </form>
        </Modal>
      )}
      {plan && (
        <Modal title={plan.id ? t('admin.editPlan') : t('admin.newPlan')} onClose={() => setPlan(null)}>
          <form onSubmit={savePlan} className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Alert>{err}</Alert></div>
            <div className="col-span-2"><Field label={t('admin.f.name')}><input className="input" required value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} /></Field></div>
            <div className="col-span-2"><Field label={t('admin.f.desc')}><input className="input" value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} /></Field></div>
            <Field label={t('admin.f.price')}><input className="input" type="number" min={0} required value={plan.price} onChange={num('price')} /></Field>
            <Field label={t('admin.f.period')}><input className="input" type="number" min={1} required value={plan.periodDays} onChange={num('periodDays')} /></Field>
            <Field label={t('plans.col.sms')}><input className="input" type="number" min={0} required value={plan.smsQuota} onChange={num('smsQuota')} /></Field>
            <Field label={t('plans.col.email')}><input className="input" type="number" min={0} required value={plan.emailQuota} onChange={num('emailQuota')} /></Field>
            <Field label={t('plans.col.rate')}><input className="input" type="number" min={1} required value={plan.rateLimitPerMinute} onChange={num('rateLimitPerMinute')} /></Field>
            <Field label={t('plans.col.keys')}><input className="input" type="number" min={1} required value={plan.maxApiKeys} onChange={num('maxApiKeys')} /></Field>
            <Field label={t('admin.f.sort')}><input className="input" type="number" value={plan.sortOrder} onChange={num('sortOrder')} /></Field>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-500" checked={plan.isActive} onChange={(e) => setPlan({ ...plan, isActive: e.target.checked })} />{t('admin.f.visible')}</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-500" checked={plan.isDefault} onChange={(e) => setPlan({ ...plan, isDefault: e.target.checked })} />{t('admin.f.default')}</label>
            </div>
            <div className="col-span-2"><button className="btn-primary w-full">{t('admin.savePlan')}</button></div>
          </form>
        </Modal>
      )}
      {assign && (
        <Modal title={t('admin.setPlanFor', { name: assign.name })} onClose={() => setAssign(null)}>
          <form onSubmit={doAssign} className="space-y-4"><Alert>{err}</Alert>
            <Field label={t('admin.col.plan')}><select className="input" value={assignPlan} onChange={(e) => setAssignPlan(e.target.value)}>{data.adminPlans.map((p) => <option key={p.id} value={p.id}>{p.name} - {p.price === 0 ? t('plans.free') : fmtMoney(p.price, p.currency)}</option>)}</select></Field>
            <Field label={t('admin.f.days')} hint={t('admin.f.daysHint')}><input className="input" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
            <button className="btn-primary w-full">{t('admin.activateSub')}</button></form>
        </Modal>
      )}
    </div>
  )
}
