import yaml from 'js-yaml'

/**
 * Auto-loads every OpenAPI/Swagger file bundled under `src/data/specs/`.
 *
 * To add your own specs: drop `.yaml`, `.yml`, or `.json` files into
 * `src/data/specs/` — Vite picks them up at build time via import.meta.glob,
 * no code changes needed.
 */
const modules = import.meta.glob('./specs/*.{yaml,yml,json}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * @typedef {{ name: string, doc: unknown, error?: string }} LoadedSpec
 * @returns {LoadedSpec[]}
 */
export function loadSpecs() {
  const specs = []
  for (const [path, raw] of Object.entries(modules)) {
    const name = path.split('/').pop() ?? path
    try {
      // js-yaml.load parses JSON too (JSON is a subset of YAML).
      const doc = yaml.load(raw)
      specs.push({ name, doc })
    } catch (err) {
      specs.push({ name, doc: null, error: err.message })
    }
  }
  return specs.sort((a, b) => a.name.localeCompare(b.name))
}
