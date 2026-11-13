import { Moon, Sun } from 'lucide-react'
import { gql } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Lang, LANGS, useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'

/** SW | EN switch. Signed-in users also get the choice saved to their profile. */
export function LanguageSwitcher({ onDark = false }: { onDark?: boolean }) {
  const { lang, setLang, t } = useI18n()
  const { user } = useAuth()
  function choose(l: Lang) {
    if (l === lang) return
    setLang(l)
    if (user) void gql('mutation($l:String!){setLanguage(language:$l){user{language}}}', { l }).catch(() => {})
  }
  const wrap = onDark ? 'bg-white/10' : 'bg-subtle'
  return (
    <div role="group" aria-label={t('prefs.language')} className={`inline-flex rounded-lg p-0.5 ${wrap}`}>
      {LANGS.map((l) => (
        <button key={l} type="button" onClick={() => choose(l)} aria-pressed={l === lang} title={l === 'sw' ? 'Kiswahili' : 'English'}
          className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase transition ${l === lang ? 'bg-brand-500 text-on-brand' : onDark ? 'text-zinc-300 hover:text-white' : 'text-muted hover:text-fg'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  const label = theme === 'dark' ? t('prefs.lightMode') : t('prefs.darkMode')
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label}
      className={`rounded-lg p-2 transition ${onDark ? 'text-zinc-300 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-subtle hover:text-fg'}`}>
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
