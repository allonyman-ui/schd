import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')
  const person = searchParams.get('person')
  const includeRecurring = searchParams.get('include_recurring') === 'true'

  const supabase = createServiceClient()

  if (includeRecurring && startDate && endDate) {
    // Fetch date-specific events AND all recurring events
    const [dateRes, recurringRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('is_recurring', false)
        .order('start_time'),
      supabase
        .from('events')
        .select('*')
        .eq('is_recurring', true)
        .order('start_time'),
    ])
    if (dateRes.error) return NextResponse.json({ error: dateRes.error.message }, { status: 500 })
    if (recurringRes.error) return NextResponse.json({ error: recurringRes.error.message }, { status: 500 })
    return NextResponse.json([...(dateRes.data ?? []), ...(recurringRes.data ?? [])])
  }

  let query = supabase.from('events').select('*').order('date').order('start_time')

  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)
  if (person) query = query.eq('person', person)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = createServiceClient()

  // Only pass known columns — strip extra fields like action/original_title/source
  const {
    person, title, date, start_time, end_time,
    location, notes, is_recurring, recurrence_days,
    completed, meeting_link
  } = body

  const row = {
    person: person || null,
    title: title || null,
    date: date || null,
    start_time: start_time || null,
    end_time: end_time || null,
    location: location || null,
    notes: notes || null,
    is_recurring: is_recurring ?? false,
    recurrence_days: recurrence_days || null,
    completed: completed ?? false,
    meeting_link: meeting_link || null,
  }

  const { data, error } = await supabase
    .from('events')
    .insert(row)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await request.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('events').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
