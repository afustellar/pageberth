/* Self-contained HTML export: renders markdown to a single portable file.
   Theme colors are inlined from the live --ink-* variables at export time,
   so the exported file matches whatever theme the user is in. */

import { renderMarkdown } from './markdown'
import { mapWiki } from './links'

function palette(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement)
  const names = ['bg', 'panel', 'border', 'fg', 'muted', 'accent', 'mdH', 'mdStrong', 'mdCodeBg', 'mdCodeFg', 'mdLink', 'mdQuote']
  const out: Record<string, string> = {}
  for (const n of names) {
    const v = cs.getPropertyValue(`--ink-${n}`).trim()
    if (v) out[n] = v
  }
  return out
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildStandaloneHtml(title: string, markdownSrc: string): string {
  // wiki links have no meaning in a standalone file: keep their visible text
  const bodySrc = mapWiki(markdownSrc, raw => {
    const bar = raw.indexOf('|')
    const target = (bar >= 0 ? raw.slice(0, bar) : raw).trim()
    if (!target) return null
    return (bar >= 0 ? raw.slice(bar + 1).trim() : '') || target
  })
  const p = palette()
  const c = (n: string, fb: string) => p[n] || fb
  const body = renderMarkdown(bodySrc)
  const when = new Date().toLocaleString('zh-CN', { dateStyle: 'long', timeStyle: 'short' })

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --bg: ${c('bg', '#FFFFFF')};
    --panel: ${c('panel', '#F7F6F2')};
    --border: ${c('border', '#E4E2DB')};
    --fg: ${c('fg', '#2C2C2A')};
    --muted: ${c('muted', '#8A887F')};
    --accent: ${c('accent', '#D85A30')};
    --h: ${c('mdH', '#534AB7')};
    --strong: ${c('mdStrong', '#0F6E56')};
    --codebg: ${c('mdCodeBg', '#FAEEDA')};
    --codefg: ${c('mdCodeFg', '#633806')};
    --link: ${c('mdLink', '#185FA5')};
    --quote: ${c('mdQuote', '#5F5E5A')};
    color-scheme: ${document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'};
  }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    line-height: 1.75;
  }
  main { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }
  header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 12px;
    margin-bottom: 32px;
    color: var(--muted);
    font-size: 13px;
  }
  header h1 { color: var(--fg); font-size: 24px; margin: 0 0 4px; }
  h1, h2, h3, h4, h5, h6 { color: var(--h); line-height: 1.4; }
  h1 { font-size: 26px; } h2 { font-size: 21px; } h3 { font-size: 17px; }
  a { color: var(--link); }
  strong { color: var(--strong); }
  code {
    font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
    font-size: 0.9em;
    background: var(--codebg);
    color: var(--codefg);
    padding: 1px 5px;
    border-radius: 4px;
  }
  pre { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; overflow-x: auto; }
  pre code { background: none; padding: 0; color: var(--fg); }
  blockquote { margin: 0; padding: 2px 16px; border-left: 3px solid var(--accent); color: var(--quote); }
  hr { border: none; border-top: 1px solid var(--border); }
  table { border-collapse: collapse; }
  th, td { border: 1px solid var(--border); padding: 5px 10px; }
  img { max-width: 100%; }
  footer { margin-top: 56px; color: var(--muted); font-size: 12px; text-align: center; }
</style>
</head>
<body>
<main>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div>由 Inkwell 导出 · ${escapeHtml(when)}</div>
  </header>
  ${body}
  <footer>Inkwell · 本地优先的 Markdown 写作间</footer>
</main>
</body>
</html>`
}
