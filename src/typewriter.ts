import { EditorView } from '@codemirror/view'

export function makeTypewriter(enabled: () => boolean) {
  let raf = 0

  function tick(view: EditorView) {
    raf = 0
    if (!enabled()) return
    const pos = view.state.selection.main.head
    const coords = view.coordsAtPos(pos)
    if (!coords) return
    const scroller = view.scrollDOM
    const rect = scroller.getBoundingClientRect()
    const target = coords.top - (rect.top + rect.height / 2)
    if (Math.abs(target) < 2) return
    scroller.scrollBy({ top: target, behavior: 'auto' })
  }

  return EditorView.updateListener.of(u => {
    if (!u.selectionSet && !u.docChanged) return
    const view = u.view
    if (!raf) raf = requestAnimationFrame(() => tick(view))
  })
}
