/* Simple force-directed graph layout, no external deps. */

export interface GraphNode {
  id: string          // note label (filename without ext)
  x: number
  y: number
  degree: number
  orphan: boolean     // no links in or out
}

export interface GraphEdge {
  from: string
  to: string
}

export interface GraphInput {
  nodes: { label: string; outgoing: string[] }[]
}

export interface GraphLayout {
  width: number
  height: number
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const W = 640
const H = 420

export function layoutGraph(input: GraphInput): GraphLayout {
  const labels = new Set(input.nodes.map(n => n.label))
  // edges only between existing notes; resolve case-insensitively
  const resolve = (t: string) =>
    labels.has(t) ? t : (input.nodes.find(n => n.label.toLowerCase() === t.toLowerCase())?.label ?? null)

  const edges: GraphEdge[] = []
  const degree = new Map<string, number>()
  for (const n of input.nodes) degree.set(n.label, 0)

  for (const n of input.nodes) {
    for (const rawTarget of n.outgoing) {
      const to = resolve(rawTarget)
      if (!to || to === n.label) continue
      if (edges.some(e => e.from === n.label && e.to === to)) continue
      edges.push({ from: n.label, to })
      degree.set(n.label, (degree.get(n.label) || 0) + 1)
      degree.set(to, (degree.get(to) || 0) + 1)
    }
  }

  // seed positions on a spiral so the simulation starts spread out
  const nodes: GraphNode[] = input.nodes.map((n, i) => {
    const a = i * 2.39996 // golden angle
    const r = 30 + 22 * Math.sqrt(i)
    return {
      id: n.label,
      x: W / 2 + r * Math.cos(a),
      y: H / 2 + r * Math.sin(a),
      degree: degree.get(n.label) || 0,
      orphan: (degree.get(n.label) || 0) === 0
    }
  })

  const idx = new Map(nodes.map((n, i) => [n.id, i]))
  const k = Math.sqrt((W * H) / Math.max(1, nodes.length)) // ideal distance

  for (let iter = 0; iter < 300; iter++) {
    const fx = new Array(nodes.length).fill(0)
    const fy = new Array(nodes.length).fill(0)
    // repulsion (all pairs)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const d2 = Math.max(dx * dx + dy * dy, 25)
        const f = (k * k) / d2
        const d = Math.sqrt(d2)
        fx[i] += (dx / d) * f; fy[i] += (dy / d) * f
        fx[j] -= (dx / d) * f; fy[j] -= (dy / d) * f
      }
    }
    // attraction (edges)
    for (const e of edges) {
      const i = idx.get(e.from)!
      const j = idx.get(e.to)!
      const dx = nodes[j].x - nodes[i].x
      const dy = nodes[j].y - nodes[i].y
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const f = (d * d) / k
      fx[i] += (dx / d) * f; fy[i] += (dy / d) * f
      fx[j] -= (dx / d) * f; fy[j] -= (dy / d) * f
    }
    // gravity toward center + integrate
    const temp = 8 * (1 - iter / 300) + 0.5
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      fx[i] += ((W / 2 - n.x) / W) * k * 0.6
      fy[i] += ((H / 2 - n.y) / H) * k * 0.6
      const disp = Math.min(Math.sqrt(fx[i] ** 2 + fy[i] ** 2), temp)
      const d = Math.max(Math.sqrt(fx[i] ** 2 + fy[i] ** 2), 0.01)
      n.x += (fx[i] / d) * disp
      n.y += (fy[i] / d) * disp
      n.x = Math.max(30, Math.min(W - 30, n.x))
      n.y = Math.max(30, Math.min(H - 30, n.y))
    }
  }

  return { width: W, height: H, nodes, edges }
}
