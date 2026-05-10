import fs from 'fs'
import path from 'path'

const BASE = '/home/asus/repos'
export const JEANS_INBOX = path.join(BASE, 'jeans-oracle', 'ψ', 'inbox')

export const POON_ID = 'poon'

export interface InboxMessage {
  id: string          // filename
  sender: string      // agent id (or 'poon')
  recipient: string   // agent id
  topic: string       // slug from filename
  content: string     // raw file body
  ts: string          // mtime ISO
  mtimeMs: number
}

const TALK_RE = /^talk-([a-z0-9]+)-to-([a-z0-9]+)-(.+)\.md$/

export function listMessages(): InboxMessage[] {
  let entries: string[]
  try {
    entries = fs.readdirSync(JEANS_INBOX)
  } catch {
    return []
  }
  const messages: InboxMessage[] = []
  for (const name of entries) {
    const m = name.match(TALK_RE)
    if (!m) continue
    const [, sender, recipient, topic] = m
    const full = path.join(JEANS_INBOX, name)
    let content = ''
    let mtimeMs = 0
    try {
      const stat = fs.statSync(full)
      mtimeMs = stat.mtimeMs
      content = fs.readFileSync(full, 'utf8')
    } catch {
      continue
    }
    messages.push({
      id: name,
      sender,
      recipient,
      topic,
      content,
      ts: new Date(mtimeMs).toISOString(),
      mtimeMs,
    })
  }
  messages.sort((a, b) => a.mtimeMs - b.mtimeMs)
  return messages
}

export function inboxStateKey(messages: InboxMessage[]): string {
  return messages.map(m => `${m.id}:${m.mtimeMs}`).join('|')
}

export function slugify(input: string, max = 40): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!cleaned) return 'msg'
  return cleaned.length > max ? cleaned.slice(0, max).replace(/-+$/, '') : cleaned
}

export function buildFilename(recipient: string, content: string): string {
  const firstLine = content.split('\n').find(l => l.trim()) ?? 'msg'
  const slug = slugify(firstLine)
  const ts = Date.now()
  return `talk-${POON_ID}-to-${recipient}-${slug}-${ts}.md`
}
