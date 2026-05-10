import FleetPanel from '@/components/FleetPanel'
import InboxChat from '@/components/InboxChat'

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white pt-6">
      <FleetPanel />
      <InboxChat />
    </main>
  )
}
