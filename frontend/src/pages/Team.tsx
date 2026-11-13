import { FormEvent, useState } from 'react'
import { gql, useQuery } from '../lib/api'
import { TKey, useI18n } from '../lib/i18n'
import { Alert, Field, Loading, PageHeader, Table, Td } from '../components/ui'

interface Member { id: string; email: string; fullName: string; role: string }
const ROLES = ['admin', 'marketer', 'developer', 'viewer']

export default function Team() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useQuery<{ members: Member[] }>('{ members { id email fullName role } }')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('marketer')
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  async function invite(e: FormEvent) {
    e.preventDefault()
    try { await gql('mutation($e:String!,$r:String!){inviteMember(email:$e,role:$r){ok}}', { e: email, r: role }); setMsg({ kind: 'success', text: t('team.sent', { email }) }); setEmail(''); void reload() }
    catch (x) { setMsg({ kind: 'error', text: (x as Error).message }) }
  }
  return (
    <div>
      <PageHeader title={t('team.title')} subtitle={t('team.subtitle')} />
      <form onSubmit={invite} className="card mb-6 grid items-end gap-3 md:grid-cols-[1fr_280px_auto]">
        <Field label={t('auth.email')}><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label={t('team.role')}><select className="input" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}` as TKey)} - {t(`role.${r}.desc` as TKey)}</option>)}</select></Field>
        <button className="btn-primary">{t('team.invite')}</button>
      </form>
      <div className="mb-3">{msg && <Alert kind={msg.kind}>{msg.text}</Alert>}<Alert>{error}</Alert></div>
      {loading ? <Loading /> : (
        <Table head={[t('team.col.name'), t('auth.email'), t('team.role')]}>{data?.members.map((m) => <tr key={m.id}><Td>{m.fullName || '-'}</Td><Td>{m.email}</Td><Td>{t(`role.${m.role}` as TKey)}</Td></tr>)}</Table>
      )}
    </div>
  )
}
