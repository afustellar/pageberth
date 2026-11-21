export interface Heading {
  level: number
  text: string
  line: number // 0-based
}

export function extractHeadings(doc: string): Heading[] {
  const out: Heading[] = []
  let fence = false
  const lines = doc.split(/\r?\n/)
  lines.forEach((ln, i) => {
    if (/^\s{0,3}(```|~~~)/.test(ln)) {
      fence = !fence
      return
    }
    if (fence) return
    const m = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(ln)
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i })
  })
  return out
}
