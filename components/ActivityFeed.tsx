'use client'

import { useEffect, useRef, useState } from 'react'
import { AGENT_ACCENT, STATIC_AGENTS } from '@/lib/agents'
import { formatTimeAgo } from '@/lib/time'

type ActivityKind = 'relay' | 'ack' | 'complete' | 'route' | 'watcher'

interface ActivityEvent {
  id: string
  ts: string
  ms: number
  kind: ActivityKind
  text: string
  sender?: string
  recipient?: string
  agent?: string
}

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

const NAME_BY_ID: Record<string, string> = Object.fromEntries(
  STATIC_AGENTS.map(a => [a.id, a.name]),
)

function name(id?: string): string {
  if (!id) return ''
  if (id === 'poon') return 'Poon'
  return NAME_BY_ID[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
}

function accent(id?: string): string {
  if (!id) return '#666'
  return AGENT_ACCENT[id] ?? '#888'
}

const KIND_META: Record<ActivityKind, { icon: string; color: string; label: string }> = {
  relay:    { icon: '⇢', color: '#60a5fa', label: 'RELAY'    },
  ack:      { icon: '✓', color: '#4ade80', label: 'ACK'      },
  complete: { icon: '◼', color: '#c084fc', label: 'COMPLETE' },
  route:    { icon: '⇄', color: '#fbbf24', label: 'ROUTE'    },
  watcher:  { icon: '·', color: '#666',    label: 'WATCHER'  },
}

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null)
  const [connected, setConnected] = useState(false)
  const [filter, setFilter] = useState<'all' | ActivityKind>('all')
  const lastEventsRef = useRef<ActivityEvent[] | null>(null)

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
          setEvents(json.events)
          lastEventsRef.current = json.events
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

  const visible = events?.filter(e => filter === 'all' || e.kind === filter) ?? null

  return (
    <section className="px-6 pb-6">
      <div className="flex items-center justify-between py-3">
        <span className="text-[11px] tracking-widest uppercase font-mono text-[#888]">
          ACTIVITY FEED
        </span>
        <span className="text-[10px] font-mono text-[#555] flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: connected ? '#4ade80' : '#f87171' }}
          />
          {connected ? 'live' : 'connecting…'}
          <span className="text-[#333] mx-1">·</span>
          {events?.length ?? 0} events
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-2">
        {(['all', 'relay', 'ack', 'complete', 'route', 'watcher'] as const).map(k => {
          const active = filter === k
          const meta = k === 'all' ? null : KIND_META[k]
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest transition-colors ${
                active
                  ? 'bg-[#1a1a1a] text-white border border-[#333]'
                  : 'bg-transparent text-[#666] border border-[#1a1a1a] hover:text-[#aaa]'
              }`}
              style={active && meta ? { color: meta.color, borderColor: meta.color + '55' } : undefined}
            >
              {k}
            </button>
          )
        })}
      </div>

      <div className="card-depth rounded border border-[#252525] bg-[#0d0d0d] h-[420px] overflow-y-auto scroll-thin">
        {events === null && (
          <div className="text-center text-[11px] font-mono text-[#444] py-8">
            loading activity…
          </div>
        )}
        {visible !== null && visible.length === 0 && (
          <div className="text-center text-[11px] font-mono text-[#444] py-8">
            no events.
          </div>
        )}
        <ul className="divide-y divide-[#1a1a1a]">
          {visible?.map(e => <Row key={e.id} e={e} />)}
        </ul>
      </div>
    </section>
  )
}

function Row({ e }: { e: ActivityEvent }) {
  const meta = KIND_META[e.kind]
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-[12px] font-mono hover:bg-[#111] transition-colors">
      <span
        className="w-12 flex-shrink-0 text-[10px] tracking-widest uppercase font-bold"
        style={{ color: meta.color }}
      >
        {meta.icon} {meta.label}
      </span>
      <span className="flex-1 text-[#cfcfcf] truncate">
        {e.kind === 'relay' && e.sender && e.recipient ? (
          <>
            <span style={{ color: accent(e.sender) }}>{name(e.sender)}</span>
            <span className="text-[#444] mx-1.5">→</span>
            <span style={{ color: accent(e.recipient) }}>{name(e.recipient)}</span>
          </>
        ) : e.kind === 'ack' && e.agent ? (
          <>
            <span className="text-[#888]">acked </span>
            <span style={{ color: accent(e.agent) }}>{name(e.agent)}</span>
            <span className="text-[#666]">: {e.text.split(': ')[1] ?? ''}</span>
          </>
        ) : e.kind === 'complete' && e.agent ? (
          <>
            <span style={{ color: accent(e.agent) }}>{name(e.agent)}</span>
            <span className="text-[#888]"> completed</span>
            <span className="text-[#666]">: {e.text.split(': ')[1] ?? ''}</span>
          </>
        ) : (
          <span className="text-[#888]">{e.text}</span>
        )}
      </span>
      <span className="text-[10px] text-[#555] flex-shrink-0 w-20 text-right">
        {formatTimeAgo(e.ts)}
      </span>
    </li>
  )
}
