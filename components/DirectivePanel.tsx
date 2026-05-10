'use client'

import { useEffect, useRef, useState } from 'react'
import type { Agent } from '@/lib/types'
import { AGENT_ACCENT } from '@/lib/agents'

interface Props {
  agent: Agent | null
  onClose: () => void
}

type SendState = 'idle' | 'sending' | 'error'

export default function DirectivePanel({ agent, onClose }: Props) {
  const [message, setMessage] = useState('')
  const [state, setState] = useState<SendState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Reset on agent change.
  useEffect(() => {
    if (agent) {
      setMessage('')
      setState('idle')
      setErrorMsg(null)
      // Focus textarea after slide-in.
      const t = setTimeout(() => taRef.current?.focus(), 220)
      return () => clearTimeout(t)
    }
  }, [agent])

  // Escape closes.
  useEffect(() => {
    if (!agent) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [agent, onClose])

  async function send() {
    if (!agent) return
    const text = message.trim()
    if (!text || state === 'sending') return
    setState('sending')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, message: text }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setState('error')
        setErrorMsg(json.error || `send failed (${res.status})`)
        return
      }
      onClose()
    } catch (e) {
      setState('error')
      setErrorMsg(e instanceof Error ? e.message : 'network error')
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter sends.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }

  const open = agent !== null
  const accent = agent ? (AGENT_ACCENT[agent.id] ?? '#666') : '#666'
  const sending = state === 'sending'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-[240ms] z-40 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Slide-out panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[#0d0d0d] border-l border-[#252525] shadow-2xl z-50 transform transition-transform duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-[#252525] border-l-[3px]"
          style={{ borderLeftColor: accent }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] tracking-widest uppercase font-mono text-[#555]">
              SEND DIRECTIVE
            </span>
            <span
              className="text-[14px] font-bold tracking-widest uppercase font-mono"
              style={{ color: accent }}
            >
              {agent?.name ?? '—'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#777] hover:text-white text-xl leading-none px-2 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col p-5 gap-3 min-h-0">
          <label className="text-[10px] tracking-widest uppercase font-mono text-[#555]">
            DIRECTIVE
          </label>
          <textarea
            ref={taRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
            placeholder="Type your directive here…"
            className="flex-1 min-h-[200px] resize-none rounded bg-[#141414] border border-[#252525] focus:border-[#3a3a3a] focus:outline-none p-3 text-[13px] font-mono text-white placeholder-[#444] disabled:opacity-50"
          />

          {errorMsg && (
            <div
              className="px-3 py-2 rounded text-[11px] font-mono border"
              style={{ backgroundColor: '#1a0f0f', borderColor: '#f87171', color: '#f87171' }}
            >
              ⚠ {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-[#444]">
              {message.length} chars · ⌘↵ to send · esc to close
            </span>
            <button
              onClick={send}
              disabled={!message.trim() || sending}
              className="px-4 py-2 rounded text-[12px] font-bold tracking-widest uppercase font-mono transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-[1px] hover:brightness-110 active:translate-y-0"
              style={{
                backgroundColor: accent,
                color: '#0d0d0d',
                boxShadow: `0 4px 12px -4px ${accent}80`,
              }}
            >
              {sending ? 'SENDING…' : 'SEND'}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
