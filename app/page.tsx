import FleetPanel from '@/components/FleetPanel'
import InboxChat from '@/components/InboxChat'
import ActivityFeed from '@/components/ActivityFeed'
import PipelineBoard from '@/components/PipelineBoard'

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white pt-6">
      <FleetPanel />
      <PipelineBoard />
      <InboxChat />
      <ActivityFeed />
    </main>
  )
}
