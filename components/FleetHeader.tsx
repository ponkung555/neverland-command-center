import type { Agent, AgentStatus } from '@/lib/types'
import { STATUS_COLOR } from '@/lib/agents'

interface Props {
  agents: Agent[]
  stale: boolean
}

export default function FleetHeader({ agents, stale }: Props) {
  const counts: Record<AgentStatus, number> = { active: 0, idle: 0, offline: 0 }
  for (const a of agents) counts[a.status]++

  return (
    <div className="flex items-center justify-between px-6 py-3">
      <span className="text-[11px] tracking-widest uppercase font-mono text-[#555]">
        FLEET STATUS{stale ? <span className="text-[#555]"> · stale</span> : null}
      </span>
      <span className="flex items-center gap-2 text-[11px] tracking-widest font-mono">
        <span style={{ color: counts.active > 0 ? STATUS_COLOR.active : '#555' }}>
          {counts.active} ACTIVE
        </span>
        <span className="text-[#333]">·</span>
        <span style={{ color: counts.idle > 0 ? STATUS_COLOR.idle : '#555' }}>
          {counts.idle} IDLE
        </span>
        <span className="text-[#333]">·</span>
        <span style={{ color: counts.offline > 0 ? STATUS_COLOR.offline : '#555' }}>
          {counts.offline} OFFLINE
        </span>
      </span>
    </div>
  )
}
