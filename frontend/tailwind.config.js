/**
 * Promokote design tokens.
 * Brand: amber (primary actions, highlights, active states). Neutrals: grey + black/white.
 * Semantic colours (`canvas`, `surface`, `fg`, `accent`...) read CSS variables from src/index.css, so every
 * component switches between light and dark mode automatically. Change colours there, not in components.
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
          500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f',
        },
        canvas: v('canvas'),
        surface: v('surface'),
        subtle: v('subtle'),
        line: { DEFAULT: v('line'), strong: v('line-strong') },
        fg: v('fg'),
        muted: v('muted'),
        faint: v('faint'),
        accent: { DEFAULT: v('accent'), soft: v('accent-soft'), ink: v('accent-ink'), line: v('accent-line') },
        success: { DEFAULT: v('success'), soft: v('success-soft') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft') },
        ink: v('ink'),          // always-dark surfaces (sidebar, hero bands)
        'on-brand': '#111113', // text on amber
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
