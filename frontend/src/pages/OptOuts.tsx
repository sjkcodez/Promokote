import { FormEvent, useState } from 'react'
import { fmtDate, gql, useQuery } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { Alert, Empty, Field, Loading, PageHeader, Table, Td } from '../components/ui'

interface Row { id: string; channel: string; address: string; reason: string; createdAt: string }

export default function OptOuts() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useQuery<{ optOuts: Row[] }>('{ optOuts { id channel address reason createdAt } }')
  const [channel, setChannel] = useState('sms')
  const [address, setAddress] = useState('')
  const [err, setErr] = useState('')
  async function add(e: FormEvent) {
    e.preventDefault(); setErr('')
    try { await gql('mutation($c:String!,$a:String!){addOptOut(channel:$c,address:$a){ok}}', { c: channel, a: address }); setAddress(''); void reload() }
    catch (x) { setErr((x as Error).message) }
  }
  const reason = (r: string) => (r === 'added manually' ? t('optout.reason.manual') : r === 'unsubscribe link' ? t('optout.reason.link') : r)
  return (
    <div>
      <PageHeader title={t('optout.title')} subtitle={t('optout.subtitle')} />
      <form onSubmit={add} className="card mb-6 grid items-end gap-3 sm:grid-cols-[140px_1fr_auto]">
        <Field label={t('col.channel')}><select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="sms">{t('common.sms')}</option><option value="email">{t('common.email')}</option></select></Field>
        <Field label={channel === 'sms' ? t('send.phone') : t('auth.email')}><input className="input" required value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <button className="btn-primary">{t('optout.add')}</button>
      </form>
      <div className="mb-3"><Alert>{err || error}</Alert></div>
      {loading ? <Loading /> : !data?.optOuts.length ? <Empty title={t('optout.empty.title')} text={t('optout.empty.text')} /> : (
        <Table head={[t('col.channel'), t('optout.col.address'), t('optout.col.reason'), t('col.date')]}>
          {data.optOuts.map((o) => <tr key={o.id}><Td className="uppercase">{o.channel}</Td><Td>{o.address}</Td><Td>{reason(o.reason)}</Td><Td className="whitespace-nowrap">{fmtDate(o.createdAt)}</Td></tr>)}
        </Table>
      )}
    </div>
  )
}
