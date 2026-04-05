import { NextRequest, NextResponse } from 'next/server'
import { confirmTripMedia, updateTripCover } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { media_id, set_as_cover } = body

    if (!media_id) {
      return NextResponse.json({ error: 'media_id required' }, { status: 400 })
    }

    const media = await confirmTripMedia(media_id)

    if (set_as_cover) {
      await updateTripCover(media.trip_id, media.public_url)
    }

    return NextResponse.json(media)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
