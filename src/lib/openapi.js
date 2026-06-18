/**
 * Parses one or more OpenAPI / Swagger documents into a network graph.
 *
 *   nodes = schemas (components.schemas / definitions) + operations (paths.*.<method>)
 *   links = $ref usage:  operation -> schema,  schema -> schema
 *
 * Both OpenAPI 3.x (`components.schemas`, `#/components/schemas/X`) and
 * Swagger 2.0 (`definitions`, `#/definitions/X`) are supported.
 *
 * @typedef {'schema' | 'operation'} NodeKind
 * @typedef {{ id: string, label: string, kind: NodeKind, source: string, raw: unknown, meta: Record<string, string|undefined> }} GraphNode
 * @typedef {{ source: string, target: string }} GraphLink
 * @typedef {{ nodes: GraphNode[], links: GraphLink[] }} Graph
 */

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

function isObj(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Recursively collect every `$ref` string value found inside `obj`. */
function collectRefs(obj, out) {
  if (Array.isArray(obj)) {
    for (const item of obj) collectRefs(item, out)
    return
  }
  if (!isObj(obj)) return
  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') out.add(value)
    else collectRefs(value, out)
  }
}

/**
 * Map a local `$ref` to a schema node id.
 * Handles `#/components/schemas/Pet` and `#/definitions/Pet`.
 * Returns null for external/remote refs we don't model as nodes.
 */
function refToSchemaId(ref) {
  const m = ref.match(/#\/(?:components\/schemas|definitions)\/(.+)$/)
  if (!m) return null
  // ref names may be URL-encoded (e.g. nested paths); decode the last segment.
  const name = decodeURIComponent(m[1])
  return `schema:${name}`
}

/**
 * @param {{ name: string, doc: unknown }[]} specs
 * @returns {Graph}
 */
export function buildGraph(specs) {
  const nodes = new Map()
  const links = []
  const linkSet = new Set()

  const addLink = (source, target) => {
    if (source === target) return
    const key = `${source}->${target}`
    if (linkSet.has(key)) return
    linkSet.add(key)
    links.push({ source, target })
  }

  for (const { name, doc } of specs) {
    if (!isObj(doc)) continue

    // --- Schemas ---------------------------------------------------------
    const schemas =
      (isObj(doc.components) && isObj(doc.components.schemas)
        ? doc.components.schemas
        : undefined) ??
      (isObj(doc.definitions) ? doc.definitions : undefined) ??
      {}

    for (const [schemaName, schemaDef] of Object.entries(schemas)) {
      const id = `schema:${schemaName}`
      nodes.set(id, {
        id,
        label: schemaName,
        kind: 'schema',
        source: name,
        raw: schemaDef,
        meta: {
          type: isObj(schemaDef) ? schemaDef.type : undefined,
          description: isObj(schemaDef) ? schemaDef.description : undefined,
        },
      })
    }

    // Edges between schemas (created in a second pass so targets exist).
    for (const [schemaName, schemaDef] of Object.entries(schemas)) {
      const id = `schema:${schemaName}`
      const refs = new Set()
      collectRefs(schemaDef, refs)
      for (const ref of refs) {
        const targetId = refToSchemaId(ref)
        if (targetId) addLink(id, targetId)
      }
    }

    // --- Operations ------------------------------------------------------
    const paths = isObj(doc.paths) ? doc.paths : {}
    for (const [path, pathItem] of Object.entries(paths)) {
      if (!isObj(pathItem)) continue
      for (const method of HTTP_METHODS) {
        const op = pathItem[method]
        if (!isObj(op)) continue
        const id = `op:${method} ${path}`
        nodes.set(id, {
          id,
          label: `${method.toUpperCase()} ${path}`,
          kind: 'operation',
          source: name,
          raw: op,
          meta: {
            method: method.toUpperCase(),
            path,
            operationId: op.operationId,
            summary: op.summary,
            tags: Array.isArray(op.tags) ? op.tags.join(', ') : undefined,
          },
        })

        const refs = new Set()
        collectRefs(op, refs)
        for (const ref of refs) {
          const targetId = refToSchemaId(ref)
          if (targetId) addLink(id, targetId)
        }
      }
    }
  }

  // Drop links whose endpoints don't resolve to a known node.
  const valid = links.filter((l) => nodes.has(l.source) && nodes.has(l.target))
  return { nodes: [...nodes.values()], links: valid }
}

/** Degree (incoming + outgoing) per node id — used to size graph nodes. */
export function computeDegrees(graph) {
  const deg = new Map()
  for (const n of graph.nodes) deg.set(n.id, 0)
  for (const l of graph.links) {
    deg.set(l.source, (deg.get(l.source) ?? 0) + 1)
    deg.set(l.target, (deg.get(l.target) ?? 0) + 1)
  }
  return deg
}

/**
 * @param {Graph} graph
 * @param {string} nodeId
 * @returns {{ references: GraphNode[], referencedBy: GraphNode[] }}
 */
export function getRelations(graph, nodeId) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const references = []
  const referencedBy = []
  for (const l of graph.links) {
    if (l.source === nodeId) {
      const n = byId.get(l.target)
      if (n) references.push(n)
    } else if (l.target === nodeId) {
      const n = byId.get(l.source)
      if (n) referencedBy.push(n)
    }
  }
  return { references, referencedBy }
}
