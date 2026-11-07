import { FormEvent, useState } from 'react'
import { fmtDate, gql, useQuery } from '../lib/api'
import { Alert, Empty, Field, Loading, PageHeader, Table, Td } from '../components/ui'

interface Row { id: string; channel: string; address: string; reason: string; createdAt: string }

export default function OptOuts() {
  const { data, loading, error, reload } = useQuery<{ optOuts: Row[] }>('{ optOuts { id channel address reason createdAt } }')
  const [channel, setChannel] = useState('sms')
  const [address, setAddress] = useState('')
  const [err, setErr] = useState('')
  async function add(e: FormEvent) {
    e.preventDefault(); setErr('')
    try { await gql('mutation($c:String!,$a:String!){addOptOut(channel:$c,address:$a){ok}}', { c: channel, a: address }); setAddress(''); void reload() }
    catch (x) { setErr((x as Error).message) }
  }
  return (
    <div>
      <PageHeader title="Opt-outs" subtitle="People who asked not to be contacted. Messages to them are blocked automatically and this cannot be overridden." />
      <form onSubmit={add} className="card mb-6 grid items-end gap-3 sm:grid-cols-[140px_1fr_auto]">
        <Field label="Channel"><select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="sms">SMS</option><option value="email">Email</option></select></Field>
        <Field label={channel === 'sms' ? 'Phone number' : 'Email address'}><input className="input" required value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <button className="btn-primary">Add opt-out</button>
      </form>
      <div className="mb-3"><Alert>{err || error}</Alert></div>
      {loading ? <Loading /> : !data?.optOuts.length ? <Empty title="Nobody has opted out" text="Email unsubscribe clicks appear here automatically." /> : (
        <Table head={['Channel', 'Address', 'Reason', 'Date']}>
          {data.optOuts.map((o) => <tr key={o.id}><Td className="uppercase">{o.channel}</Td><Td>{o.address}</Td><Td>{o.reason}</Td><Td>{fmtDate(o.createdAt)}</Td></tr>)}
        </Table>
      )}
    </div>
  )
}
