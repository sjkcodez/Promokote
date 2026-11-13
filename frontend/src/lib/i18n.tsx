import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import en from './locales/en'
import sw from './locales/sw'

/**
 * Interface language. Kiswahili is the default for every new visitor; English is the alternative.
 * The choice is kept in localStorage (visitors) and in the user's profile (signed-in users, see LanguageSwitcher).
 * `en.ts` defines every key; `sw.ts` is typed against it, so a missing translation fails the build.
 */
export type Lang = 'sw' | 'en'
export type TKey = keyof typeof en
export type TVars = Record<string, string | number>
export const LANGS: Lang[] = ['sw', 'en']
const DICTS: Record<Lang, Record<TKey, string>> = { en, sw }
const STORAGE_KEY = 'promokote.lang'

function initial(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'sw') return v
  } catch { /* storage unavailable */ }
  return 'sw'
}

let current: Lang = initial()
/** Current language for non-React code (API client, date formatting). */
export const getLang = () => current
export const isLang = (v: unknown): v is Lang => v === 'sw' || v === 'en'

export function translate(lang: Lang, key: TKey, vars?: TVars) {
  let s: string = DICTS[lang][key] ?? en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

interface I18nState { lang: Lang; setLang: (l: Lang) => void; t: (key: TKey, vars?: TVars) => string }
const Ctx = createContext<I18nState>(null as unknown as I18nState)
export const useI18n = () => useContext(Ctx)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(current)
  const setLang = useCallback((l: Lang) => {
    current = l
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
    document.documentElement.lang = l
    setState(l)
  }, [])
  const value = useMemo(() => ({ lang, setLang, t: (k: TKey, v?: TVars) => translate(lang, k, v) }), [lang, setLang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
