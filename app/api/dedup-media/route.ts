import { NextRequest, NextResponse } from 'next/server'
import { dedupTrip } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

// POST /api/dedup-media  { trip_id }
// Scans the trip for duplicates (hash → size+time → size+day),
// soft-deletes all but the earliest copy of each file.
// Returns { removed, scanned }
export async function POST(request: NextRequest) {
  try {
    const { trip_id } = await request.json()
    if (!trip_id) {
      return NextResponse.json({ error: 'trip_id required' }, { status: 400 })
    }
    const result = await dedupTrip(trip_id)
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
