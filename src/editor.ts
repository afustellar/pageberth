import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor, dropCursor } from '@codemirror/view'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

const inkHighlight = HighlightStyle.define([
  { tag: t.heading1, color: 'var(--ink-mdH)', fontWeight: '700' },
  { tag: t.heading2, color: 'var(--ink-mdH)', fontWeight: '600' },
  { tag: t.heading3, color: 'var(--ink-mdH)', fontWeight: '600' },
  { tag: t.heading4, color: 'var(--ink-mdH)' },
  { tag: t.heading5, color: 'var(--ink-mdH)' },
  { tag: t.heading6, color: 'var(--ink-mdH)' },
  { tag: t.strong, color: 'var(--ink-mdStrong)', fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.monospace, color: 'var(--ink-mdCodeFg)', background: 'var(--ink-mdCodeBg)', borderRadius: '3px' },
  { tag: t.link, color: 'var(--ink-mdLink)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--ink-mdLink)' },
  { tag: t.quote, color: 'var(--ink-mdQuote)', fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--ink-mdQuote)' }
])

export const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-fg)' },
  '.cm-content': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontSize: '13px',
    lineHeight: '2',
    padding: '14px 0'
  },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-line': { padding: '0 16px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': {
    backgroundColor: 'var(--ink-bg)',
    color: 'var(--ink-mdPunct)',
    border: 'none',
    fontSize: '11px'
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--ink-accent) 7%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink-accent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--ink-accent) 18%, transparent) !important'
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink-accent)' },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--ink-accent) 22%, transparent)' },
  '.cm-searchMatchSelected': { backgroundColor: 'color-mix(in srgb, var(--ink-accent) 40%, transparent)' }
}, { dark: false })

export type EditorHandle = {
  view: EditorView
  themeComp: Compartment
  darkComp: Compartment
}

export function createEditor(parent: HTMLElement, doc: string, onChange: (v: string) => void, extra: Extension[] = []) {
  const themeComp = new Compartment()
  const darkComp = new Compartment()

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        rectangularSelection(),
        crosshairCursor(),
        dropCursor(),
        history(),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(inkHighlight),
        editorTheme,
        themeComp.of([]),
        darkComp.of([]),
        highlightSelectionMatches(),
        ...extra,
        keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
        EditorView.updateListener.of(u => {
          if (u.docChanged) onChange(view.state.doc.toString())
        })
      ]
    })
  })
  return { view, themeComp, darkComp }
}
