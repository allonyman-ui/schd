import { NextRequest, NextResponse } from 'next/server'
import { dedupTrip } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

// POST /api/dedup-media  { trip_id }
// Scans the trip, soft-deletes duplicate rows (keeps earliest per file hash)
// Returns { removed: number }
export async function POST(request: NextRequest) {
  try {
    const { trip_id } = await request.json()
    if (!trip_id) {
      return NextResponse.json({ error: 'trip_id required' }, { status: 400 })
    }
    const removed = await dedupTrip(trip_id)
    return NextResponse.json({ removed })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
