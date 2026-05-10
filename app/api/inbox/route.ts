import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { listMessages, buildFilename, JEANS_INBOX, POON_ID } from '@/lib/inbox'
import { AGENTS } from '@/lib/fleet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_LEN = 8000

export async function GET() {
  return NextResponse.json({ messages: listMessages() })
}

export async function POST(req: Request) {
  let body: { recipient?: string; content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const recipient = (body.recipient ?? '').trim().toLowerCase()
  const content = (body.content ?? '').trim()

  if (!recipient) {
    return NextResponse.json({ ok: false, error: 'recipient required' }, { status: 400 })
  }
  if (recipient === POON_ID) {
    return NextResponse.json({ ok: false, error: 'cannot send to self' }, { status: 400 })
  }
  if (!AGENTS.find(a => a.id === recipient)) {
    return NextResponse.json({ ok: false, error: `unknown recipient: ${recipient}` }, { status: 404 })
  }
  if (!content) {
    return NextResponse.json({ ok: false, error: 'content required' }, { status: 400 })
  }
  if (content.length > MAX_LEN) {
    return NextResponse.json({ ok: false, error: `content exceeds ${MAX_LEN} chars` }, { status: 400 })
  }

  const filename = buildFilename(recipient, content)
  const full = path.join(JEANS_INBOX, filename)

  try {
    fs.writeFileSync(full, content + (content.endsWith('\n') ? '' : '\n'), 'utf8')
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'write failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    file: filename,
    sentAt: new Date().toISOString(),
  })
}
