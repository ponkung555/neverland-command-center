import fs from 'fs'
import path from 'path'
import { AGENTS } from './fleet'

const BASE = '/home/asus/repos'
const JEANS_INBOX = path.join(BASE, 'jeans-oracle', 'ψ', 'inbox')
const WATCHER_LOG = '/tmp/watcher.log'
const MAX_EVENTS = 200
const WATCHER_TAIL_LINES = 400

export type ActivityKind = 'relay' | 'ack' | 'complete' | 'route' | 'watcher'

export interface ActivityEvent {
  id: string
  ts: string
  ms: number
  kind: ActivityKind
  text: string
  sender?: string
  recipient?: string
  agent?: string
}

const ANSI_RE = /\x1B\[[0-9;]*[a-zA-Z]/g
function stripAnsi(s: string) {
  return s.replace(ANSI_RE, '')
}

function parseWatcherTs(timeStr: string): number {
  const [h, m, s] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return 0
  const now = new Date()
  const candidate = new Date(now)
  candidate.setHours(h, m, s, 0)
  if (candidate.getTime() > now.getTime() + 60_000) {
    candidate.setDate(candidate.getDate() - 1)
  }
  return candidate.getTime()
}

function readWatcherEvents(): ActivityEvent[] {
  let raw = ''
  try {
    raw = fs.readFileSync(WATCHER_LOG, 'utf8')
  } catch {
    return []
  }
  const lines = raw.split('\n').slice(-WATCHER_TAIL_LINES)
  const events: ActivityEvent[] = []
  let lineIdx = 0
  for (const rawLine of lines) {
    lineIdx += 1
    const line = stripAnsi(rawLine).trim()
    if (!line) continue
    const m = line.match(/^\[WATCHER (\d{2}:\d{2}:\d{2})\]\s+(.*)$/)
    if (!m) continue
    const [, time, body] = m
    const ms = parseWatcherTs(time)
    if (!ms) continue

    // talk-to: [sender] -> [recipient] (session)
    const relayMatch = body.match(/^talk-to:\s*\[([^\]]+)\]\s*->\s*\[([^\]]+)\]/i)
    if (relayMatch) {
      const [, sender, recipient] = relayMatch
      events.push({
        id: `relay:${ms}:${lineIdx}`,
        ts: new Date(ms).toISOString(),
        ms,
        kind: 'relay',
        text: `${sender} → ${recipient}`,
        sender: sender.toLowerCase(),
        recipient: recipient.toLowerCase(),
      })
      continue
    }

    // Completion logged to ψ/outbox/<file>
    const completionMatch = body.match(/^Completion logged to\s+(.+)$/i)
    if (completionMatch) {
      events.push({
        id: `route:${ms}:${lineIdx}`,
        ts: new Date(ms).toISOString(),
        ms,
        kind: 'route',
        text: `routing: ${completionMatch[1]}`,
      })
      continue
    }

    // Skip noisy "Unknown inbox file" entries — they don't add signal.
    if (/^Unknown inbox file:/i.test(body)) continue

    events.push({
      id: `watcher:${ms}:${lineIdx}`,
      ts: new Date(ms).toISOString(),
      ms,
      kind: 'watcher',
      text: body,
    })
  }
  return events
}

function readAckEvents(): ActivityEvent[] {
  let entries: string[]
  try {
    entries = fs.readdirSync(JEANS_INBOX)
  } catch {
    return []
  }
  const events: ActivityEvent[] = []
  for (const name of entries) {
    const m = name.match(/^ack-([a-z0-9]+)-(.+)\.md$/)
    if (!m) continue
    const [, agent, topic] = m
    let ms = 0
    try {
      ms = fs.statSync(path.join(JEANS_INBOX, name)).mtimeMs
    } catch {
      continue
    }
    events.push({
      id: `ack:${name}:${ms}`,
      ts: new Date(ms).toISOString(),
      ms,
      kind: 'ack',
      text: `acked ${agent}: ${topic.replace(/-/g, ' ')}`,
      agent,
    })
  }
  return events
}

function readArchiveEvents(): ActivityEvent[] {
  const events: ActivityEvent[] = []
  for (const a of AGENTS) {
    const dir = path.join(BASE, a.oracle, 'ψ', 'archive')
    let files: string[]
    try {
      files = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const name of files) {
      if (name === '.gitkeep' || !name.endsWith('.md')) continue
      let ms = 0
      try {
        ms = fs.statSync(path.join(dir, name)).mtimeMs
      } catch {
        continue
      }
      events.push({
        id: `complete:${a.id}:${name}:${ms}`,
        ts: new Date(ms).toISOString(),
        ms,
        kind: 'complete',
        text: `${a.name} completed: ${name.replace(/\.md$/, '').replace(/-/g, ' ')}`,
        agent: a.id,
      })
    }
  }
  return events
}

export function listActivity(): ActivityEvent[] {
  const all = [
    ...readWatcherEvents(),
    ...readAckEvents(),
    ...readArchiveEvents(),
  ]
  all.sort((a, b) => b.ms - a.ms)
  return all.slice(0, MAX_EVENTS)
}

export function activityStateKey(events: ActivityEvent[]): string {
  return events.map(e => e.id).join('|')
}
