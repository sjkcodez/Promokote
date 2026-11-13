import { FormEvent, useState } from 'react'
import { Mail, MessageSquare, Plus, XCircle } from 'lucide-react'
import { fmtDate, gql, smsInfo, useQuery } from '../lib/api'
import { useI18n } from '../lib/i18n'
import type { Campaign, ContactList } from '../lib/types'
import { Alert, Badge, Empty, Field, Loading, Modal, PageHeader, Table, Td } from '../components/ui'

export default function Campaigns() {
  const { t } = useI18n()
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
    if (!confirm(t('camp.cancelConfirm', { name: c.name }))) return
    try { await gql('mutation($i:ID!){cancelCampaign(id:$i){ok}}', { i: c.id }); void reload() } catch (x) { alert((x as Error).message) }
  }

  return (
    <div>
      <PageHeader title={t('camp.title')} subtitle={t('camp.subtitle')}
        action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('camp.new')}</button>} />
      <Alert>{error}</Alert>
      {loading ? <Loading /> : !data?.campaigns.length ? <Empty title={t('camp.empty.title')} text={t('camp.empty.text')} action={<button className="btn-primary" onClick={() => setOpen(true)}>{t('camp.create')}</button>} /> : (
        <Table head={[t('camp.col.name'), t('camp.col.lists'), t('col.status'), t('camp.col.sent'), t('camp.col.failed'), t('camp.col.skipped'), t('camp.col.pending'), t('col.created'), '']}>
          {data.campaigns.map((c) => (
            <tr key={c.id}>
              <Td><p className="flex items-center gap-2 font-medium">{c.channel === 'sms' ? <MessageSquare className="h-4 w-4 text-accent" /> : <Mail className="h-4 w-4 text-accent" />}{c.name}</p>{c.scheduledAt && c.status === 'scheduled' && <p className="text-xs text-muted">{t('camp.scheduledFor', { date: fmtDate(c.scheduledAt) })}</p>}</Td>
              <Td>{c.listNames.join(', ')}</Td><Td><Badge>{c.status}</Badge></Td>
              <Td>{c.sent}/{c.total}</Td><Td>{c.failed}</Td><Td>{c.blocked}</Td><Td>{c.queued}</Td><Td className="whitespace-nowrap">{fmtDate(c.createdAt)}</Td>
              <Td>{(c.status === 'scheduled' || c.status === 'running') && <button className="rounded-lg p-2 text-danger hover:bg-danger-soft" onClick={() => cancel(c)} aria-label={t('common.cancel')}><XCircle className="h-4 w-4" /></button>}</Td>
            </tr>
          ))}
        </Table>
      )}

      {open && (
        <Modal title={t('camp.new')} onClose={() => setOpen(false)}>
          <form onSubmit={create} className="space-y-4">
            <Alert>{err}</Alert>
            <Field label={t('camp.f.name')}><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label={t('col.channel')}><select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}><option value="sms">{t('common.sms')}</option><option value="email">{t('common.email')}</option></select></Field>
            <Field label={t('camp.f.lists')}>
              {data?.contactLists.length ? (
                <div className="space-y-1 rounded-lg border border-line-strong p-2">
                  {data.contactLists.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-subtle">
                      <input type="checkbox" className="accent-brand-500" checked={ids.includes(l.id)} onChange={(e) => setIds(e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id))} />
                      {l.name} <span className="text-faint">({l.contactCount})</span>
                    </label>
                  ))}
                </div>
              ) : <p className="text-sm text-muted">{t('camp.f.noLists')}</p>}
            </Field>
            {f.channel === 'email' && <Field label={t('send.subject')}><input className="input" required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>}
            <Field label={t('send.message')} hint={t('camp.f.bodyHint')}>
              <textarea className="input min-h-[130px]" required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
            </Field>
            {f.channel === 'sms' && <p className="text-xs text-muted">{t('camp.counter', { len: info.length, enc: info.encoding, n: info.segments })}{people ? ` · ${t('camp.credits', { n: (info.segments * people).toLocaleString() })}` : ''}</p>}
            <Field label={t('camp.f.schedule')} hint={t('camp.f.scheduleHint')}><input className="input" type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></Field>
            <button className="btn-primary w-full" disabled={busy || !ids.length}>{busy ? t('common.working') : f.scheduledAt ? t('camp.schedule') : t('camp.sendNow')}</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
