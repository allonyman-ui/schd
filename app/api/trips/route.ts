import { NextRequest, NextResponse } from 'next/server'
import { getTrips, createTrip, getTripBySlug } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const trips = await getTrips()
    return NextResponse.json(trips)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, title, description, starts_on, ends_on } = body

    if (!slug || !title) {
      return NextResponse.json({ error: 'slug and title required' }, { status: 400 })
    }

    const existing = await getTripBySlug(slug)
    if (existing) {
      return NextResponse.json({ error: 'Trip with this slug already exists' }, { status: 409 })
    }

    const trip = await createTrip({ slug, title, description, cover_url: null, starts_on, ends_on })
    return NextResponse.json(trip, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
