import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId  = searchParams.get('event_id')
  const eventIds = searchParams.get('event_ids')

  const supabase = createServiceClient()

  if (eventIds) {
    const ids = eventIds.split(',').filter(Boolean)
    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .in('event_id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (eventId) {
    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .eq('event_id', eventId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Missing event_id or event_ids' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const { event_id, person, emoji } = await request.json()

  if (!event_id || !person || !emoji) {
    return NextResponse.json({ error: 'event_id, person, emoji required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('event_id', event_id)
    .eq('person', person)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    // Toggle off — delete it
    const { error } = await supabase.from('reactions').delete().eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ action: 'removed' })
  }

  // Add reaction
  const { data, error } = await supabase
    .from('reactions')
    .insert({ event_id, person, emoji })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: 'added', reaction: data })
}
