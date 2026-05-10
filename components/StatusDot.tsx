import type { AgentStatus } from '@/lib/types'
import { STATUS_COLOR } from '@/lib/agents'

interface Props {
  status: AgentStatus
}

export default function StatusDot({ status }: Props) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: STATUS_COLOR[status] }}
    />
  )
}
