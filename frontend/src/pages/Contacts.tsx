import { ChangeEvent, FormEvent, useState } from 'react'
import { Plus, Trash2, Upload } from 'lucide-react'
import { gql, useQuery } from '../lib/api'
import type { ContactList } from '../lib/types'
import { Alert, Empty, Field, Loading, Modal, PageHeader } from '../components/ui'

export default function Contacts() {
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
      setMsg({ kind: 'success', text: `${r.added} added, ${r.duplicates} already existed, ${r.invalid} invalid${r.invalidSamples.length ? ` (e.g. ${r.invalidSamples.join('; ')})` : ''}.` })
      setImporting(null); setRaw(''); void reload()
    } catch (x) { setErr((x as Error).message) }
  }
  async function remove(l: ContactList) {
    if (!confirm(`Delete list "${l.name}"? Contacts stay in your account.`)) return
    await gql('mutation($i:ID!){deleteContactList(id:$i){ok}}', { i: l.id }); void reload()
  }
  function readFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) void f.text().then(setRaw)
  }

  return (
    <div>
      <PageHeader title="Contacts" subtitle="Organise recipients into lists, then send campaigns to them."
        action={<button className="btn-primary" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" />New list</button>} />
      <div className="space-y-4">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Alert>{error}</Alert>
        {loading ? <Loading /> : !data?.contactLists.length ? <Empty title="No contact lists yet" text="Create a list, then paste or upload your contacts." action={<button className="btn-primary" onClick={() => setNewOpen(true)}>Create a list</button>} /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.contactLists.map((l) => (
              <div key={l.id} className="card">
                <div className="flex items-start justify-between"><div><p className="font-semibold">{l.name}</p><p className="text-sm text-slate-500">{l.contactCount.toLocaleString()} contacts</p></div>
                  <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(l)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>
                <button className="btn-secondary mt-4 w-full" onClick={() => { setImporting(l); setErr('') }}><Upload className="h-4 w-4" />Add contacts</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {newOpen && (
        <Modal title="New contact list" onClose={() => setNewOpen(false)}>
          <form onSubmit={createList} className="space-y-4"><Alert>{err}</Alert>
            <Field label="List name"><input className="input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dar es Salaam customers" /></Field>
            <button className="btn-primary w-full">Create list</button></form>
        </Modal>
      )}
      {importing && (
        <Modal title={`Add contacts to ${importing.name}`} onClose={() => setImporting(null)}>
          <form onSubmit={doImport} className="space-y-4"><Alert>{err}</Alert>
            <Field label="Paste contacts" hint={'One per line. Either "name, phone, email" in any order, or a CSV with a header row (name, phone, email + any extra columns for merge fields like {{company}}). Phones like 0712345678 are converted to +255 format.'}>
              <textarea className="input min-h-[180px] font-mono text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'name,phone,email\nAsha,0712345678,asha@example.com\nJuma,0755111222,'} />
            </Field>
            <input type="file" accept=".csv,.txt" onChange={readFile} className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700" />
            <button className="btn-primary w-full" disabled={!raw.trim()}>Import</button></form>
        </Modal>
      )}
    </div>
  )
}
