import { useState } from 'react'
import { fmtDate, useQuery } from '../lib/api'
import type { Message } from '../lib/types'
import { Alert, Badge, Empty, Loading, PageHeader, Table, Td } from '../components/ui'

export default function Messages() {
  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')
  const { data, loading, error } = useQuery<{ messages: Message[] }>(
    `query($c:String,$s:String){ messages(limit:200, channel:$c, status:$s){ id channel source recipient subject body segments status error createdAt campaignName } }`,
    { c: channel || null, s: status || null })

  return (
    <div>
      <PageHeader title="Message log" subtitle="Every SMS and email sent from the console, campaigns or the API." />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input !w-auto" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">All channels</option><option value="sms">SMS</option><option value="email">Email</option></select>
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['sent', 'queued', 'failed', 'blocked'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <Alert>{error}</Alert>
      {loading ? <Loading /> : !data?.messages.length ? <Empty title="No messages" text="Messages you send will appear here with their delivery status." /> : (
        <Table head={['When', 'Channel', 'Recipient', 'Content', 'Source', 'Credits', 'Status']}>
          {data.messages.map((m) => (
            <tr key={m.id}>
              <Td className="whitespace-nowrap">{fmtDate(m.createdAt)}</Td>
              <Td className="uppercase">{m.channel}</Td>
              <Td>{m.recipient}</Td>
              <Td className="max-w-xs"><p className="truncate">{m.subject || m.body}</p>{m.error && <p className="text-xs text-red-600">{m.error}</p>}</Td>
              <Td className="capitalize">{m.campaignName ?? m.source}</Td>
              <Td>{m.segments}</Td>
              <Td><Badge>{m.status}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
