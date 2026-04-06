import { NextRequest, NextResponse } from 'next/server'
import { getTripMedia } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

/**
 * GET /api/download-album?trip_id=...&media_type=photo
 *
 * Returns ALL media (no pagination) for the given trip.
 * Used by the print/download page.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId    = searchParams.get('trip_id')
    const mediaType = (searchParams.get('media_type') ?? undefined) as 'photo' | 'video' | undefined

    if (!tripId) {
      return NextResponse.json({ error: 'trip_id required' }, { status: 400 })
    }

    // Fetch all items (up to 2000) — no pagination
    const { items } = await getTripMedia(tripId, {
      mediaType,
      page:     1,
      pageSize: 2000,
    })

    return NextResponse.json({ items, total: items.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
