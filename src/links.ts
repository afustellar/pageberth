/* Wiki-style bidirectional links: [[target]] or [[target|alias]] */

const WIKI_SRC = '\\[\\[([^\\[\\]]+?)\\]\\]'
const CODE_SRC = '```[\\s\\S]*?```|`[^`\\n]*`'

export interface WikiLink {
  target: string
  alias: string
}

function scan(src: string, fn: (raw: string) => string | null): string {
  const stash: string[] = []
  // mask fenced code blocks and inline code so links inside them stay untouched
  const masked = src.replace(new RegExp(CODE_SRC, 'g'), m => {
    stash.push(m)
    return `\x00${stash.length - 1}\x00`
  })
  const transformed = masked.replace(new RegExp(WIKI_SRC, 'g'), (_whole, raw: string) => {
    const out = fn(raw)
    return out === null ? _whole : out
  })
  return transformed.replace(/\x00(\d+)\x00/g, (_m, i) => stash[Number(i)] ?? '')
}

export function extractWikiLinks(src: string): WikiLink[] {
  const out: WikiLink[] = []
  scan(src, raw => {
    const bar = raw.indexOf('|')
    const target = (bar >= 0 ? raw.slice(0, bar) : raw).trim()
    if (!target) return null
    const alias = (bar >= 0 ? raw.slice(bar + 1).trim() : '') || target
    out.push({ target, alias })
    return null
  })
  return out
}

export function wikiToMarkdown(src: string): string {
  return scan(src, raw => {
    const bar = raw.indexOf('|')
    const target = (bar >= 0 ? raw.slice(0, bar) : raw).trim()
    if (!target) return null
    let alias = (bar >= 0 ? raw.slice(bar + 1).trim() : '') || target
    if (/[\[\]]/.test(alias)) alias = target
    return `[${alias}](#inklink-${encodeURIComponent(target)})`
  })
}
