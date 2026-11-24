import { useEffect, useState } from 'react'
import { KeyRound, Search } from 'lucide-react'
import { fmtDate, gql, useQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { TKey, useI18n } from '../lib/i18n'
import type { AdminUser } from '../lib/types'
import { Alert, Badge, Empty, Loading, PageHeader, Table, Td } from '../components/ui'

const FIELDS = 'id email fullName phone organizationName role status isActive isStaff isSuperuser emailVerified lastLogin createdAt'

export default function AdminUsers() {
  const { t } = useI18n()
  const { user: me } = useAuth()
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => { const h = setTimeout(() => setSearch(input), 300); return () => clearTimeout(h) }, [input])
  const { data, loading, error, reload } = useQuery<{ adminUsers: AdminUser[] }>(`query($s:String,$st:String){ adminUsers(search:$s,status:$st,limit:200){ ${FIELDS} } }`, { s: search, st: status })
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function update(u: AdminUser, change: Partial<Pick<AdminUser, 'isActive' | 'isStaff' | 'emailVerified'>>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    setMsg(null)
    try {
      await gql('mutation($i:ID!,$a:Boolean,$s:Boolean,$v:Boolean){adminUpdateUser(id:$i,isActive:$a,isStaff:$s,emailVerified:$v){user{id}}}',
        { i: u.id, a: change.isActive ?? null, s: change.isStaff ?? null, v: change.emailVerified ?? null })
      setMsg({ kind: 'success', text: t('admin.users.updated', { email: u.email }) }); void reload()
    } catch (x) { setMsg({ kind: 'error', text: (x as Error).message }) }
  }
  async function reset(u: AdminUser) {
    setMsg(null)
    try { await gql('mutation($i:ID!){adminSendPasswordReset(id:$i){ok}}', { i: u.id }); setMsg({ kind: 'success', text: t('admin.users.resetSent', { email: u.email }) }) }
    catch (x) { setMsg({ kind: 'error', text: (x as Error).message }) }
  }

  return (
    <div>
      <PageHeader title={t('admin.users.title')} subtitle={t('admin.users.subtitle')} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input className="input pl-9" type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('admin.users.search')} aria-label={t('admin.users.search')} />
        </div>
        <select className="input sm:!w-56" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('col.status')}>
          <option value="">{t('admin.users.all')}</option><option value="deactivated">{t('status.deactivated')}</option>
          <option value="unverified">{t('status.unverified')}</option><option value="staff">{t('admin.users.staff')}</option>
        </select>
      </div>
      <div className="mb-3 space-y-2">{msg && <Alert kind={msg.kind}>{msg.text}</Alert>}<Alert>{error}</Alert></div>
      {loading && !data ? <Loading /> : !data?.adminUsers.length ? <Empty title={t('admin.users.none')} /> : (
        <Table head={[t('admin.users.col.user'), t('admin.col.org'), t('col.status'), t('admin.users.col.access'), t('team.col.lastSeen'), t('admin.col.joined'), '']}>
          {data.adminUsers.map((u) => {
            const self = u.id === me?.id
            return (
              <tr key={u.id} className={u.isActive ? '' : 'opacity-70'}>
                <Td><p className="font-medium">{u.fullName || '-'}</p><p className="text-xs text-muted">{u.email}</p>{u.phone && <p className="text-xs text-muted">{u.phone}</p>}</Td>
                <Td>{u.organizationName || '-'}{u.role && <p className="text-xs text-muted">{t(`role.${u.role}` as TKey)}</p>}</Td>
                <Td><div className="flex flex-wrap gap-1"><Badge>{u.status}</Badge>{!u.emailVerified && <Badge>unverified</Badge>}</div></Td>
                <Td className="whitespace-nowrap">{u.isSuperuser ? t('admin.users.superuser') : u.isStaff ? t('admin.users.staff') : t('admin.users.customer')}</Td>
                <Td className="whitespace-nowrap">{u.lastLogin ? fmtDate(u.lastLogin) : t('team.never')}</Td>
                <Td className="whitespace-nowrap">{fmtDate(u.createdAt)}</Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1">
                    {!u.emailVerified && <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={() => void update(u, { emailVerified: true })}>{t('admin.users.verify')}</button>}
                    {u.isActive && <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={() => void reset(u)}><KeyRound className="h-3.5 w-3.5" />{t('admin.users.reset')}</button>}
                    {!self && !u.isSuperuser && <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={() => void update(u, { isStaff: !u.isStaff }, u.isStaff ? undefined : t('admin.users.staffConfirm', { email: u.email }))}>{u.isStaff ? t('admin.users.removeStaff') : t('admin.users.makeStaff')}</button>}
                    {!self && !u.isSuperuser && (u.isActive
                      ? <button className="btn-ghost !px-2 !py-1.5 text-xs text-danger" onClick={() => void update(u, { isActive: false }, t('admin.users.deactivateConfirm', { email: u.email }))}>{t('admin.users.deactivate')}</button>
                      : <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={() => void update(u, { isActive: true })}>{t('admin.users.activate')}</button>)}
                  </div>
                </Td>
              </tr>
            )
          })}
        </Table>
      )}
    </div>
  )
}
