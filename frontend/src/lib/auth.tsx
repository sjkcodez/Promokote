import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { getToken, gql, setToken } from './api'
import { isLang, useI18n } from './i18n'
import type { User } from './types'

export const USER_FIELDS = `id email fullName emailVerified isStaff language organization { id name role smsEnabled emailEnabled smsActivated smsSenderId }`

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (token: string, user: User) => void
  signOut: () => void
  refresh: () => Promise<void>
}
const Ctx = createContext<AuthState>(null as unknown as AuthState)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!getToken())
  const { setLang } = useI18n()
  // A signed-in user's saved language follows them across devices and sessions.
  const adopt = useCallback((u: User | null) => { if (u && isLang(u.language)) setLang(u.language) }, [setLang])

  const refresh = useCallback(async () => {
    if (!getToken()) { setLoading(false); return }
    try {
      const d = await gql<{ me: User | null }>(`{ me { ${USER_FIELDS} } }`)
      setUser(d.me)
      adopt(d.me)
      if (!d.me) setToken(null)
    } catch { setUser(null) } finally { setLoading(false) }
  }, [adopt])
  useEffect(() => { void refresh() }, [refresh])

  const signIn = (token: string, u: User) => { setToken(token); setUser(u); adopt(u) }
  const signOut = () => { setToken(null); setUser(null) }
  return <Ctx.Provider value={{ user, loading, signIn, signOut, refresh }}>{children}</Ctx.Provider>
}
