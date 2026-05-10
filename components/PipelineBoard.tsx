'use client'

import { useEffect, useRef, useState } from 'react'
import { formatTimeAgo } from '@/lib/time'

type PipelineStage = 'Research' | 'Writing' | 'Review' | 'Complete'

interface ReportCard {
  id: string
  number: number
  title: string
  stage: PipelineStage
  ts: string
  mtimeMs: number
  signals: {
    directive?: string
    annieAck?: string
    enoughAck?: string
    pitch?: string
  }
}

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

const STAGES: { key: PipelineStage; label: string; color: string; owner: string }[] = [
  { key: 'Research', label: 'Research', color: '#fbbf24', owner: 'Annie'   },
  { key: 'Writing',  label: 'Writing',  color: '#60a5fa', owner: 'Michael' },
  { key: 'Review',   label: 'Review',   color: '#fb923c', owner: 'Enough'  },
  { key: 'Complete', label: 'Complete', color: '#4ade80', owner: 'Jeans'   },
]

export default function PipelineBoard() {
  const [reports, setReports] = useState<ReportCard[] | null>(null)
  const [connected, setConnected] = useState(false)
  const lastRef = useRef<ReportCard[] | null>(null)

  useEffect(() => {
    let es: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let cancelled = false

    function connect() {
      if (cancelled) return
      es = new EventSource('/api/pipeline/stream')
      es.addEventListener('pipeline', (ev: MessageEvent) => {
        try {
          const json = JSON.parse(ev.data) as { reports: ReportCard[] }
          setReports(json.reports)
          lastRef.current = json.reports
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

  return (
    <section className="px-6 pb-6">
      <div className="flex items-center justify-between py-3">
        <span className="text-[11px] tracking-widest uppercase font-mono text-[#888]">
          PIPELINE BOARD
        </span>
        <span className="text-[10px] font-mono text-[#555] flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: connected ? '#4ade80' : '#f87171' }}
          />
          {connected ? 'live' : 'connecting…'}
          <span className="text-[#333] mx-1">·</span>
          {reports?.length ?? 0} reports
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {STAGES.map(s => {
          const cards = reports?.filter(r => r.stage === s.key) ?? []
          return (
            <div
              key={s.key}
              className="rounded border border-[#252525] bg-[#0d0d0d] flex flex-col min-h-[280px]"
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2 border-b border-[#252525] border-t-[3px] rounded-t"
                style={{ borderTopColor: s.color }}
              >
                <span
                  className="text-[10px] font-bold tracking-widest uppercase font-mono"
                  style={{ color: s.color }}
                >
                  {s.label}
                </span>
                <span className="text-[10px] font-mono text-[#666]">
                  {s.owner} · {cards.length}
                </span>
              </div>
              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[420px]">
                {reports === null ? (
                  <div className="text-[10px] font-mono text-[#444] text-center py-4">
                    loading…
                  </div>
                ) : cards.length === 0 ? (
                  <div className="text-[10px] font-mono text-[#333] text-center py-4">
                    —
                  </div>
                ) : (
                  cards.map(c => <ReportTile key={c.id} card={c} stageColor={s.color} />)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ReportTile({ card, stageColor }: { card: ReportCard; stageColor: string }) {
  return (
    <div
      className="rounded bg-[#141414] border border-[#252525] p-3 flex flex-col gap-1.5 hover:bg-[#171717] hover:border-[#333] transition-colors"
      style={{ borderLeft: `3px solid ${stageColor}` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[10px] font-bold tracking-widest uppercase font-mono"
          style={{ color: stageColor }}
        >
          REPORT #{card.number}
        </span>
        <span className="text-[10px] font-mono text-[#555] flex-shrink-0">
          {formatTimeAgo(card.ts)}
        </span>
      </div>
      <div className="text-[12px] font-mono text-[#e5e5e5] leading-snug break-words">
        {card.title}
      </div>
      <div className="flex gap-1 flex-wrap pt-1">
        {card.signals.directive && (
          <SignalDot label="dir"   color="#fbbf24" />
        )}
        {card.signals.annieAck && (
          <SignalDot label="annie" color="#f472b6" />
        )}
        {card.signals.enoughAck && (
          <SignalDot label="enough" color="#fb923c" />
        )}
        {card.signals.pitch && (
          <SignalDot label="pitch" color="#4ade80" />
        )}
      </div>
    </div>
  )
}

function SignalDot({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border"
      style={{ color, borderColor: color + '55', backgroundColor: color + '11' }}
    >
      {label}
    </span>
  )
}
