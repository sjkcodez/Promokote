import { FormEvent, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { fmtDate, fmtMoney, gql, useQuery } from '../lib/api'
import type { Plan, Subscription } from '../lib/types'
import { Alert, Badge, Field, Loading, Modal, PageHeader, Table, Td } from '../components/ui'

interface Org { id: string; name: string; ownerEmail: string; planName: string; subscriptionStatus: string; smsEnabled: boolean; emailEnabled: boolean; isSuspended: boolean; messagesSent: number; createdAt: string }
interface Data {
  adminStats: { organizations: number; users: number; messagesSent: number; pendingSubscriptions: number }
  adminPlans: Plan[]; adminOrganizations: Org[]; pending: (Subscription & { organizationName: string; organization?: { id: string } })[]
}

const BLANK = { id: '', name: '', description: '', price: 0, currency: 'TZS', periodDays: 30, smsQuota: 100, emailQuota: 500, rateLimitPerMinute: 60, maxApiKeys: 3, isActive: true, isDefault: false, sortOrder: 0 }
const Q = `{
  adminStats { organizations users messagesSent pendingSubscriptions }
  adminPlans { id name description price currency periodDays smsQuota emailQuota rateLimitPerMinute maxApiKeys isActive isDefault sortOrder }
  adminOrganizations { id name ownerEmail planName subscriptionStatus smsEnabled emailEnabled isSuspended messagesSent createdAt }
}`

export default function Admin() {
  const { data, loading, error, reload } = useQuery<Data>(Q)
  const [plan, setPlan] = useState<typeof BLANK | null>(null)
  const [assign, setAssign] = useState<Org | null>(null)
  const [assignPlan, setAssignPlan] = useState('')
  const [days, setDays] = useState('')
  const [err, setErr] = useState('')

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
  const num = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => setPlan({ ...plan!, [k]: Number(e.target.value) })
  if (loading) return <Loading />
  if (!data) return <Alert>{error}</Alert>
  const s = data.adminStats

  return (
    <div className="space-y-10">
      <PageHeader title="Platform admin" subtitle="Configure subscription plans, activate paid subscriptions and manage organisations." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[['Organisations', s.organizations], ['Users', s.users], ['Messages sent', s.messagesSent], ['Awaiting activation', s.pendingSubscriptions]].map(([l, v]) => <div key={l as string} className="card"><p className="text-2xl font-bold">{(v as number).toLocaleString()}</p><p className="text-sm text-slate-500">{l as string}</p></div>)}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Subscription plans</h2><button className="btn-primary" onClick={() => { setPlan({ ...BLANK }); setErr('') }}><Plus className="h-4 w-4" />New plan</button></div>
        <Table head={['Plan', 'Price', 'Period', 'SMS', 'Emails', 'Rate/min', 'Keys', 'Status', '']}>
          {data.adminPlans.map((p) => (
            <tr key={p.id}>
              <Td className="font-medium">{p.name}{p.isDefault && <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700">default</span>}</Td>
              <Td>{p.price === 0 ? 'Free' : fmtMoney(p.price, p.currency)}</Td><Td>{p.periodDays}d</Td><Td>{p.smsQuota.toLocaleString()}</Td><Td>{p.emailQuota.toLocaleString()}</Td><Td>{p.rateLimitPerMinute}</Td><Td>{p.maxApiKeys}</Td>
              <Td><Badge>{p.isActive ? 'active' : 'cancelled'}</Badge></Td>
              <Td><button className="rounded-lg p-2 hover:bg-slate-100" onClick={() => { setPlan({ ...BLANK, ...p, description: p.description ?? '' }); setErr('') }} aria-label="Edit"><Pencil className="h-4 w-4" /></button></Td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Organisations</h2>
        <Table head={['Organisation', 'Owner', 'Plan', 'Sent', 'SMS', 'Email', 'Suspended', 'Joined', '']}>
          {data.adminOrganizations.map((o) => (
            <tr key={o.id}>
              <Td className="font-medium">{o.name}</Td><Td>{o.ownerEmail}</Td>
              <Td>{o.planName || '-'} {o.subscriptionStatus === 'pending' && <Badge>pending</Badge>}</Td><Td>{o.messagesSent}</Td>
              {(['smsEnabled', 'emailEnabled', 'isSuspended'] as const).map((f) => <Td key={f}><input type="checkbox" checked={o[f]} onChange={() => toggle(o, f)} className="h-4 w-4" /></Td>)}
              <Td className="whitespace-nowrap">{fmtDate(o.createdAt)}</Td>
              <Td><button className="btn-secondary !px-3 !py-1.5" onClick={() => { setAssign(o); setAssignPlan(data.adminPlans[0]?.id ?? ''); setDays(''); setErr('') }}>{o.subscriptionStatus === 'pending' ? 'Activate / change' : 'Set plan'}</button></Td>
            </tr>
          ))}
        </Table>
      </section>

      {plan && (
        <Modal title={plan.id ? 'Edit plan' : 'New plan'} onClose={() => setPlan(null)}>
          <form onSubmit={savePlan} className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Alert>{err}</Alert></div>
            <div className="col-span-2"><Field label="Name"><input className="input" required value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} /></Field></div>
            <div className="col-span-2"><Field label="Description"><input className="input" value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} /></Field></div>
            <Field label="Price (TZS)"><input className="input" type="number" min={0} required value={plan.price} onChange={num('price')} /></Field>
            <Field label="Period (days)"><input className="input" type="number" min={1} required value={plan.periodDays} onChange={num('periodDays')} /></Field>
            <Field label="SMS credits"><input className="input" type="number" min={0} required value={plan.smsQuota} onChange={num('smsQuota')} /></Field>
            <Field label="Emails"><input className="input" type="number" min={0} required value={plan.emailQuota} onChange={num('emailQuota')} /></Field>
            <Field label="API requests / minute"><input className="input" type="number" min={1} required value={plan.rateLimitPerMinute} onChange={num('rateLimitPerMinute')} /></Field>
            <Field label="Max API keys"><input className="input" type="number" min={1} required value={plan.maxApiKeys} onChange={num('maxApiKeys')} /></Field>
            <Field label="Sort order"><input className="input" type="number" value={plan.sortOrder} onChange={num('sortOrder')} /></Field>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={plan.isActive} onChange={(e) => setPlan({ ...plan, isActive: e.target.checked })} />Visible to customers</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={plan.isDefault} onChange={(e) => setPlan({ ...plan, isDefault: e.target.checked })} />Default for new sign-ups</label>
            </div>
            <div className="col-span-2"><button className="btn-primary w-full">Save plan</button></div>
          </form>
        </Modal>
      )}
      {assign && (
        <Modal title={`Set plan for ${assign.name}`} onClose={() => setAssign(null)}>
          <form onSubmit={doAssign} className="space-y-4"><Alert>{err}</Alert>
            <Field label="Plan"><select className="input" value={assignPlan} onChange={(e) => setAssignPlan(e.target.value)}>{data.adminPlans.map((p) => <option key={p.id} value={p.id}>{p.name} - {p.price === 0 ? 'Free' : fmtMoney(p.price, p.currency)}</option>)}</select></Field>
            <Field label="Days (optional)" hint="Leave empty to use the plan's own period. Activating resets the usage counters."><input className="input" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
            <button className="btn-primary w-full">Activate subscription</button></form>
        </Modal>
      )}
    </div>
  )
}
