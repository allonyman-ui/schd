import { NextRequest, NextResponse } from 'next/server'
import { toggleReaction } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { media_id, person, emoji } = await request.json()
    if (!media_id || !person || !emoji) {
      return NextResponse.json({ error: 'media_id, person, emoji required' }, { status: 400 })
    }
    const result = await toggleReaction(media_id, person, emoji)
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
