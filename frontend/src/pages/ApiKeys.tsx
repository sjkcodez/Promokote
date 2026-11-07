import { FormEvent, useState } from 'react'
import { KeyRound, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { fmtDate, gql, useQuery } from '../lib/api'
import type { ApiKey } from '../lib/types'
import { Alert, Badge, CopyButton, Empty, Field, Loading, Modal, PageHeader, Table, Td } from '../components/ui'

const SERVICES: Record<string, string> = { all: 'SMS + Email', sms: 'SMS only', email: 'Email only' }

export default function ApiKeys() {
  const { data, loading, error, reload } = useQuery<{ apiKeys: ApiKey[] }>('{ apiKeys { id name service key secretHint lastUsedAt createdAt isActive } }')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [service, setService] = useState('all')
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<{ key: string; secret: string } | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault(); setErr('')
    try {
      const d = await gql('mutation($n:String!,$s:String!){createApiKey(name:$n,service:$s){secret apiKey{key}}}', { n: name, s: service })
      setCreated({ key: d.createApiKey.apiKey.key, secret: d.createApiKey.secret }); setCreating(false); setName(''); void reload()
    } catch (x) { setErr((x as Error).message) }
  }
  async function revoke(id: string) {
    if (!confirm('Revoke this key? Systems using it will stop working immediately.')) return
    await gql('mutation($i:ID!){revokeApiKey(id:$i){ok}}', { i: id }); void reload()
  }
  if (loading) return <Loading />
  const keys = data?.apiKeys ?? []

  return (
    <div>
      <PageHeader title="API keys" subtitle="Use a key + secret to send SMS and email from your own website or app."
        action={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Generate key</button>} />
      <Alert>{error}</Alert>
      {keys.length === 0 ? <Empty title="No API keys yet" text="Generate a key and secret, then call the Promokote API with them." action={<button className="btn-primary" onClick={() => setCreating(true)}><KeyRound className="h-4 w-4" />Generate your first key</button>} /> : (
        <Table head={['Name', 'API key', 'Secret', 'Access', 'Last used', 'Status', '']}>
          {keys.map((k) => (
            <tr key={k.id}>
              <Td className="font-medium">{k.name}</Td>
              <Td><code className="text-xs">{k.key}</code></Td>
              <Td><code className="text-xs text-slate-500">ps_••••{k.secretHint}</code></Td>
              <Td>{SERVICES[k.service]}</Td>
              <Td>{fmtDate(k.lastUsedAt)}</Td>
              <Td><Badge>{k.isActive ? 'active' : 'cancelled'}</Badge></Td>
              <Td>{k.isActive && <button className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => revoke(k.id)} aria-label="Revoke"><Trash2 className="h-4 w-4" /></button>}</Td>
            </tr>
          ))}
        </Table>
      )}

      {creating && (
        <Modal title="Generate API key" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-4">
            <Alert>{err}</Alert>
            <Field label="Key name" hint="e.g. Website checkout, CRM integration"><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="What can this key do?">
              <select className="input" value={service} onChange={(e) => setService(e.target.value)}>{Object.entries(SERVICES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            <button className="btn-primary w-full">Generate</button>
          </form>
        </Modal>
      )}

      {created && (
        <Modal title="Save your API secret" onClose={() => setCreated(null)}>
          <div className="space-y-4">
            <Alert kind="info"><span className="flex items-center gap-1 font-semibold"><ShieldAlert className="h-4 w-4" />This secret is shown only once.</span> We store only a hash, so we cannot show it again. Copy it now and keep it safe.</Alert>
            {([['X-API-KEY', created.key], ['X-API-SECRET', created.secret]] as const).map(([l, v]) => (
              <div key={l}><p className="mb-1 text-sm font-medium">{l}</p><div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-slate-100 px-3 py-2 text-xs">{v}</code><CopyButton text={v} /></div></div>
            ))}
            <button className="btn-primary w-full" onClick={() => setCreated(null)}>I have saved it</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
