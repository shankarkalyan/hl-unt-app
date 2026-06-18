/**
 * Renders `text`, wrapping every (case-insensitive) occurrence of `query`
 * in a <mark> so search matches are visually highlighted.
 *
 * @param {{ text: unknown, query: string }} props
 */
export default function Highlight({ text, query }) {
  const str = text == null ? '' : String(text)
  const q = (query ?? '').trim()
  if (!q) return str

  const lower = str.toLowerCase()
  const ql = q.toLowerCase()
  const parts = []
  let i = 0
  let key = 0
  while (i < str.length) {
    const found = lower.indexOf(ql, i)
    if (found === -1) {
      parts.push(str.slice(i))
      break
    }
    if (found > i) parts.push(str.slice(i, found))
    parts.push(
      <mark className="hl" key={key++}>
        {str.slice(found, found + q.length)}
      </mark>,
    )
    i = found + q.length
  }
  return parts
}
