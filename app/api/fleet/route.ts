import { NextResponse } from 'next/server'
import { computeFleet } from '@/lib/fleet'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(computeFleet())
}
