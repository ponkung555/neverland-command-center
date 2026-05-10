import type { Agent, AgentStatus } from '@/lib/types'
import { AGENT_ACCENT, STATUS_COLOR } from '@/lib/agents'
import { formatTimeAgo } from '@/lib/time'
import StatusDot from './StatusDot'

// ── Loading skeleton ─────────────────────────────────────────────────────────

interface LoadingProps {
  id: string
  name: string
}

export function AgentCardLoading({ id, name }: LoadingProps) {
  const accent = AGENT_ACCENT[id] ?? '#666'
  return (
    <div
      className="rounded bg-[#141414] border border-[#252525] border-l-[3px] p-4 flex flex-col gap-3"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold tracking-widest uppercase font-mono"
          style={{ color: accent }}
        >
          {name}
        </span>
        <span className="inline-block w-2 h-2 rounded-full bg-[#333]" />
      </div>
      <div className="w-3/4 h-3 bg-[#252525] animate-pulse rounded" />
      <div className="w-1/4 h-2 bg-[#252525] animate-pulse rounded" />
    </div>
  )
}

// ── Empty state card ──────────────────────────────────────────────────────────

interface EmptyProps {
  id: string
  name: string
}

export function AgentCardEmpty({ id, name }: EmptyProps) {
  return (
    <div className="rounded bg-[#141414] border border-dashed border-[#252525] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-widest uppercase font-mono text-[#555]">
          {name}
        </span>
        <span className="text-[11px] font-mono text-[#555]">—</span>
      </div>
      <div className="text-[12px] font-mono text-[#555] truncate overflow-hidden whitespace-nowrap">—</div>
      <div className="text-[11px] font-mono text-[#555]">—</div>
    </div>
  )
}

// ── Live card ─────────────────────────────────────────────────────────────────

interface Props {
  agent: Agent
}

export default function AgentCard({ agent }: Props) {
  const { id, name, status, task, lastAck } = agent
  const accent = AGENT_ACCENT[id] ?? '#666'
  const statusColor = STATUS_COLOR[status as AgentStatus]

  return (
    <div
      className="rounded bg-[#141414] border border-[#252525] border-l-[3px] p-4 flex flex-col gap-3"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold tracking-widest uppercase font-mono"
          style={{ color: accent }}
        >
          {name}
        </span>
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <StatusDot status={status} />
          <span
            className="text-[10px] tracking-widest uppercase font-mono"
            style={{ color: statusColor }}
          >
            {status}
          </span>
        </span>
      </div>
      <div className="text-[12px] font-mono text-[#888] truncate overflow-hidden whitespace-nowrap">
        {task ?? '—'}
      </div>
      <div className="text-[11px] font-mono text-[#555]">
        {formatTimeAgo(lastAck)}
      </div>
    </div>
  )
}
