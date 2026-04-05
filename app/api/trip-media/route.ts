import { NextRequest, NextResponse } from 'next/server'
import { getTripMedia, getReactionsForMedia, deleteTripMedia } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get('trip_id')
    const uploader = searchParams.get('uploader') ?? undefined
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') ?? '30', 10)

    if (!tripId) {
      return NextResponse.json({ error: 'trip_id required' }, { status: 400 })
    }

    const { items, total } = await getTripMedia(tripId, { uploader, page, pageSize })

    // Attach reactions
    const mediaIds = items.map(m => m.id)
    const reactions = await getReactionsForMedia(mediaIds)
    const reactionsMap: Record<string, typeof reactions> = {}
    for (const r of reactions) {
      if (!reactionsMap[r.media_id]) reactionsMap[r.media_id] = []
      reactionsMap[r.media_id].push(r)
    }
    const itemsWithReactions = items.map(m => ({
      ...m,
      reactions: reactionsMap[m.id] ?? [],
    }))

    return NextResponse.json({ items: itemsWithReactions, total, page, pageSize })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get('id')
    if (!mediaId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    await deleteTripMedia(mediaId)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
