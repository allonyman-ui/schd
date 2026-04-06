import { NextRequest, NextResponse } from 'next/server'
import { dedupTrip, cleanOrphanedPending } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

// POST /api/dedup-media  { trip_id }
// 1. Cleans orphaned pending rows (uploads that never completed)
// 2. Scans for content duplicates (hash → size+time → size+day)
// Returns { removed, scanned, orphansCleaned }
export async function POST(request: NextRequest) {
  try {
    const { trip_id } = await request.json()
    if (!trip_id) {
      return NextResponse.json({ error: 'trip_id required' }, { status: 400 })
    }

    // Step 1: clean orphaned pending rows first (so they don't interfere with dedup)
    await cleanOrphanedPending(trip_id)

    // Step 2: dedup content duplicates
    const result = await dedupTrip(trip_id)
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
