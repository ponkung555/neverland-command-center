export type AgentStatus = 'active' | 'idle' | 'offline'

export interface Agent {
  id: string
  name: string
  status: AgentStatus
  task: string | null
  lastAck: string | null
}

export interface FleetData {
  agents: Agent[]
  fetchedAt: string
}
