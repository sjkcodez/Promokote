import { FormEvent, useState } from 'react'
import { Mail, MessageSquare, Plus, XCircle } from 'lucide-react'
import { fmtDate, gql, smsInfo, useQuery } from '../lib/api'
import type { Campaign, ContactList } from '../lib/types'
import { Alert, Badge, Empty, Field, Loading, Modal, PageHeader, Table, Td } from '../components/ui'

export default function Campaigns() {
  const { data, loading, error, reload } = useQuery<{ campaigns: Campaign[]; contactLists: ContactList[] }>(`{
    campaigns { id name channel status scheduledAt createdAt listNames total sent failed blocked queued }
    contactLists { id name contactCount }
  }`)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', channel: 'sms', subject: '', body: '', scheduledAt: '' })
  const [ids, setIds] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const info = smsInfo(f.body)
  const people = (data?.contactLists ?? []).filter((l) => ids.includes(l.id)).reduce((n, l) => n + l.contactCount, 0)

  async function create(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      await gql(`mutation($n:String!,$c:String!,$s:String,$b:String!,$l:[ID]!,$at:DateTime){createCampaign(name:$n,channel:$c,subject:$s,body:$b,listIds:$l,scheduledAt:$at){campaign{id}}}`,
        { n: f.name, c: f.channel, s: f.subject, b: f.body, l: ids, at: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : null })
      setOpen(false); setF({ name: '', channel: 'sms', subject: '', body: '', scheduledAt: '' }); setIds([]); void reload()
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  async function cancel(c: Campaign) {
    if (!confirm(`Cancel "${c.name}"? Unsent messages are dropped and their credits returned.`)) return
    try { await gql('mutation($i:ID!){cancelCampaign(id:$i){ok}}', { i: c.id }); void reload() } catch (x) { alert((x as Error).message) }
  }

  return (
    <div>
      <PageHeader title="Campaigns" subtitle="Send an SMS or email to one or more contact lists, now or later."
        action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New campaign</button>} />
      <Alert>{error}</Alert>
      {loading ? <Loading /> : !data?.campaigns.length ? <Empty title="No campaigns yet" text="Create a contact list first, then launch your first campaign." action={<button className="btn-primary" onClick={() => setOpen(true)}>Create campaign</button>} /> : (
        <Table head={['Campaign', 'Lists', 'Status', 'Sent', 'Failed', 'Skipped', 'Pending', 'Created', '']}>
          {data.campaigns.map((c) => (
            <tr key={c.id}>
              <Td><p className="flex items-center gap-2 font-medium">{c.channel === 'sms' ? <MessageSquare className="h-4 w-4 text-brand-600" /> : <Mail className="h-4 w-4 text-brand-600" />}{c.name}</p>{c.scheduledAt && c.status === 'scheduled' && <p className="text-xs text-slate-500">Scheduled {fmtDate(c.scheduledAt)}</p>}</Td>
              <Td>{c.listNames.join(', ')}</Td><Td><Badge>{c.status}</Badge></Td>
              <Td>{c.sent}/{c.total}</Td><Td>{c.failed}</Td><Td>{c.blocked}</Td><Td>{c.queued}</Td><Td className="whitespace-nowrap">{fmtDate(c.createdAt)}</Td>
              <Td>{(c.status === 'scheduled' || c.status === 'running') && <button className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => cancel(c)} aria-label="Cancel"><XCircle className="h-4 w-4" /></button>}</Td>
            </tr>
          ))}
        </Table>
      )}

      {open && (
        <Modal title="New campaign" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="space-y-4">
            <Alert>{err}</Alert>
            <Field label="Campaign name"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Channel"><select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}><option value="sms">SMS</option><option value="email">Email</option></select></Field>
            <Field label="Send to (contact lists)">
              {data?.contactLists.length ? (
                <div className="space-y-1 rounded-lg border border-slate-300 p-2">
                  {data.contactLists.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={ids.includes(l.id)} onChange={(e) => setIds(e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id))} />
                      {l.name} <span className="text-slate-400">({l.contactCount})</span>
                    </label>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">Create a contact list first.</p>}
            </Field>
            {f.channel === 'email' && <Field label="Subject"><input className="input" required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>}
            <Field label="Message" hint={'Personalise with {{name}}, {{phone}}, {{email}} or any extra column. Email campaigns automatically get an unsubscribe link.'}>
              <textarea className="input min-h-[130px]" required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
            </Field>
            {f.channel === 'sms' && <p className="text-xs text-slate-500">{info.length} chars &middot; {info.encoding} &middot; {info.segments} segment(s) per recipient{people ? ` · about ${(info.segments * people).toLocaleString()} credits` : ''}</p>}
            <Field label="Schedule (optional)" hint="Leave empty to send immediately."><input className="input" type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></Field>
            <button className="btn-primary w-full" disabled={busy || !ids.length}>{busy ? 'Working...' : f.scheduledAt ? 'Schedule campaign' : 'Send campaign now'}</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
