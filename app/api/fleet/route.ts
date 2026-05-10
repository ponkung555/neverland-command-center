import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { Agent, AgentStatus } from '@/lib/types'

const BASE = '/home/asus/repos'
const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000

const AGENTS = [
  { id: 'jeans',   name: 'Jeans',   session: '01-jeans',   oracle: 'jeans-oracle'   },
  { id: 'annie',   name: 'Annie',   session: '50-annie',   oracle: 'annie-oracle'   },
  { id: 'michael', name: 'Michael', session: '50-michael', oracle: 'michael-oracle' },
  { id: 'rock',    name: 'Rock',    session: '50-rock',    oracle: 'rock-oracle'    },
  { id: 'enough',  name: 'Enough',  session: '50-enough',  oracle: 'enough-oracle'  },
  { id: 'us',      name: 'Us',      session: '50-us',      oracle: 'us-oracle'      },
]

const THINKING_RE = /(Thinking|Ruminating|Cogitating|Doodling|Meandering|Booping|Tempering|Whatchamacalliting|Crunching)[^(]*\(\d+[^)]*\)/i

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

function getLastAck(oracle: string): string | null {
  const dirs = [
    path.join(BASE, oracle, 'ψ', 'active'),
    path.join(BASE, oracle, 'ψ', 'archive'),
  ]
  let latest = 0
  for (const dir of dirs) {
    try {
      for (const file of fs.readdirSync(dir)) {
        if (file === '.gitkeep') continue
        const mtime = fs.statSync(path.join(dir, file)).mtimeMs
        if (mtime > latest) latest = mtime
      }
    } catch {}
  }
  return latest > 0 ? new Date(latest).toISOString() : null
}

export async function GET() {
  const lsRaw = stripAnsi(run('maw oracle ls 2>/dev/null'))
  const fetchedAt = new Date().toISOString()

  const agents: Agent[] = AGENTS.map(agent => {
    const awake = lsRaw.split('\n').some(
      l => l.includes('fleet+awake') && new RegExp(`\\b${agent.id}\\b`, 'i').test(l)
    )

    const lastAck = getLastAck(agent.oracle)
    const activeTask = getActiveTask(agent.oracle)
    const archiveTask = getLastArchiveTask(agent.oracle)
    const task = activeTask ?? (archiveTask ? `Last: ${archiveTask}` : null)

    let status: AgentStatus = 'offline'

    if (!awake) {
      status = 'offline'
    } else if (lastAck && Date.now() - new Date(lastAck).getTime() > OFFLINE_THRESHOLD_MS) {
      status = 'offline'
    } else {
      const pane = stripAnsi(run(`maw peek ${agent.session} 2>/dev/null`))
      status = THINKING_RE.test(pane) ? 'active' : 'idle'
    }

    return { id: agent.id, name: agent.name, status, task, lastAck }
  })

  return NextResponse.json({ agents, fetchedAt })
}
