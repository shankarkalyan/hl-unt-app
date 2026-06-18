# API Explorer — Schema Reference Graph

A ReactJS + D3.js app that loads bundled OpenAPI / Swagger specs, renders them as a
force-directed **network graph**, and lets you **search** for any element (schema or
operation) to see its definition and how it connects to the rest of the API.

- **Nodes** — schemas (`components.schemas` / `definitions`) and operations (`paths.*.<method>`)
- **Edges** — `$ref` usage: operation → schema and schema → schema
- **Search** — filter by name / metadata, filter by kind, click a result to focus it in the graph
- **Details panel** — raw definition, metadata, and clickable "References" / "Referenced by" lists
- **Graph** — zoom, pan, drag nodes; selecting a node dims everything except its neighbours

Supports both **OpenAPI 3.x** (`#/components/schemas/X`) and **Swagger 2.0** (`#/definitions/X`).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Add your own specs

Drop `.yaml`, `.yml`, or `.json` OpenAPI files into **`src/data/specs/`**.
They are picked up automatically at build time (via Vite's `import.meta.glob`) —
no code changes needed. The included Home Lending samples
(`loan-origination.yaml`, `loan-servicing.json`) are just examples; delete them
if you don't need them.

## Project layout

```
src/
  data/
    loadSpecs.ts     # auto-discovers & parses every spec in specs/
    specs/           # << drop your YAML/JSON OpenAPI files here
  lib/
    openapi.ts       # spec -> graph (nodes, links, relations, degrees)
  components/
    GraphView.tsx    # D3 force-directed graph
    DetailsPanel.tsx # selected element details + relations
  App.tsx            # search, filters, layout, state
  types.ts           # GraphNode / GraphLink / Graph
```
