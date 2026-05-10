'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Agent, AgentStatus } from '@/lib/types'
import { AGENT_ACCENT, STATIC_AGENTS, STATUS_COLOR } from '@/lib/agents'
import { formatTimeAgo } from '@/lib/time'
import { parseMessageMarkdown } from '@/lib/markdown'
import StatusDot from './StatusDot'

interface InboxMessage {
  id: string
  sender: string
  recipient: string
  topic: string
  content: string
  ts: string
  mtimeMs: number
}

interface ActivityEvent {
  id: string
  ts: string
  ms: number
  kind: 'relay' | 'ack' | 'complete' | 'route' | 'watcher'
  text: string
  sender?: string
  recipient?: string
  agent?: string
}

const POON_ID = 'poon'
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

const NAME_BY_ID: Record<string, string> = Object.fromEntries(
  STATIC_AGENTS.map(a => [a.id, a.name]),
)

function displayName(id: string): string {
  if (id === POON_ID) return 'Poon'
  return NAME_BY_ID[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
}

function accentFor(id: string): string {
  if (id === POON_ID) return '#e5e5e5'
  return AGENT_ACCENT[id] ?? '#888'
}

type ThreadFilter = 'all' | string

interface OptimisticMessage {
  localId: string
  recipient: string
  content: string
  createdMs: number
  state: 'sending' | 'failed'
  error?: string
}

export default function InboxChat() {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [connected, setConnected] = useState(false)
  const [thread, setThread] = useState<ThreadFilter>('all')
  const [recipient, setRecipient] = useState<string>('jeans')
  const [draft, setDraft] = useState('')
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastInboxRef = useRef<InboxMessage[] | null>(null)

  // ── Inbox SSE ─────────────────────────────────────────────────────────────
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
          lastInboxRef.current = json.messages
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

  // ── Activity SSE (for relay status) ───────────────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let cancelled = false
    function connect() {
      if (cancelled) return
      es = new EventSource('/api/activity/stream')
      es.addEventListener('activity', (ev: MessageEvent) => {
        try {
          const json = JSON.parse(ev.data) as { events: ActivityEvent[] }
          setActivity(json.events)
          attempt = 0
        } catch {}
      })
      es.onerror = () => {
        if (cancelled) return
        es?.close()
        es = null
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

  // ── Fleet SSE (for recipient status) ──────────────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let cancelled = false
    function connect() {
      if (cancelled) return
      es = new EventSource('/api/fleet/stream')
      es.addEventListener('fleet', (ev: MessageEvent) => {
        try {
          const json = JSON.parse(ev.data) as { agents: Agent[] }
          setAgents(json.agents)
          attempt = 0
        } catch {}
      })
      es.onerror = () => {
        if (cancelled) return
        es?.close()
        es = null
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

  // Drop optimistic bubbles once a real one arrives.
  useEffect(() => {
    if (!messages) return
    setOptimistic(prev => prev.filter(o => {
      // If a real Poon → o.recipient bubble exists with mtime ≥ createdMs
      // and matching content prefix, the optimistic copy is now redundant.
      const matched = messages.some(
        m =>
          m.sender === POON_ID &&
          m.recipient === o.recipient &&
          m.mtimeMs >= o.createdMs - 500 &&
          m.content.trim().startsWith(o.content.trim().slice(0, 80)),
      )
      return !matched
    }))
  }, [messages])

  // Auto-scroll on new content.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages?.length, optimistic.length, thread])

  // Recipient agent (for status indicator).
  const recipientAgent = agents.find(a => a.id === recipient)
  const recipientStatus: AgentStatus | undefined = recipientAgent?.status

  // Thread-filtered messages.
  const visibleMessages = useMemo(() => {
    if (!messages) return null
    if (thread === 'all') return messages
    return messages.filter(m => m.sender === thread || m.recipient === thread)
  }, [messages, thread])

  const visibleOptimistic = useMemo(() => {
    if (thread === 'all') return optimistic
    return optimistic.filter(o => o.recipient === thread)
  }, [optimistic, thread])

  // Per-Poon-message delivery status, computed from activity + later agent messages.
  const poonStatus = useMemo(() => {
    const out = new Map<string, 'relayed' | 'replied' | 'sent'>()
    if (!messages) return out
    for (const m of messages) {
      if (m.sender !== POON_ID) continue

      // Replied? — any later message from the recipient.
      const replied = messages.some(
        n =>
          n.sender === m.recipient &&
          n.mtimeMs > m.mtimeMs,
      )
      if (replied) {
        out.set(m.id, 'replied')
        continue
      }

      // Relayed? — an activity 'relay' event with matching sender/recipient
      // close to (within ±60s of) the message mtime.
      const relayed = activity.some(
        e =>
          e.kind === 'relay' &&
          e.sender === POON_ID &&
          e.recipient === m.recipient &&
          Math.abs(e.ms - m.mtimeMs) < 60_000,
      )
      out.set(m.id, relayed ? 'relayed' : 'sent')
    }
    return out
  }, [messages, activity])

  async function send() {
    const content = draft.trim()
    if (!content) return

    const localId = `o-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const createdMs = Date.now()
    setOptimistic(prev => [
      ...prev,
      { localId, recipient, content, createdMs, state: 'sending' },
    ])
    setDraft('')

    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, content }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        const error = json.error || `send failed (${res.status})`
        setOptimistic(prev =>
          prev.map(o => (o.localId === localId ? { ...o, state: 'failed', error } : o)),
        )
      }
      // Success → SSE will deliver the real bubble; optimistic gets cleaned up there.
    } catch (e) {
      const error = e instanceof Error ? e.message : 'network error'
      setOptimistic(prev =>
        prev.map(o => (o.localId === localId ? { ...o, state: 'failed', error } : o)),
      )
    }
  }

  function retry(localId: string) {
    const o = optimistic.find(x => x.localId === localId)
    if (!o) return
    setOptimistic(prev => prev.filter(x => x.localId !== localId))
    setDraft(o.content)
    setRecipient(o.recipient)
  }

  function dismiss(localId: string) {
    setOptimistic(prev => prev.filter(x => x.localId !== localId))
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
          {messages?.length ?? 0} messages
        </span>
      </div>

      {/* Thread chips */}
      <div className="flex gap-1 mb-2 flex-wrap">
        <ThreadChip
          label="all"
          color="#888"
          active={thread === 'all'}
          onClick={() => setThread('all')}
        />
        {STATIC_AGENTS.map(a => (
          <ThreadChip
            key={a.id}
            label={a.name}
            color={AGENT_ACCENT[a.id] ?? '#888'}
            active={thread === a.id}
            onClick={() => setThread(a.id)}
          />
        ))}
      </div>

      <div className="card-depth rounded border border-[#252525] bg-[#0d0d0d] flex flex-col h-[640px]">
        {/* Scrollback */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin px-4 py-4 space-y-3">
          {messages === null && (
            <div className="text-center text-[11px] font-mono text-[#444] py-8">
              loading inbox…
            </div>
          )}
          {messages !== null && visibleMessages?.length === 0 && visibleOptimistic.length === 0 && (
            <div className="text-center text-[11px] font-mono text-[#444] py-8">
              no messages in this thread yet.
            </div>
          )}
          {visibleMessages?.map(m => (
            <Bubble
              key={m.id}
              m={m}
              status={m.sender === POON_ID ? poonStatus.get(m.id) : undefined}
            />
          ))}
          {visibleOptimistic.map(o => (
            <OptimisticBubble
              key={o.localId}
              o={o}
              onRetry={() => retry(o.localId)}
              onDismiss={() => dismiss(o.localId)}
            />
          ))}
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
            {recipientStatus && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest">
                <StatusDot status={recipientStatus} size={6} />
                <span style={{ color: STATUS_COLOR[recipientStatus] }}>
                  {recipientStatus}
                </span>
              </span>
            )}
            {recipientStatus === 'active' && (
              <span className="text-[10px] font-mono text-[#fbbf24]">
                · busy — submission may queue until they finish
              </span>
            )}
            {recipientStatus === 'offline' && (
              <span className="text-[10px] font-mono text-[#f87171]">
                · offline — relay will not reach a live pane
              </span>
            )}
            <span className="text-[10px] font-mono text-[#444] ml-auto">
              ⌘↵ to send
            </span>
          </div>
          <div className="flex gap-2 items-stretch">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Message ${displayName(recipient)}…`}
              rows={2}
              className="flex-1 resize-none rounded bg-[#141414] border border-[#252525] focus:border-[#3a3a3a] focus:outline-none px-3 py-2 text-[13px] font-mono text-white placeholder-[#444]"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="px-4 rounded text-[11px] font-bold tracking-widest uppercase font-mono transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-[1px] hover:brightness-110 active:translate-y-0"
              style={{
                backgroundColor: accentFor(recipient),
                color: '#0d0d0d',
                boxShadow: `0 4px 12px -4px ${accentFor(recipient)}80`,
              }}
            >
              SEND
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ThreadChip({
  label, color, active, onClick,
}: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest transition-colors border ${
        active
          ? 'bg-[#1a1a1a] text-white'
          : 'bg-transparent text-[#666] border-[#1a1a1a] hover:text-[#aaa]'
      }`}
      style={active ? { color, borderColor: color + '55' } : undefined}
    >
      {label}
    </button>
  )
}

const STATUS_PILL: Record<'sent' | 'relayed' | 'replied', { label: string; color: string; icon: string }> = {
  sent:    { label: 'sent',    color: '#666',    icon: '✓'   },
  relayed: { label: 'relayed', color: '#60a5fa', icon: '✓✓'  },
  replied: { label: 'replied', color: '#4ade80', icon: '✓✓'  },
}

function Bubble({
  m, status,
}: {
  m: InboxMessage
  status?: 'sent' | 'relayed' | 'replied'
}) {
  const fromMe = m.sender === POON_ID
  const senderAccent = accentFor(m.sender)
  const [expanded, setExpanded] = useState(false)
  const parsed = useMemo(() => parseMessageMarkdown(m.content), [m.content])
  const preview = parsed.body
  const isLong = preview.length > 240
  const previewText = expanded || !isLong ? preview : preview.slice(0, 240).trimEnd() + '…'

  return (
    <div className={`flex animate-fade-in ${fromMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] flex flex-col gap-1 ${fromMe ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
          <span style={{ color: senderAccent }} className="font-bold">
            {displayName(m.sender)}
          </span>
          <span className="text-[#444]">→</span>
          <span className="text-[#666]">{displayName(m.recipient)}</span>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words border ${
            fromMe
              ? 'bg-[#1a1a1a] border-[#2a2a2a] text-[#e5e5e5]'
              : 'bg-[#141414] border-[#252525] text-[#cfcfcf]'
          }`}
          style={fromMe ? undefined : { borderLeft: `3px solid ${senderAccent}` }}
        >
          {parsed.title && (
            <div
              className="text-[11px] font-bold tracking-widest uppercase mb-1.5"
              style={{ color: fromMe ? '#fff' : senderAccent }}
            >
              {parsed.title}
            </div>
          )}
          {previewText || <span className="text-[#555]">(no body)</span>}
          {isLong && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="block mt-2 text-[10px] tracking-widest uppercase text-[#666] hover:text-[#aaa] transition-colors"
            >
              {expanded ? '▲ collapse' : '▼ show all'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-[#444]">
          <span>{formatTimeAgo(m.ts)}</span>
          {fromMe && status && (
            <>
              <span className="text-[#333]">·</span>
              <span style={{ color: STATUS_PILL[status].color }}>
                {STATUS_PILL[status].icon} {STATUS_PILL[status].label}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function OptimisticBubble({
  o, onRetry, onDismiss,
}: {
  o: OptimisticMessage
  onRetry: () => void
  onDismiss: () => void
}) {
  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[78%] flex flex-col gap-1 items-end">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
          <span style={{ color: '#e5e5e5' }} className="font-bold">Poon</span>
          <span className="text-[#444]">→</span>
          <span className="text-[#666]">{displayName(o.recipient)}</span>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words border ${
            o.state === 'failed'
              ? 'bg-[#1a0f0f] border-[#5a2828] text-[#f5b5b5]'
              : 'bg-[#141414] border-[#2a2a2a] text-[#aaa] opacity-70'
          }`}
        >
          {o.content}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          {o.state === 'sending' && (
            <span className="text-[#666] flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#666] animate-pulse" />
              sending…
            </span>
          )}
          {o.state === 'failed' && (
            <>
              <span className="text-[#f87171]">⚠ {o.error || 'send failed'}</span>
              <button
                onClick={onRetry}
                className="text-[#aaa] hover:text-white underline underline-offset-2"
              >
                retry
              </button>
              <button
                onClick={onDismiss}
                className="text-[#666] hover:text-[#aaa]"
              >
                dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
