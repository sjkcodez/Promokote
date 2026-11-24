import { FormEvent, useState } from 'react'
import { Crown, MailPlus, Trash2 } from 'lucide-react'
import { fmtDate, gql, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { TKey, useI18n } from '../lib/i18n'
import type { TeamMember } from '../lib/types'
import { Alert, Badge, Field, Loading, Modal, PageHeader, Table, Td } from '../components/ui'

const STAFF_ROLES = ['marketer', 'developer', 'viewer']

export default function Team() {
  const { t } = useI18n()
  const { user } = useAuth()
  const myRole = user?.organization?.role
  const isOwner = myRole === 'owner'
  const canTeam = isOwner || myRole === 'admin'
  const assignable = isOwner ? ['admin', ...STAFF_ROLES] : STAFF_ROLES   // mirrors accounts/users.py
  const { data, loading, error, reload } = useQuery<{ team: TeamMember[] }>('{ team { id email fullName role status lastLogin joinedAt isYou canManage } }')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('marketer')
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [transfer, setTransfer] = useState<TeamMember | null>(null)
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg(null)
    try { await fn(); setMsg({ kind: 'success', text: ok }); void reload() } catch (x) { setMsg({ kind: 'error', text: (x as Error).message }) }
  }
  const invite = (e: FormEvent) => { e.preventDefault(); void act(async () => { await gql('mutation($e:String!,$r:String!){inviteMember(email:$e,role:$r){ok}}', { e: email, r: role }); setEmail('') }, t('team.sent', { email })) }
  const changeRole = (m: TeamMember, r: string) => act(() => gql('mutation($u:ID!,$r:String!){updateMemberRole(userId:$u,role:$r){member{role}}}', { u: m.id, r }), t('team.roleChanged', { email: m.email, role: t(`role.${r}` as TKey) }))
  const remove = (m: TeamMember) => { if (confirm(t('team.removeConfirm', { email: m.email }))) void act(() => gql('mutation($u:ID!){removeMember(userId:$u){ok}}', { u: m.id }), t('team.removed', { email: m.email })) }
  const resend = (m: TeamMember) => act(() => gql('mutation($u:ID!){resendInvite(userId:$u){ok}}', { u: m.id }), t('team.sent', { email: m.email }))
  async function doTransfer(e: FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await gql('mutation($u:ID!,$p:String!){transferOwnership(userId:$u,password:$p){ok}}', { u: transfer!.id, p: password })
      window.location.reload()   // my own role changed: reload the whole console
    } catch (x) { setErr((x as Error).message) }
  }

  return (
    <div>
      <PageHeader title={t('team.title')} subtitle={t('team.subtitle')} />
      {canTeam && (
        <form onSubmit={invite} className="card mb-6 grid items-end gap-3 md:grid-cols-[1fr_280px_auto]">
          <Field label={t('auth.email')}><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t('team.role')}><select className="input" value={role} onChange={(e) => setRole(e.target.value)}>{assignable.map((r) => <option key={r} value={r}>{t(`role.${r}` as TKey)} - {t(`role.${r}.desc` as TKey)}</option>)}</select></Field>
          <button className="btn-primary"><MailPlus className="h-4 w-4" />{t('team.invite')}</button>
        </form>
      )}
      <div className="mb-3 space-y-2">{msg && <Alert kind={msg.kind}>{msg.text}</Alert>}<Alert>{error}</Alert></div>
      {loading ? <Loading /> : (
        <Table head={[t('team.col.name'), t('team.role'), t('col.status'), t('team.col.lastSeen'), '']}>
          {data?.team.map((m) => (
            <tr key={m.id}>
              <Td><p className="font-medium">{m.fullName || '-'}{m.isYou && <span className="ml-2 text-xs text-muted">({t('team.you')})</span>}</p><p className="text-xs text-muted">{m.email}</p></Td>
              <Td>
                {m.canManage ? (
                  <select className="input !w-auto !py-1.5" aria-label={t('team.role')} value={m.role} onChange={(e) => void changeRole(m, e.target.value)}>
                    {(assignable.includes(m.role) ? assignable : [m.role, ...assignable]).map((r) => <option key={r} value={r}>{t(`role.${r}` as TKey)}</option>)}
                  </select>
                ) : <span className="inline-flex items-center gap-1">{m.role === 'owner' && <Crown className="h-4 w-4 text-accent" />}{t(`role.${m.role}` as TKey)}</span>}
              </Td>
              <Td><Badge>{m.status}</Badge></Td>
              <Td className="whitespace-nowrap">{m.lastLogin ? fmtDate(m.lastLogin) : t('team.never')}</Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1">
                  {m.canManage && m.status === 'invited' && <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={() => void resend(m)}>{t('team.resend')}</button>}
                  {isOwner && !m.isYou && m.status === 'active' && <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={() => { setTransfer(m); setPassword(''); setErr('') }}>{t('team.makeOwner')}</button>}
                  {m.canManage && <button className="rounded-lg p-2 text-danger hover:bg-danger-soft" onClick={() => remove(m)} aria-label={t('team.remove')} title={t('team.remove')}><Trash2 className="h-4 w-4" /></button>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-3 text-xs text-muted">{t('team.rules')}</p>

      {transfer && (
        <Modal title={t('team.transferTitle')} onClose={() => setTransfer(null)}>
          <form onSubmit={doTransfer} className="space-y-4">
            <Alert>{err}</Alert>
            <Alert kind="info">{t('team.transferText', { email: transfer.email })}</Alert>
            <Field label={t('account.pw.current')}><input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <button className="btn-primary w-full"><Crown className="h-4 w-4" />{t('team.transferSubmit')}</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
