import { FormEvent, useState } from 'react'
import { gql, useQuery } from '../lib/api'
import { Alert, Field, Loading, PageHeader, Table, Td } from '../components/ui'

interface Member { id: string; email: string; fullName: string; role: string }
const ROLES = [['admin', 'Admin - manage everything'], ['marketer', 'Marketer - run campaigns'], ['developer', 'Developer - API keys & sending'], ['viewer', 'Viewer - read-only']]

export default function Team() {
  const { data, loading, error, reload } = useQuery<{ members: Member[] }>('{ members { id email fullName role } }')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('marketer')
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  async function invite(e: FormEvent) {
    e.preventDefault()
    try { await gql('mutation($e:String!,$r:String!){inviteMember(email:$e,role:$r){ok}}', { e: email, r: role }); setMsg({ kind: 'success', text: `Invitation sent to ${email}.` }); setEmail(''); void reload() }
    catch (x) { setMsg({ kind: 'error', text: (x as Error).message }) }
  }
  return (
    <div>
      <PageHeader title="Team" subtitle="Invite colleagues and control what they can do." />
      <form onSubmit={invite} className="card mb-6 grid items-end gap-3 md:grid-cols-[1fr_260px_auto]">
        <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Role"><select className="input" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <button className="btn-primary">Send invite</button>
      </form>
      <div className="mb-3">{msg && <Alert kind={msg.kind}>{msg.text}</Alert>}<Alert>{error}</Alert></div>
      {loading ? <Loading /> : (
        <Table head={['Name', 'Email', 'Role']}>{data?.members.map((m) => <tr key={m.id}><Td>{m.fullName || '-'}</Td><Td>{m.email}</Td><Td className="capitalize">{m.role}</Td></tr>)}</Table>
      )}
    </div>
  )
}
