import { useCallback, useEffect, useState } from 'react'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'
const TOKEN_KEY = 'promokote.token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

/** Minimal GraphQL client. Throws Error(message) with the server's human-readable message. */
export async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/graphql/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify({ query, variables }),
    })
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.')
  }
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data as T
}

export function useQuery<T = any>(query: string, variables: Record<string, unknown> = {}) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const key = JSON.stringify(variables)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await gql<T>(query, JSON.parse(key)))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [query, key])
  useEffect(() => { void reload() }, [reload])
  return { data, loading, error, reload }
}

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dar_es_Salaam' }) : '-'
export const fmtMoney = (n: number, cur = 'TZS') => `${cur} ${Math.round(n).toLocaleString('en-US')}`

// GSM-7 / Unicode segment counter (mirrors the backend)
const GSM7 = new Set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")
const EXT = new Set('^{}\\[~]|€\f')
export function smsInfo(text: string) {
  const chars = Array.from(text)
  if (chars.every((c) => GSM7.has(c) || EXT.has(c))) {
    const length = chars.reduce((n, c) => n + (EXT.has(c) ? 2 : 1), 0)
    return { encoding: 'GSM-7', length, segments: length <= 160 ? 1 : Math.ceil(length / 153) }
  }
  const length = chars.length
  return { encoding: 'Unicode', length, segments: length <= 70 ? 1 : Math.ceil(length / 67) }
}
