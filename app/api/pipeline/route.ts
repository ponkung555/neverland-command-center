import { NextResponse } from 'next/server'
import { listPipeline } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ reports: listPipeline() })
}
