export interface WordStat {
  chars: number
  words: number
  readMinutes: number
}

export function wordStat(src: string): WordStat {
  const chars = src.length
  const cjk = (src.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length
  const latin = (src.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ').match(/[A-Za-z0-9_'-]+/g) || []).length
  const words = cjk + latin
  return { chars, words, readMinutes: Math.max(1, Math.round(words / 400)) }
}
