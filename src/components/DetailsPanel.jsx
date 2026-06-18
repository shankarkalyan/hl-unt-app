import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getRelations } from '../lib/openapi'
import Highlight from './Highlight'

/**
 * @param {{
 *   graph: import('../lib/openapi').Graph,
 *   node: import('../lib/openapi').GraphNode | null,
 *   query?: string,
 *   onSelect: (id: string) => void,
 * }} props
 */
export default function DetailsPanel({ graph, node, query = '', onSelect }) {
  const [expanded, setExpanded] = useState(false)

  // Close the maximized popup with Escape.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  // If the selection is cleared while maximized, drop back to the panel.
  useEffect(() => {
    if (!node) setExpanded(false)
  }, [node])

  if (!node) {
    return (
      <div className="details empty">
        <div className="empty-illus">⬡</div>
        <h3>No element selected</h3>
        <p>
          Select a node in the graph, or search above, to see its definition,
          metadata, and how it connects to the rest of the API.
        </p>
        <p className="empty-tip">
          Tip: once an element is shown, use the <strong>⛶ expand</strong> button to
          open its full definition in a full-screen view.
        </p>
      </div>
    )
  }

  const { references, referencedBy } = getRelations(graph, node.id)

  const body = (
    <>
      <dl className="meta">
        {Object.entries(node.meta)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                <Highlight text={v} query={query} />
              </dd>
            </div>
          ))}
      </dl>

      <RelationList title="References" nodes={references} onSelect={onSelect} />
      <RelationList title="Referenced by" nodes={referencedBy} onSelect={onSelect} />

      <h3>Definition</h3>
      <pre className="raw">{JSON.stringify(node.raw, null, 2)}</pre>
    </>
  )

  return (
    <>
      <div className="details">
        <div className="details-header">
          <div className="details-titlebar">
            <span className={`badge badge-${node.kind}`}>{node.kind}</span>
            <button
              className="icon-btn"
              onClick={() => setExpanded(true)}
              title="Expand to full screen"
              aria-label="Expand to full screen"
            >
              ⛶
            </button>
          </div>
          <h2>
            <Highlight text={node.label} query={query} />
          </h2>
          <div className="source">📄 {node.source}</div>
        </div>
        {body}
      </div>

      {expanded &&
        createPortal(
          <div className="modal-overlay" onClick={() => setExpanded(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title">
                  <span className={`badge badge-${node.kind}`}>{node.kind}</span>
                  <h2>
            <Highlight text={node.label} query={query} />
          </h2>
                  <span className="modal-source">📄 {node.source}</span>
                </div>
                <div className="modal-actions">
                  <button
                    className="icon-btn"
                    onClick={() => setExpanded(false)}
                    title="Minimize"
                    aria-label="Minimize"
                  >
                    🗕
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setExpanded(false)}
                    title="Close (Esc)"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="modal-body">{body}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function RelationList({ title, nodes, onSelect }) {
  if (nodes.length === 0) return null
  return (
    <div className="relations">
      <h3>
        {title} <span className="count">{nodes.length}</span>
      </h3>
      <ul>
        {nodes.map((n) => (
          <li key={n.id}>
            <button className={`chip chip-${n.kind}`} onClick={() => onSelect(n.id)}>
              {n.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
