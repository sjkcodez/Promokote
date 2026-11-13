import { FormEvent, useState } from 'react'
import { KeyRound, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { fmtDate, gql, useQuery } from '../lib/api'
import { TKey, useI18n } from '../lib/i18n'
import type { ApiKey } from '../lib/types'
import { Alert, Badge, CopyButton, Empty, Field, Loading, Modal, PageHeader, Table, Td } from '../components/ui'

const SERVICES: Record<string, TKey> = { all: 'keys.svc.all', sms: 'keys.svc.sms', email: 'keys.svc.email' }

export default function ApiKeys() {
  const { t } = useI18n()
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
    if (!confirm(t('keys.revokeConfirm'))) return
    await gql('mutation($i:ID!){revokeApiKey(id:$i){ok}}', { i: id }); void reload()
  }
  if (loading) return <Loading />
  const keys = data?.apiKeys ?? []

  return (
    <div>
      <PageHeader title={t('keys.title')} subtitle={t('keys.subtitle')}
        action={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('keys.generate')}</button>} />
      <Alert>{error}</Alert>
      {keys.length === 0 ? <Empty title={t('keys.empty.title')} text={t('keys.empty.text')} action={<button className="btn-primary" onClick={() => setCreating(true)}><KeyRound className="h-4 w-4" />{t('keys.first')}</button>} /> : (
        <Table head={[t('keys.col.name'), t('keys.col.key'), t('keys.col.secret'), t('keys.col.access'), t('keys.col.lastUsed'), t('col.status'), '']}>
          {keys.map((k) => (
            <tr key={k.id}>
              <Td className="font-medium">{k.name}</Td>
              <Td><code className="text-xs">{k.key}</code></Td>
              <Td><code className="text-xs text-muted">ps_••••{k.secretHint}</code></Td>
              <Td>{t(SERVICES[k.service])}</Td>
              <Td className="whitespace-nowrap">{fmtDate(k.lastUsedAt)}</Td>
              <Td><Badge>{k.isActive ? 'active' : 'revoked'}</Badge></Td>
              <Td>{k.isActive && <button className="rounded-lg p-2 text-danger hover:bg-danger-soft" onClick={() => revoke(k.id)} aria-label={t('keys.revoke')}><Trash2 className="h-4 w-4" /></button>}</Td>
            </tr>
          ))}
        </Table>
      )}

      {creating && (
        <Modal title={t('keys.generateTitle')} onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-4">
            <Alert>{err}</Alert>
            <Field label={t('keys.f.name')} hint={t('keys.f.nameHint')}><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={t('keys.f.access')}>
              <select className="input" value={service} onChange={(e) => setService(e.target.value)}>{Object.entries(SERVICES).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>
            </Field>
            <button className="btn-primary w-full">{t('keys.generate')}</button>
          </form>
        </Modal>
      )}

      {created && (
        <Modal title={t('keys.saveTitle')} onClose={() => setCreated(null)}>
          <div className="space-y-4">
            <Alert kind="info"><span className="flex items-center gap-1 font-semibold"><ShieldAlert className="h-4 w-4" />{t('keys.once')}</span> {t('keys.onceText')}</Alert>
            {([['X-API-KEY', created.key], ['X-API-SECRET', created.secret]] as const).map(([l, v]) => (
              <div key={l}><p className="mb-1 text-sm font-medium">{l}</p><div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-subtle px-3 py-2 text-xs">{v}</code><CopyButton text={v} /></div></div>
            ))}
            <button className="btn-primary w-full" onClick={() => setCreated(null)}>{t('keys.saved')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
