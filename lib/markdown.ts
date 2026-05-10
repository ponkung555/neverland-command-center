export interface ParsedMarkdown {
  title: string | null
  body: string
}

/**
 * Pulls a useful chat preview out of an agent's raw `.md` payload.
 * - Strips the leading `# Title` line (returned separately).
 * - Drops a frontmatter-ish header: consecutive `**Field**: …` lines and
 *   a single `---` separator that often follow.
 * - Trims leading/trailing whitespace from the result.
 */
export function parseMessageMarkdown(raw: string): ParsedMarkdown {
  const lines = raw.split('\n')
  let i = 0

  // Skip leading blank lines.
  while (i < lines.length && !lines[i].trim()) i++

  let title: string | null = null
  if (i < lines.length) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/)
    if (m) {
      title = m[1].trim()
      i++
    }
  }

  // Skip blank lines after title.
  while (i < lines.length && !lines[i].trim()) i++

  // Skip frontmatter-ish: **Field**: … lines + an optional --- separator.
  let inFrontmatter = false
  while (i < lines.length) {
    const line = lines[i]
    if (/^\*\*[^*]+\*\*\s*:/.test(line.trim())) {
      inFrontmatter = true
      i++
      continue
    }
    if (inFrontmatter && !line.trim()) {
      i++
      continue
    }
    if (inFrontmatter && /^-{3,}\s*$/.test(line.trim())) {
      i++
      // Skip trailing blank lines after ---
      while (i < lines.length && !lines[i].trim()) i++
      break
    }
    break
  }

  const body = lines.slice(i).join('\n').trim()
  return { title, body }
}
