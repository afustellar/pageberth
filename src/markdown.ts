import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'

for (const [name, grammar] of Object.entries({ javascript, typescript, json, python, bash, xml, css, markdown, yaml })) {
  hljs.registerLanguage(name, grammar)
}

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    code(code, info) {
      const language = info?.trim().split(/\s+/)[0].toLowerCase() || ''
      let content = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      if (language && hljs.getLanguage(language)) {
        try { content = hljs.highlight(code, { language, ignoreIllegals: true }).value }
        catch { /* Keep the escaped source if a grammar cannot parse it. */ }
      }
      return `<pre><code class="hljs">${content}\n</code></pre>`
    }
  }
})

export function renderMarkdown(src: string): string {
  const html = marked.parse(src, { async: false }) as string
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target']
  })
}

