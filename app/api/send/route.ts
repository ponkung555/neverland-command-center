import { NextResponse } from 'next/server'
import { spawnSync } from 'child_process'
import { AGENTS } from '@/lib/fleet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_LEN = 4000

export async function POST(req: Request) {
  let body: { agentId?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const agentId = (body.agentId ?? '').trim()
  const message = (body.message ?? '').trim()

  if (!agentId) {
    return NextResponse.json({ ok: false, error: 'agentId required' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ ok: false, error: 'message required' }, { status: 400 })
  }
  if (message.length > MAX_LEN) {
    return NextResponse.json({ ok: false, error: `message exceeds ${MAX_LEN} chars` }, { status: 400 })
  }

  const agent = AGENTS.find(a => a.id === agentId)
  if (!agent) {
    return NextResponse.json({ ok: false, error: `unknown agent: ${agentId}` }, { status: 404 })
  }

  // Step 1 — type the message into the agent's pane (no shell, no injection).
  const send = spawnSync(
    'maw',
    ['tmux', 'send', agent.session, message, '--force', '--literal'],
    { encoding: 'utf8', timeout: 10_000 },
  )
  if (send.status !== 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'maw tmux send failed',
        stderr: (send.stderr || '').slice(0, 500),
      },
      { status: 502 },
    )
  }

  // Step 2 — submit with Enter via raw tmux (separate keystroke).
  const enter = spawnSync(
    'tmux',
    ['send-keys', '-t', agent.session, 'Enter'],
    { encoding: 'utf8', timeout: 5_000 },
  )
  if (enter.status !== 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'tmux send-keys Enter failed',
        stderr: (enter.stderr || '').slice(0, 500),
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    agentId: agent.id,
    session: agent.session,
    sentAt: new Date().toISOString(),
  })
}
