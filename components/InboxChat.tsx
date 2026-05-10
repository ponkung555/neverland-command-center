'use client'

import { useEffect, useRef, useState } from 'react'
import { AGENT_ACCENT, STATIC_AGENTS } from '@/lib/agents'
import { formatTimeAgo } from '@/lib/time'

interface InboxMessage {
  id: string
  sender: string
  recipient: string
  topic: string
  content: string
  ts: string
  mtimeMs: number
}

const POON_ID = 'poon'
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

const NAME_BY_ID: Record<string, string> = Object.fromEntries(
  STATIC_AGENTS.map(a => [a.id, a.name]),
)

function displayName(id: string): string {
  return NAME_BY_ID[id] ?? (id === POON_ID ? 'Poon' : id.charAt(0).toUpperCase() + id.slice(1))
}

function accentFor(id: string): string {
  return AGENT_ACCENT[id] ?? '#888'
}

export default function InboxChat() {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null)
  const [connected, setConnected] = useState(false)
  const [recipient, setRecipient] = useState<string>('jeans')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastMsgsRef = useRef<InboxMessage[] | null>(null)

  // SSE subscription with backoff.
  useEffect(() => {
    let es: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let cancelled = false

    function connect() {
      if (cancelled) return
      es = new EventSource('/api/inbox/stream')
      es.addEventListener('inbox', (ev: MessageEvent) => {
        try {
          const json = JSON.parse(ev.data) as { messages: InboxMessage[] }
          setMessages(json.messages)
          lastMsgsRef.current = json.messages
          setConnected(true)
          attempt = 0
        } catch {}
      })
      es.onerror = () => {
        if (cancelled) return
        es?.close()
        es = null
        setConnected(false)
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS)
        attempt += 1
        timer = setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      es?.close()
    }
  }, [])

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !messages) return
    el.scrollTop = el.scrollHeight
  }, [messages?.length])

  async function send() {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, content }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setSendError(json.error || `send failed (${res.status})`)
        return
      }
      setDraft('')
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'network error')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }

  return (
    <section className="px-6 pb-6">
      <div className="flex items-center justify-between py-3">
        <span className="text-[11px] tracking-widest uppercase font-mono text-[#888]">
          INBOX CHAT
        </span>
        <span className="text-[10px] font-mono text-[#555] flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: connected ? '#4ade80' : '#f87171' }}
          />
          {connected ? 'live' : 'connecting…'}
          <span className="text-[#333] mx-1">·</span>
          jeans-oracle/ψ/inbox
        </span>
      </div>

      <div className="rounded border border-[#252525] bg-[#0d0d0d] flex flex-col h-[520px]">
        {/* Scrollback */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages === null && (
            <div className="text-center text-[11px] font-mono text-[#444] py-8">
              loading inbox…
            </div>
          )}
          {messages !== null && messages.length === 0 && (
            <div className="text-center text-[11px] font-mono text-[#444] py-8">
              no messages yet.
            </div>
          )}
          {messages?.map(m => <Bubble key={m.id} m={m} />)}
        </div>

        {/* Composer */}
        <div className="border-t border-[#252525] p-3 bg-[#0a0a0a]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] tracking-widest uppercase font-mono text-[#555]">
              TO
            </span>
            <select
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              className="bg-[#141414] border border-[#252525] rounded px-2 py-1 text-[12px] font-mono text-white focus:outline-none focus:border-[#3a3a3a]"
            >
              {STATIC_AGENTS.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <span className="text-[10px] font-mono text-[#444] ml-auto">
              ⌘↵ to send
            </span>
          </div>
          <div className="flex gap-2 items-stretch">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
              placeholder={`Message ${displayName(recipient)}…`}
              rows={2}
              className="flex-1 resize-none rounded bg-[#141414] border border-[#252525] focus:border-[#3a3a3a] focus:outline-none px-3 py-2 text-[13px] font-mono text-white placeholder-[#444] disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || sending}
              className="px-4 rounded text-[11px] font-bold tracking-widest uppercase font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: accentFor(recipient),
                color: '#0d0d0d',
              }}
            >
              {sending ? 'SENDING' : 'SEND'}
            </button>
          </div>
          {sendError && (
            <div
              className="mt-2 px-3 py-1.5 rounded text-[11px] font-mono border"
              style={{ backgroundColor: '#1a0f0f', borderColor: '#f87171', color: '#f87171' }}
            >
              ⚠ {sendError}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Bubble({ m }: { m: InboxMessage }) {
  const fromMe = m.sender === POON_ID
  const senderAccent = accentFor(m.sender)
  return (
    <div className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] flex flex-col gap-1 ${fromMe ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
          <span style={{ color: senderAccent }} className="font-bold">
            {displayName(m.sender)}
          </span>
          <span className="text-[#444]">→</span>
          <span className="text-[#666]">{displayName(m.recipient)}</span>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words border max-h-[260px] overflow-y-auto ${
            fromMe
              ? 'bg-[#1a1a1a] border-[#2a2a2a] text-[#e5e5e5]'
              : 'bg-[#141414] border-[#252525] text-[#cfcfcf]'
          }`}
          style={fromMe ? undefined : { borderLeft: `3px solid ${senderAccent}` }}
        >
          {m.content || <span className="text-[#555]">(empty)</span>}
        </div>
        <span className="text-[10px] font-mono text-[#444]">
          {formatTimeAgo(m.ts)}
        </span>
      </div>
    </div>
  )
}
