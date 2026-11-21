const KEY = 'theme'
const ACCENT_KEY = 'headingColor'

/* Heading color options: 'ink' (near-black, default) | 'violet' (original mockup) | 'coral' (accent) */
const HEADINGS: Record<string, { light: string; dark: string }> = {
  ink: { light: '#242320', dark: '#F2F0EC' },
  violet: { light: '#534AB7', dark: '#AFA9EC' },
  coral: { light: '#B4451F', dark: '#F0997B' }
}

export type HeadingColor = keyof typeof HEADINGS

export function loadHeadingColor(): HeadingColor {
  let v: string | null = null
  try { v = localStorage.getItem('inkwell:' + ACCENT_KEY) } catch { /* ignore */ }
  return v && v in HEADINGS ? (v as HeadingColor) : 'ink'
}

const light: Record<string, string> = {
  bg: '#FFFFFF',
  panel: '#F7F6F2',
  border: '#E4E2DB',
  fg: '#2C2C2A',
  muted: '#8A887F',
  active: '#EFEDE6',
  input: '#F2F0EA',
  accent: '#D85A30',
  'accent-ink': '#712B13',
  mdH: '#242320',
  mdStrong: '#0F6E56',
  mdPunct: '#B4B2A9',
  mdCodeBg: '#FAEEDA',
  mdCodeFg: '#633806',
  mdLink: '#185FA5',
  mdQuote: '#5F5E5A'
}

const dark: Record<string, string> = {
  bg: '#17161B',
  panel: '#1E1D23',
  border: '#32313A',
  fg: '#E9E7E3',
  muted: '#9A98A2',
  active: '#2A2933',
  input: '#24232C',
  accent: '#F0997B',
  'accent-ink': '#4A1B0C',
  mdH: '#F2F0EC',
  mdStrong: '#5DCAA5',
  mdPunct: '#888780',
  mdCodeBg: '#2B2718',
  mdCodeFg: '#FAC775',
  mdLink: '#85B7EB',
  mdQuote: '#B4B2A9'
}

export type ThemeName = 'light' | 'dark'

export function applyHeadingColor(color: HeadingColor, name: ThemeName) {
  const h = HEADINGS[color] || HEADINGS.ink
  document.documentElement.style.setProperty('--ink-mdH', name === 'dark' ? h.dark : h.light)
}

export function applyTheme(name: ThemeName, heading?: HeadingColor) {
  const t = name === 'dark' ? dark : light
  const root = document.documentElement
  for (const [k, v] of Object.entries(t)) {
    root.style.setProperty(`--ink-${k}`, v)
  }
  applyHeadingColor(heading || loadHeadingColor(), name)
  root.dataset.theme = name
  try { localStorage.setItem('inkwell:' + KEY, name) } catch { /* ignore */ }
}

export function loadTheme(): ThemeName {
  let t: string | null = null
  try { t = localStorage.getItem('inkwell:' + KEY) } catch { /* ignore */ }
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  const name: ThemeName = t === 'dark' ? 'dark' : 'light'
  applyTheme(name)
  return name
}
