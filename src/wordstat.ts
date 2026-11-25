export interface WordStat {
  chars: number
  words: number
  readMinutes: number
}

export function wordStat(src: string): WordStat {
  const chars = src.length
  let words = 0
  let inLatin = false
  for (let i = 0; i < chars; i++) {
    const c = src.charCodeAt(i)
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3040 && c <= 0x30ff) || (c >= 0xac00 && c <= 0xd7af)) {
      words++
      inLatin = false
    } else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95 || c === 39 || c === 45) {
      if (!inLatin) words++
      inLatin = true
    } else inLatin = false
  }
  return { chars, words, readMinutes: Math.max(1, Math.round(words / 400)) }
}
