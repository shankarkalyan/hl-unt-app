import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadSpecs } from './data/loadSpecs'
import { buildGraph } from './lib/openapi'
import GraphView from './components/GraphView'
import DetailsPanel from './components/DetailsPanel'
import './App.css'

function getInitialTheme() {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const { graph, errors, sources } = useMemo(() => {
    const specs = loadSpecs()
    const errors = specs.filter((s) => s.error).map((s) => `${s.name}: ${s.error}`)
    const graph = buildGraph(specs.map(({ name, doc }) => ({ name, doc })))
    const sources = [...new Set(graph.nodes.map((n) => n.source))].sort()
    return { graph, errors, sources }
  }, [])

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [kindFilter, setKindFilter] = useState('all')
  const [specFilter, setSpecFilter] = useState('all')
  const [theme, setTheme] = useState(getInitialTheme)
  const [controlType, setControlType] = useState('trackball')
  const [graphMaximized, setGraphMaximized] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [detailOpen, setDetailOpen] = useState(true)

  useEffect(() => {
    if (!graphMaximized) return
    const onKey = (e) => {
      if (e.key === 'Escape') setGraphMaximized(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [graphMaximized])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  // Scope everything (graph, search, stats) to the selected spec.
  const filteredGraph = useMemo(() => {
    if (specFilter === 'all') return graph
    const nodes = graph.nodes.filter((n) => n.source === specFilter)
    const ids = new Set(nodes.map((n) => n.id))
    const links = graph.links.filter((l) => ids.has(l.source) && ids.has(l.target))
    return { nodes, links }
  }, [graph, specFilter])

  // Clear any selection that no longer belongs to the active spec.
  useEffect(() => {
    setSelectedId(null)
  }, [specFilter])

  const nodesById = useMemo(
    () => new Map(filteredGraph.nodes.map((n) => [n.id, n])),
    [filteredGraph],
  )

  // Search matches: label / id / metadata contains the query (case-insensitive).
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return filteredGraph.nodes.filter((n) => {
      if (kindFilter !== 'all' && n.kind !== kindFilter) return false
      if (!q) return false
      const hay = [n.label, n.id, ...Object.values(n.meta)].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [filteredGraph, query, kindFilter])

  const highlightedIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches])
  const selectedNode = selectedId ? nodesById.get(selectedId) ?? null : null

  const select = (id) => setSelectedId(id || null)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">⬡</span>
          <div className="titles">
            <strong>API Explorer</strong>
            <span className="subtitle">Schema reference graph</span>
          </div>
        </div>

        <div className="search">
          <select
            className="spec-select"
            value={specFilter}
            onChange={(e) => setSpecFilter(e.target.value)}
            title="Filter by spec"
          >
            <option value="all">All specs</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="search-box">
            <span className="icon">🔍</span>
            <input
              type="search"
              placeholder={
                specFilter === 'all'
                  ? 'Search schemas & operations…'
                  : `Search in ${specFilter}…`
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="all">All types</option>
            <option value="schema">Schemas</option>
            <option value="operation">Operations</option>
          </select>
        </div>

        <div className="topbar-right">
          <div className="stats">
            <b>{filteredGraph.nodes.length}</b> nodes · <b>{filteredGraph.links.length}</b>{' '}
            links
          </div>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {errors.length > 0 && (
        <div className="errors">⚠️ Failed to parse: {errors.join(' | ')}</div>
      )}

      <div
        className="body"
        style={{
          gridTemplateColumns: `${sidebarOpen ? '290px' : '0px'} 1fr ${
            detailOpen ? '380px' : '0px'
          }`,
        }}
      >
        <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className="results-header">
            {query.trim()
              ? `${matches.length} match${matches.length === 1 ? '' : 'es'}`
              : 'Search results'}
          </div>
          {!query.trim() ? (
            <div className="placeholder">
              Type in the search box to find any schema or operation, then click a
              result to focus it in the graph.
            </div>
          ) : (
            <ul className="results">
              {matches.length === 0 && <li className="muted">No matches found</li>}
              {matches.map((m) => (
                <li
                  key={m.id}
                  className={m.id === selectedId ? 'active' : ''}
                  onClick={() => select(m.id)}
                >
                  <span className={`dot dot-${m.kind}`} />
                  <div className="result-text">
                    <div className="result-label">{m.label}</div>
                    {m.meta.summary && <div className="result-sub">{m.meta.summary}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="graph-pane">
          {graphMaximized ? (
            <div className="graph-collapsed">
              <div className="empty-illus">⬡</div>
              <p>Graph is maximized in full-screen view.</p>
              <button className="chip" onClick={() => setGraphMaximized(false)}>
                Restore here
              </button>
            </div>
          ) : (
            <GraphView
              graph={filteredGraph}
              theme={theme}
              selectedId={selectedId}
              highlightedIds={highlightedIds}
              controlType={controlType}
              onControlTypeChange={setControlType}
              onSelect={select}
              onMaximize={() => setGraphMaximized(true)}
            />
          )}

          <button
            className="panel-toggle left"
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? 'Hide search results' : 'Show search results'}
            aria-label="Toggle results panel"
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
          <button
            className="panel-toggle right"
            onClick={() => setDetailOpen((o) => !o)}
            title={detailOpen ? 'Hide details' : 'Show details'}
            aria-label="Toggle details panel"
          >
            {detailOpen ? '›' : '‹'}
          </button>
        </main>

        <aside className={`detail-pane ${detailOpen ? '' : 'collapsed'}`}>
          <DetailsPanel graph={filteredGraph} node={selectedNode} onSelect={select} />
        </aside>
      </div>

      {graphMaximized &&
        createPortal(
          <div className="modal-overlay" onClick={() => setGraphMaximized(false)}>
            <div
              className="graph-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title">
                  <span className="logo">⬡</span>
                  <h2>Schema graph</h2>
                  <span className="modal-source">
                    {specFilter === 'all' ? 'All specs' : specFilter} ·{' '}
                    {filteredGraph.nodes.length} nodes · {filteredGraph.links.length} links
                  </span>
                </div>
                <div className="modal-actions">
                  <button
                    className="icon-btn"
                    onClick={() => setGraphMaximized(false)}
                    title="Minimize"
                    aria-label="Minimize"
                  >
                    🗕
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setGraphMaximized(false)}
                    title="Close (Esc)"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="graph-modal-body">
                <GraphView
                  graph={filteredGraph}
                  theme={theme}
                  selectedId={selectedId}
                  highlightedIds={highlightedIds}
                  controlType={controlType}
                  onControlTypeChange={setControlType}
                  onSelect={select}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
