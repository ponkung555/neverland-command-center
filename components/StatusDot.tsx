import type { AgentStatus } from '@/lib/types'
import { STATUS_COLOR } from '@/lib/agents'

interface Props {
  status: AgentStatus
  size?: number
}

export default function StatusDot({ status, size = 8 }: Props) {
  const color = STATUS_COLOR[status]
  const px = `${size}px`

  return (
    <span
      className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{ width: px, height: px }}
      aria-label={status}
    >
      {status === 'active' && (
        <span
          className="absolute inline-block rounded-full animate-status-ping"
          style={{ width: px, height: px, backgroundColor: color }}
        />
      )}
      <span
        className={`relative inline-block rounded-full ${
          status === 'idle' ? 'animate-status-glow' : ''
        }`}
        style={{
          width: px,
          height: px,
          backgroundColor: color,
          boxShadow: status === 'offline' ? 'none' : `0 0 6px ${color}80`,
        }}
      />
    </span>
  )
}
