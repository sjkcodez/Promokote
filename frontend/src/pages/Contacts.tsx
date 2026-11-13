import { ChangeEvent, FormEvent, useState } from 'react'
import { Plus, Trash2, Upload } from 'lucide-react'
import { gql, useQuery } from '../lib/api'
import { useI18n } from '../lib/i18n'
import type { ContactList } from '../lib/types'
import { Alert, Empty, Field, Loading, Modal, PageHeader } from '../components/ui'

export default function Contacts() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useQuery<{ contactLists: ContactList[] }>('{ contactLists { id name contactCount createdAt } }')
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState('')
  const [importing, setImporting] = useState<ContactList | null>(null)
  const [raw, setRaw] = useState('')
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [err, setErr] = useState('')

  async function createList(e: FormEvent) {
    e.preventDefault(); setErr('')
    try { await gql('mutation($n:String!){createContactList(name:$n){list{id}}}', { n: name }); setNewOpen(false); setName(''); void reload() }
    catch (x) { setErr((x as Error).message) }
  }
  async function doImport(e: FormEvent) {
    e.preventDefault(); setErr('')
    try {
      const d = await gql('mutation($l:ID!,$r:String!){addContacts(listId:$l,raw:$r){added duplicates invalid invalidSamples}}', { l: importing!.id, r: raw })
      const r = d.addContacts
      setMsg({ kind: 'success', text: t('contacts.imported', { added: r.added, dups: r.duplicates, bad: r.invalid }) + (r.invalidSamples.length ? ` ${t('contacts.examples', { list: r.invalidSamples.join('; ') })}` : '') })
      setImporting(null); setRaw(''); void reload()
    } catch (x) { setErr((x as Error).message) }
  }
  async function remove(l: ContactList) {
    if (!confirm(t('contacts.deleteConfirm', { name: l.name }))) return
    await gql('mutation($i:ID!){deleteContactList(id:$i){ok}}', { i: l.id }); void reload()
  }
  function readFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) void f.text().then(setRaw)
  }

  return (
    <div>
      <PageHeader title={t('contacts.title')} subtitle={t('contacts.subtitle')}
        action={<button className="btn-primary" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" />{t('contacts.newList')}</button>} />
      <div className="space-y-4">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Alert>{error}</Alert>
        {loading ? <Loading /> : !data?.contactLists.length ? <Empty title={t('contacts.empty.title')} text={t('contacts.empty.text')} action={<button className="btn-primary" onClick={() => setNewOpen(true)}>{t('contacts.createList')}</button>} /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.contactLists.map((l) => (
              <div key={l.id} className="card">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{l.name}</p><p className="text-sm text-muted">{t('contacts.count', { n: l.contactCount.toLocaleString() })}</p></div>
                  <button className="rounded-lg p-2 text-faint hover:bg-danger-soft hover:text-danger" onClick={() => remove(l)} aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></button></div>
                <button className="btn-secondary mt-4 w-full" onClick={() => { setImporting(l); setErr('') }}><Upload className="h-4 w-4" />{t('contacts.add')}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {newOpen && (
        <Modal title={t('contacts.newListTitle')} onClose={() => setNewOpen(false)}>
          <form onSubmit={createList} className="space-y-4"><Alert>{err}</Alert>
            <Field label={t('contacts.listName')}><input className="input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('contacts.listNamePh')} /></Field>
            <button className="btn-primary w-full">{t('contacts.createList')}</button></form>
        </Modal>
      )}
      {importing && (
        <Modal title={t('contacts.addTo', { name: importing.name })} onClose={() => setImporting(null)}>
          <form onSubmit={doImport} className="space-y-4"><Alert>{err}</Alert>
            <Field label={t('contacts.paste')} hint={t('contacts.pasteHint')}>
              <textarea className="input min-h-[180px] font-mono text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'name,phone,email\nAsha,0712345678,asha@mfano.co.tz\nJuma,0755111222,'} />
            </Field>
            <input type="file" accept=".csv,.txt" onChange={readFile} aria-label={t('contacts.upload')} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-semibold file:text-accent-ink" />
            <button className="btn-primary w-full" disabled={!raw.trim()}>{t('contacts.import')}</button></form>
        </Modal>
      )}
    </div>
  )
}
