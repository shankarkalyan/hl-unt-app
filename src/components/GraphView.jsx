import { useEffect, useRef } from 'react'
import ForceGraph3D from '3d-force-graph'
import SpriteText from 'three-spritetext'
import { computeDegrees } from '../lib/openapi'

/**
 * 3D force-directed graph (WebGL via three.js, layout via d3-force-3d).
 *
 * Navigation depends on `controlType`:
 *   trackball — drag to rotate · scroll to zoom · right-drag to pan
 *   orbit     — drag to orbit · scroll to zoom · right-drag to pan
 *   fly       — WASD/arrows to move · drag to look · R/F up-down
 * Selecting a node flies the camera to centre on it.
 *
 * @param {{
 *   graph: import('../lib/openapi').Graph,
 *   theme: 'light' | 'dark',
 *   selectedId: string | null,
 *   highlightedIds: Set<string>,
 *   controlType: 'trackball' | 'orbit' | 'fly',
 *   onControlTypeChange: (c: 'trackball' | 'orbit' | 'fly') => void,
 *   onSelect: (id: string) => void,
 * }} props
 */

const KIND_COLORS = {
  schema: { light: '#2563eb', dark: '#5b8dff' },
  operation: { light: '#f59e0b', dark: '#fbbf24' },
}

const CONTROL_HINTS = {
  trackball: 'Drag to rotate · scroll to zoom · right-drag to pan',
  orbit: 'Drag to orbit · scroll to zoom · right-drag to pan',
  fly: 'WASD / arrows to fly · drag to look · R / F for up / down',
}

function theming(theme) {
  return theme === 'dark'
    ? { bg: '#000000', dim: '#2a2a2a', link: '#3a3a3a', linkActive: '#8b8b93', label: '#e4e4e7' }
    : { bg: '#ffffff', dim: '#dbe2ea', link: '#cbd5e1', linkActive: '#64748b', label: '#1e293b' }
}

function nodeBaseColor(kind, theme) {
  return KIND_COLORS[kind]?.[theme] ?? (theme === 'dark' ? '#71717a' : '#94a3b8')
}

export default function GraphView({
  graph,
  theme,
  selectedId,
  highlightedIds,
  controlType,
  onControlTypeChange,
  onMaximize,
  onSelect,
}) {
  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const neighboursRef = useRef(new Map())

  // Latest props for the accessor closures.
  const selectedRef = useRef(selectedId)
  const highlightedRef = useRef(highlightedIds)
  const themeRef = useRef(theme)
  selectedRef.current = selectedId
  highlightedRef.current = highlightedIds
  themeRef.current = theme

  // The set of nodes that should be emphasised (selected + neighbours + search hits).
  const activeSet = () => {
    const sel = selectedRef.current
    const hi = highlightedRef.current
    if (!sel && hi.size === 0) return null // null => everything is "active"
    const set = new Set()
    if (sel) {
      set.add(sel)
      neighboursRef.current.get(sel)?.forEach((n) => set.add(n))
    }
    hi.forEach((id) => set.add(id))
    return set
  }

  // Build the graph when data or control type changes.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const degrees = computeDegrees(graph)
    const nodes = graph.nodes.map((n) => ({ ...n, _deg: degrees.get(n.id) ?? 0 }))
    const links = graph.links.map((l) => ({ ...l }))

    // Neighbour map (from string ids, before the lib mutates link endpoints).
    const neighbours = new Map()
    for (const l of graph.links) {
      if (!neighbours.has(l.source)) neighbours.set(l.source, new Set())
      if (!neighbours.has(l.target)) neighbours.set(l.target, new Set())
      neighbours.get(l.source).add(l.target)
      neighbours.get(l.target).add(l.source)
    }
    neighboursRef.current = neighbours

    const t = theming(themeRef.current)

    const nodeColor = (node) => {
      const active = activeSet()
      if (active && !active.has(node.id)) return theming(themeRef.current).dim
      return nodeBaseColor(node.kind, themeRef.current)
    }
    const linkColor = (link) => {
      const tt = theming(themeRef.current)
      const active = activeSet()
      if (!active) return tt.link
      const s = typeof link.source === 'object' ? link.source.id : link.source
      const d = typeof link.target === 'object' ? link.target.id : link.target
      return active.has(s) && active.has(d) ? tt.linkActive : tt.dim
    }

    const Graph = new ForceGraph3D(container, { controlType })
      .graphData({ nodes, links })
      .backgroundColor(t.bg)
      .showNavInfo(false)
      .nodeId('id')
      .nodeLabel((n) => `${n.label}  ·  ${n.source}`)
      .nodeVal((n) => 1 + n._deg * 1.4)
      .nodeColor(nodeColor)
      .nodeOpacity(0.95)
      .nodeResolution(16)
      .linkColor(linkColor)
      .linkWidth(0.6)
      .linkOpacity(0.55)
      .linkCurvature(0.22)
      .linkDirectionalArrowLength(3.2)
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalArrowColor(linkColor)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleWidth(1.1)
      .linkDirectionalParticleSpeed(0.006)
      .nodeThreeObjectExtend(true)
      .nodeThreeObject((node) => {
        const active = activeSet()
        const sprite = new SpriteText(node.label)
        sprite.color =
          active && !active.has(node.id)
            ? theming(themeRef.current).dim
            : theming(themeRef.current).label
        sprite.textHeight = 3.2
        sprite.position.set(0, 6 + (1 + node._deg * 0.4), 0)
        sprite.material.depthWrite = false
        return sprite
      })
      .onNodeClick((node) => onSelect(node.id))
      .onBackgroundClick(() => onSelect(''))
      .width(container.clientWidth)
      .height(container.clientHeight)

    // A bit more spread so the structure is readable in 3D.
    Graph.d3Force('charge').strength(-120)

    graphRef.current = Graph

    const ro = new ResizeObserver(() => {
      Graph.width(container.clientWidth).height(container.clientHeight)
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      Graph._destructor?.()
      graphRef.current = null
      container.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, controlType])

  // Re-evaluate colours / labels when selection or search highlights change.
  useEffect(() => {
    const Graph = graphRef.current
    if (!Graph) return
    Graph.nodeColor(Graph.nodeColor())
      .linkColor(Graph.linkColor())
      .linkDirectionalArrowColor(Graph.linkColor())
      .nodeThreeObject(Graph.nodeThreeObject())
  }, [selectedId, highlightedIds])

  // Fly the camera to centre on the selected node.
  useEffect(() => {
    const Graph = graphRef.current
    if (!Graph || !selectedId) return
    const node = Graph.graphData().nodes.find((n) => n.id === selectedId)
    if (!node || node.x == null) return
    const dist = 110
    const h = Math.hypot(node.x, node.y, node.z) || 1
    const ratio = 1 + dist / h
    Graph.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      { x: node.x, y: node.y, z: node.z },
      1200,
    )
  }, [selectedId])

  // Recolour everything when the theme changes.
  useEffect(() => {
    const Graph = graphRef.current
    if (!Graph) return
    Graph.backgroundColor(theming(theme).bg)
      .nodeColor(Graph.nodeColor())
      .linkColor(Graph.linkColor())
      .linkDirectionalArrowColor(Graph.linkColor())
      .nodeThreeObject(Graph.nodeThreeObject())
  }, [theme])

  return (
    <div ref={containerRef} className="graph-container">
      {onMaximize && (
        <button
          className="graph-expand-btn"
          onClick={onMaximize}
          title="Expand graph to full screen"
          aria-label="Expand graph"
        >
          <span className="ico">⛶</span> Expand
        </button>
      )}
      <div className="graph-controls">
        {['trackball', 'orbit', 'fly'].map((c) => (
          <button
            key={c}
            className={`seg ${controlType === c ? 'active' : ''}`}
            onClick={() => onControlTypeChange(c)}
            title={`${c} controls`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="graph-legend">
        <span>
          <i style={{ background: nodeBaseColor('schema', theme) }} /> Schema
        </span>
        <span>
          <i style={{ background: nodeBaseColor('operation', theme) }} /> Operation
        </span>
      </div>
      <div className="graph-hint">{CONTROL_HINTS[controlType]}</div>
    </div>
  )
}
