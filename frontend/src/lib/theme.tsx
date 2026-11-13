import { createContext, ReactNode, useCallback, useContext, useState } from 'react'

/** Light / dark mode. The initial class is set by an inline script in index.html to avoid a flash. */
export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'promokote.theme'
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} })
export const useTheme = () => useContext(Ctx)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', next === 'dark')
      try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
      return next
    })
  }, [])
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}
