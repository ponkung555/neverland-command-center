import type { AgentStatus } from './types'

export const AGENT_ACCENT: Record<string, string> = {
  jeans:   '#c084fc',
  annie:   '#f472b6',
  michael: '#60a5fa',
  rock:    '#34d399',
  enough:  '#fb923c',
  us:      '#e879f9',
}

export const STATUS_COLOR: Record<AgentStatus, string> = {
  active:  '#4ade80',
  idle:    '#fbbf24',
  offline: '#f87171',
}

export const STATIC_AGENTS = [
  { id: 'jeans',   name: 'Jeans'   },
  { id: 'annie',   name: 'Annie'   },
  { id: 'michael', name: 'Michael' },
  { id: 'rock',    name: 'Rock'    },
  { id: 'enough',  name: 'Enough'  },
  { id: 'us',      name: 'Us'      },
]
