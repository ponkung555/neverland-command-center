'use client'

import { useEffect, useRef, useState } from 'react'
import type { Agent, FleetData } from '@/lib/types'
import { STATIC_AGENTS } from '@/lib/agents'
import FleetHeader from './FleetHeader'
import AgentCard, { AgentCardEmpty, AgentCardLoading } from './AgentCard'

const STALE_MS = 30_000
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

export default function FleetPanel() {
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [error, setError] = useState(false)
  const [lastFetch, setLastFetch] = useState<number | null>(null)
  const [stale, setStale] = useState(false)
  const lastAgentsRef = useRef<Agent[] | null>(null)

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let cancelled = false

    function connect() {
      if (cancelled) return
      es = new EventSource('/api/fleet/stream')

      es.addEventListener('fleet', (ev: MessageEvent) => {
        try {
          const json: FleetData = JSON.parse(ev.data)
          setAgents(json.agents)
          lastAgentsRef.current = json.agents
          setError(false)
          setLastFetch(Date.now())
          setStale(false)
          attempt = 0
        } catch {
          // Ignore malformed payload — next event will retry.
        }
      })

      es.onerror = () => {
        if (cancelled) return
        es?.close()
        es = null
        setError(true)
        if (lastAgentsRef.current !== null) {
          setAgents(lastAgentsRef.current)
        }
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** attempt,
          RECONNECT_MAX_MS,
        )
        attempt += 1
        reconnectTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [])

  // Stale indicator — check every 5s after first successful event.
  useEffect(() => {
    if (!lastFetch) return
    const id = setInterval(() => {
      setStale(Date.now() - lastFetch > STALE_MS)
    }, 5_000)
    return () => clearInterval(id)
  }, [lastFetch])

  const isInitialLoading = agents === null && !error
  const showErrorBanner = error && !isInitialLoading

  const headerAgents: Agent[] = agents ?? STATIC_AGENTS.map(a => ({
    ...a, status: 'offline' as const, task: null, lastAck: null,
  }))

  function renderCards() {
    if (isInitialLoading) {
      return STATIC_AGENTS.map(a => <AgentCardLoading key={a.id} id={a.id} name={a.name} />)
    }
    if (agents && agents.length > 0) {
      return agents.map(a => <AgentCard key={a.id} agent={a} />)
    }
    return STATIC_AGENTS.map(a => <AgentCardEmpty key={a.id} id={a.id} name={a.name} />)
  }

  const showEmptyMessage = !isInitialLoading && (!agents || agents.length === 0) && !error

  return (
    <div className="w-full">
      {showErrorBanner && (
        <div
          className="mx-6 mb-3 px-3 py-2 rounded text-[11px] font-mono border"
          style={{ backgroundColor: '#1a0f0f', borderColor: '#f87171', color: '#f87171' }}
        >
          ⚠ Fleet stream disconnected — reconnecting; showing last known state.
        </div>
      )}

      {isInitialLoading ? (
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-[11px] tracking-widest uppercase font-mono text-[#555]">
            FLEET STATUS
          </span>
          <div className="w-48 h-2 bg-[#252525] animate-pulse rounded" />
        </div>
      ) : (
        <FleetHeader agents={headerAgents} stale={stale} />
      )}

      <div className="grid grid-cols-3 gap-3 px-6 pb-6">
        {renderCards()}
      </div>

      {showEmptyMessage && (
        <p className="text-center text-[11px] font-mono text-[#555] pb-6 -mt-3">
          Fleet data unavailable — API returned no agents.
        </p>
      )}
    </div>
  )
}
