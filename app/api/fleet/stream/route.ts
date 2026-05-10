import { computeFleet, fleetStateKey } from '@/lib/fleet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const POLL_MS = 2_000
const KEEPALIVE_MS = 25_000

export async function GET(req: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let lastKey = ''

      const send = (event: string, payload: unknown) => {
        if (closed) return
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
          )
        } catch {
          cleanup()
        }
      }

      const sendComment = (text: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`: ${text}\n\n`))
        } catch {
          cleanup()
        }
      }

      const tick = () => {
        if (closed) return
        const data = computeFleet()
        const key = fleetStateKey(data)
        if (key !== lastKey) {
          lastKey = key
          send('fleet', data)
        }
      }

      const pollId = setInterval(tick, POLL_MS)
      const keepaliveId = setInterval(() => sendComment('keepalive'), KEEPALIVE_MS)

      function cleanup() {
        if (closed) return
        closed = true
        clearInterval(pollId)
        clearInterval(keepaliveId)
        try { controller.close() } catch {}
      }

      req.signal.addEventListener('abort', cleanup)

      // Initial snapshot
      tick()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
