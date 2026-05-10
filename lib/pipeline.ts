import fs from 'fs'
import path from 'path'

const BASE = '/home/asus/repos'
const JEANS_ARCHIVE = path.join(BASE, 'jeans-oracle', 'ψ', 'archive')
const JEANS_INBOX   = path.join(BASE, 'jeans-oracle', 'ψ', 'inbox')
const ANNIE_ARCHIVE = path.join(BASE, 'annie-oracle', 'ψ', 'archive')

export type PipelineStage = 'Research' | 'Writing' | 'Review' | 'Complete'

export interface ReportCard {
  id: string                   // `report-N`
  number: number
  title: string
  stage: PipelineStage
  ts: string
  mtimeMs: number
  signals: {
    directive?: string         // most-recent annie directive filename
    annieAck?: string          // ack-annie-report-N file
    enoughAck?: string         // ack-enough-report-N file
    pitch?: string             // jeans pitch filename
  }
}

interface Signal {
  filename: string
  mtimeMs: number
  topic?: string
}

function statMs(p: string): number {
  try { return fs.statSync(p).mtimeMs } catch { return 0 }
}

function safeReaddir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function titleFromSlug(slug: string): string {
  return slug
    .replace(/-+/g, ' ')
    .replace(/^(write|writeup)\b\s*/i, '')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function listPipeline(): ReportCard[] {
  const reports = new Map<number, {
    directive?: Signal
    annieAck?: Signal
    enoughAck?: Signal
    pitch?: Signal
  }>()

  const ensure = (n: number) => {
    let r = reports.get(n)
    if (!r) {
      r = {}
      reports.set(n, r)
    }
    return r
  }

  // 1) Annie directives — research / write directives
  for (const name of safeReaddir(ANNIE_ARCHIVE)) {
    const m = name.match(/^directive-report-(\d+)-(.+?)\.md$/)
    if (!m) continue
    const num = Number(m[1])
    let topic = m[2].replace(/-write$/, '')
    const ms = statMs(path.join(ANNIE_ARCHIVE, name))
    const sig: Signal = { filename: name, mtimeMs: ms, topic }
    const r = ensure(num)
    if (!r.directive || ms > r.directive.mtimeMs) r.directive = sig
  }

  // 2) Jeans inbox acks
  for (const name of safeReaddir(JEANS_INBOX)) {
    const annieAckMatch = name.match(/^ack-annie-report-(\d+)/)
    if (annieAckMatch) {
      const num = Number(annieAckMatch[1])
      const ms = statMs(path.join(JEANS_INBOX, name))
      ensure(num).annieAck = { filename: name, mtimeMs: ms }
      continue
    }
    const enoughAckMatch = name.match(/^ack-enough-report-(\d+)/)
    if (enoughAckMatch) {
      const num = Number(enoughAckMatch[1])
      const ms = statMs(path.join(JEANS_INBOX, name))
      ensure(num).enoughAck = { filename: name, mtimeMs: ms }
    }
  }

  // 3) Jeans pitch archive — final stage
  for (const name of safeReaddir(JEANS_ARCHIVE)) {
    const m = name.match(/^pitch-research-report-(\d+)-(.+?)\.md$/)
    if (!m) continue
    const num = Number(m[1])
    const topic = m[2]
    const ms = statMs(path.join(JEANS_ARCHIVE, name))
    ensure(num).pitch = { filename: name, mtimeMs: ms, topic }
  }

  // Materialize cards
  const cards: ReportCard[] = []
  reports.forEach((r, num) => {
    let stage: PipelineStage
    let stageMs = 0
    if (r.pitch) {
      stage = 'Complete'
      stageMs = r.pitch.mtimeMs
    } else if (r.enoughAck) {
      stage = 'Review'
      stageMs = r.enoughAck.mtimeMs
    } else if (r.annieAck) {
      stage = 'Writing'
      stageMs = r.annieAck.mtimeMs
    } else if (r.directive) {
      stage = 'Research'
      stageMs = r.directive.mtimeMs
    } else {
      return
    }

    const topic =
      r.pitch?.topic ??
      r.directive?.topic ??
      ''
    const title = topic ? titleFromSlug(topic) : `Report ${num}`

    cards.push({
      id: `report-${num}`,
      number: num,
      title,
      stage,
      ts: new Date(stageMs).toISOString(),
      mtimeMs: stageMs,
      signals: {
        directive: r.directive?.filename,
        annieAck: r.annieAck?.filename,
        enoughAck: r.enoughAck?.filename,
        pitch: r.pitch?.filename,
      },
    })
  })

  cards.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return cards
}

export function pipelineStateKey(cards: ReportCard[]): string {
  return cards.map(c => `${c.id}:${c.stage}:${c.mtimeMs}`).join('|')
}
