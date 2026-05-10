import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { Agent, AgentStatus, FleetData } from './types'

const BASE = '/home/asus/repos'
const JEANS_INBOX = path.join(BASE, 'jeans-oracle', 'ψ', 'inbox')
const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000

export const AGENTS = [
  { id: 'jeans',   name: 'Jeans',   session: '01-jeans',   oracle: 'jeans-oracle'   },
  { id: 'annie',   name: 'Annie',   session: '50-annie',   oracle: 'annie-oracle'   },
  { id: 'michael', name: 'Michael', session: '50-michael', oracle: 'michael-oracle' },
  { id: 'rock',    name: 'Rock',    session: '50-rock',    oracle: 'rock-oracle'    },
  { id: 'enough',  name: 'Enough',  session: '50-enough',  oracle: 'enough-oracle'  },
  { id: 'us',      name: 'Us',      session: '50-us',      oracle: 'us-oracle'      },
] as const

type PaneSignal = 'thinking' | 'active' | 'idle' | 'missing'

const DOT_THINKING = '◐'
const DOT_ACTIVE   = '●'

function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B[@-Z\\-_]/g, '')
}

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000 })
  } catch {
    return ''
  }
}

function parsePaneSignals(raw: string): Map<string, PaneSignal> {
  const map = new Map<string, PaneSignal>()
  for (const rawLine of raw.split('\n')) {
    const line = stripAnsi(rawLine)
    const m = line.match(/([●◐◌])\s+(\S+):\d+\.\d+\s+(\S+)/)
    if (!m) continue
    const [, dot, session, cmd] = m
    if (cmd === 'bash') continue
    let signal: PaneSignal
    if (dot === DOT_THINKING) signal = 'thinking'
    else if (dot === DOT_ACTIVE) signal = 'active'
    else signal = 'idle'
    const prior = map.get(session)
    if (!prior || prior === 'idle' || (prior === 'active' && signal === 'thinking')) {
      map.set(session, signal)
    }
  }
  return map
}

function getActiveTask(oracle: string): string | null {
  const dir = path.join(BASE, oracle, 'ψ', 'active')
  try {
    const files = fs.readdirSync(dir).filter(f => f !== '.gitkeep' && f.endsWith('.md'))
    if (!files.length) return null
    return files.sort().pop()!.replace(/\.md$/, '').replace(/-/g, ' ')
  } catch {
    return null
  }
}

function getLastArchiveTask(oracle: string): string | null {
  const dir = path.join(BASE, oracle, 'ψ', 'archive')
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f !== '.gitkeep' && f.endsWith('.md'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    if (!files.length) return null
    return files[0].name.replace(/\.md$/, '').replace(/-/g, ' ')
  } catch {
    return null
  }
}

function latestMtime(dir: string, predicate: (name: string) => boolean): number {
  let latest = 0
  try {
    for (const file of fs.readdirSync(dir)) {
      if (file === '.gitkeep' || !predicate(file)) continue
      const mtime = fs.statSync(path.join(dir, file)).mtimeMs
      if (mtime > latest) latest = mtime
    }
  } catch {}
  return latest
}

function getLastAck(agentId: string, oracle: string): string | null {
  const ownDirs = [
    path.join(BASE, oracle, 'ψ', 'active'),
    path.join(BASE, oracle, 'ψ', 'archive'),
  ]
  let latest = 0
  for (const dir of ownDirs) {
    const m = latestMtime(dir, () => true)
    if (m > latest) latest = m
  }
  const inboxLatest = latestMtime(
    JEANS_INBOX,
    name => name.startsWith(`talk-${agentId}-`) || name.startsWith(`ack-${agentId}-`),
  )
  if (inboxLatest > latest) latest = inboxLatest
  return latest > 0 ? new Date(latest).toISOString() : null
}

function deriveStatus(signal: PaneSignal, lastAck: string | null): AgentStatus {
  if (signal === 'thinking') return 'active'
  if (signal === 'active') return 'idle'
  if (signal === 'idle') return 'offline'
  if (!lastAck) return 'offline'
  return Date.now() - new Date(lastAck).getTime() > OFFLINE_THRESHOLD_MS ? 'offline' : 'idle'
}

export function computeFleet(): FleetData {
  const panesRaw = run('maw panes 2>/dev/null')
  const signals = parsePaneSignals(panesRaw)
  const panesAvailable = signals.size > 0
  const fetchedAt = new Date().toISOString()

  const agents: Agent[] = AGENTS.map(agent => {
    const signal: PaneSignal = panesAvailable
      ? (signals.get(agent.session) ?? 'missing')
      : 'missing'
    const lastAck = getLastAck(agent.id, agent.oracle)
    const activeTask = getActiveTask(agent.oracle)
    const archiveTask = getLastArchiveTask(agent.oracle)
    const task = activeTask ?? (archiveTask ? `Last: ${archiveTask}` : null)
    const status = deriveStatus(signal, lastAck)
    return { id: agent.id, name: agent.name, status, task, lastAck }
  })

  return { agents, fetchedAt }
}

export function fleetStateKey(data: FleetData): string {
  // fetchedAt excluded — only structural state changes trigger pushes.
  return JSON.stringify(data.agents)
}
