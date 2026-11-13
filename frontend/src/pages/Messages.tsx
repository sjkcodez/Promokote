import { useState } from 'react'
import { fmtDate, useQuery } from '../lib/api'
import { TKey, useI18n } from '../lib/i18n'
import type { Message } from '../lib/types'
import { Alert, Badge, Empty, Loading, PageHeader, Table, Td } from '../components/ui'

export default function Messages() {
  const { t } = useI18n()
  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')
  const { data, loading, error } = useQuery<{ messages: Message[] }>(
    `query($c:String,$s:String){ messages(limit:200, channel:$c, status:$s){ id channel source recipient subject body segments status error createdAt campaignName billingSource senderId } }`,
    { c: channel || null, s: status || null })

  return (
    <div>
      <PageHeader title={t('msgs.title')} subtitle={t('msgs.subtitle')} />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input !w-auto" aria-label={t('col.channel')} value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">{t('msgs.allChannels')}</option><option value="sms">{t('common.sms')}</option><option value="email">{t('common.email')}</option></select>
        <select className="input !w-auto" aria-label={t('col.status')} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t('msgs.allStatuses')}</option>{['sent', 'queued', 'failed', 'blocked'].map((s) => <option key={s} value={s}>{t(`status.${s}` as TKey)}</option>)}</select>
      </div>
      <Alert>{error}</Alert>
      {loading ? <Loading /> : !data?.messages.length ? <Empty title={t('msgs.empty.title')} text={t('msgs.empty.text')} /> : (
        <Table head={[t('col.when'), t('col.channel'), t('col.recipient'), t('msgs.col.content'), t('msgs.col.source'), t('msgs.col.credits'), t('col.status')]}>
          {data.messages.map((m) => (
            <tr key={m.id}>
              <Td className="whitespace-nowrap">{fmtDate(m.createdAt)}</Td>
              <Td className="uppercase">{m.channel}</Td>
              <Td>{m.recipient}{m.senderId && <p className="text-xs text-muted">{t('msgs.from', { sender: m.senderId })}</p>}</Td>
              <Td className="max-w-xs"><p className="truncate">{m.subject || m.body}</p>{m.error && <p className="text-xs text-danger">{m.error}</p>}</Td>
              <Td>{m.campaignName ?? t(`source.${m.source}` as TKey)}{m.billingSource === 'demo' && <span className="ml-2"><Badge>demo</Badge></span>}</Td>
              <Td>{m.segments}</Td>
              <Td><Badge>{m.status}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
