# Design Spec — Fleet Panel
*Designer: Us — 2026-05-11*

---

## Purpose

Give Poon instant situational awareness of every agent in the fleet — who is alive, what they are doing, and when they last checked in — so he can spot problems and make decisions without reading.

---

## Layout

The Fleet Panel is the first panel Poon sees. It sits at the top of the command center, above all other panels.

**Structure: panel header + 3×2 card grid.**

```
┌──────────────────────────────────────────────────────────────────────┐
│  FLEET STATUS                        3 ACTIVE  ·  2 IDLE  ·  1 OFF  │
├────────────────────┬─────────────────────┬────────────────────────── ┤
│                    │                     │                            │
│  JEANS             │  ANNIE              │  MICHAEL                  │
│  ● ACTIVE          │  ◐ IDLE             │  ○ OFFLINE                │
│                    │                     │                            │
│  Building REST API │  Awaiting directive │  Last: MXenes done        │
│  2m ago            │  14m ago            │  3h 22m ago               │
│                    │                     │                            │
├────────────────────┼─────────────────────┼────────────────────────── ┤
│                    │                     │                            │
│  ROCK              │  ENOUGH             │  US                       │
│  ● ACTIVE          │  ● ACTIVE           │  ● ACTIVE                 │
│                    │                     │                            │
│  Fleet panel impl  │  Monitoring queues  │  Writing fleet spec       │
│  just now          │  1m ago             │  just now                 │
│                    │                     │                            │
└────────────────────┴─────────────────────┴────────────────────────── ┘
```

**Card detail — anatomy:**

```
┌─[3px accent-color left border]─────────────────────────────────┐
│                                                                  │
│  AGENT NAME                                    [STATUS BADGE]   │
│                                                                  │
│  Current task or last known action text here…                   │
│                                                                  │
│  Xm ago                                                         │
│                                                                  │
└──────────────────────────────────────────────────────────────── ┘
```

- Agent name: top-left, uppercase, bold, agent accent color
- Status badge: top-right, dot + label, status color
- Task text: middle, one line, truncated with ellipsis
- Time: bottom-left, smallest and dimmest element on the card

---

## Components

### 1. FleetPanel (container)
- Wraps the header and card grid
- Polls `/api/fleet` every 10 seconds
- Manages loading / error / data states

### 2. FleetHeader
- Label: "FLEET STATUS" — muted, uppercase, 11px tracking-widest
- Summary bar (right-aligned): counts for each status, each colored with its status color
  - Format: `N ACTIVE · N IDLE · N OFFLINE`
  - Zero counts are dimmed (not hidden — absence of a state is still informative)

### 3. AgentCard
One card per agent. Props: `id`, `name`, `status`, `task`, `lastAck`.

- **Left border**: 3px solid, agent accent color — primary identity signal even before reading
- **Agent name**: `font-mono font-bold text-xs tracking-widest uppercase`, agent accent color
- **Status badge**: colored dot (8×8px circle) + status label `text-xs uppercase tracking-widest`
  - Dot and label share the status color
- **Task text**: `font-mono text-xs`, color `#888` (dim) — truncated to one line with `text-ellipsis overflow-hidden whitespace-nowrap`
  - If no current task: show last known action prefixed with "Last:"
  - If truly nothing: show `—`
- **Time since last ack**: `font-mono text-xs`, color `#555` (dimmest) — computed client-side from `lastAck` timestamp
  - Format: `just now` (< 60s), `Xm ago` (< 1h), `Xh Xm ago` (< 24h), `Xd ago` (≥ 24h)
  - If `lastAck` is null: show `—`

### 4. StatusDot
Reusable dot component. Takes `status: 'active' | 'idle' | 'offline'`. Renders a colored 8px circle.

---

## Visual Rules

### Agent accent colors
These identify each agent at a glance via the card's left border and name color.

| Agent   | Color   | Hex       |
| :------ | :------ | :-------- |
| Jeans   | Purple  | `#c084fc` |
| Annie   | Pink    | `#f472b6` |
| Michael | Blue    | `#60a5fa` |
| Rock    | Teal    | `#34d399` |
| Enough  | Orange  | `#fb923c` |
| Us      | Fuchsia | `#e879f9` |

### Status colors
Three states. No gradients between them.

| Status  | Color  | Hex       | Meaning                         |
| :------ | :----- | :-------- | :------------------------------ |
| ACTIVE  | Green  | `#4ade80` | Processing a task right now     |
| IDLE    | Amber  | `#fbbf24` | Alive, no current task          |
| OFFLINE | Red    | `#f87171` | No ack within threshold (15min) |

### Card
- Background: `#141414`
- Border: `1px solid #252525` + `3px solid [accent] left`
- Border radius: `4px`
- Padding: `16px`
- No shadows — they add noise without information

### Grid
- 3 columns, 2 rows, fixed on desktop
- Gap: `12px` between cards
- Panel padding: `24px`

### Typography
All text is monospace (JetBrains Mono, Fira Code, or system mono fallback).

| Element       | Size | Weight | Color   | Case      |
| :------------ | :--- | :----- | :------ | :-------- |
| Panel label   | 11px | 400    | `#555`  | UPPERCASE |
| Agent name    | 11px | 700    | accent  | UPPERCASE |
| Status label  | 10px | 400    | status  | UPPERCASE |
| Task text     | 12px | 400    | `#888`  | sentence  |
| Time          | 11px | 400    | `#555`  | lowercase |
| Summary bar   | 11px | 400    | status  | UPPERCASE |

### States

**Loading state** (initial fetch in progress):
- Show all 6 cards with correct agent names and accent colors
- Status badge shows a gray dot (no label)
- Task text replaced by a pulsing gray bar: `w-3/4 h-3 bg-[#252525] animate-pulse rounded`
- Time replaced by a pulsing gray bar: `w-1/4 h-2 bg-[#252525] animate-pulse rounded`

**Empty state** (API returned an empty agents array):
- Show all 6 cards using the static agent list
- All cards: dashed border (`border-dashed`), no accent left border
- All fields show `—`
- Below the grid: `"Fleet data unavailable — API returned no agents."` in muted 11px monospace, centered

**Error state** (API call failed):
- Thin banner above the grid: `"⚠ Fleet API unreachable — showing last known state."`
  - Background: `#1a0f0f`, border: `1px solid #f87171`, text: `#f87171`, 11px
- Cards remain visible at full opacity with last known data
- If no prior data exists, fall back to the empty state appearance

**Stale data indicator** (last fetch > 30s ago — e.g., tab was backgrounded):
- Panel header label appends: `· stale` in `#555`
- No other visual change — do not alarm unnecessarily

---

## Data

**Endpoint**: `GET /api/fleet`

**Response shape** (Rock to confirm):
```json
{
  "agents": [
    {
      "id": "jeans",
      "name": "Jeans",
      "status": "active",
      "task": "Building REST API for fleet panel",
      "lastAck": "2026-05-11T06:30:00Z"
    }
  ],
  "fetchedAt": "2026-05-11T06:32:04Z"
}
```

**Field notes:**
- `status`: one of `"active"` | `"idle"` | `"offline"` — backend determines this from maw pane output
- `task`: the current task string, or last known action string. Can be null if unknown.
- `lastAck`: ISO 8601 timestamp of the agent's last observed activity. Can be null.
- `fetchedAt`: when the backend last scraped pane output — the frontend shows this if needed for debugging

**Refresh**: client polls every **10 seconds**. No WebSocket needed for v1.

**Agent order**: Jeans, Annie, Michael, Rock, Enough, Us — fixed, not sorted by status. Position is identity; reordering on status change would break spatial memory.

**Offline threshold**: an agent is `offline` if `lastAck` is more than **15 minutes** ago, or if the backend cannot find their pane. Backend enforces this — the frontend trusts the `status` field.

---

*Clean. — Us. 🎨*
