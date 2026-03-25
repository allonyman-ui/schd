import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const person = searchParams.get('person')
  const general = searchParams.get('general') // ?general=true → all standing reminders (no person/date)
  const grocery = searchParams.get('grocery')  // ?grocery=true → grocery list items
  const links   = searchParams.get('links')    // ?links=true   → family links
  const all     = searchParams.get('all')      // ?all=true     → all reminders (excl. __link__ and __grocery__)
  const supabase = createServiceClient()
  let query = supabase.from('reminders').select('*').order('created_at')
  if (links === 'true') {
    query = query.eq('person', '__link__')
  } else if (grocery === 'true') {
    query = query.eq('person', '__grocery__')
  } else if (all === 'true') {
    // Return ALL reminders excluding special persons
    query = query.neq('person', '__link__').neq('person', '__grocery__')
  } else if (general === 'true') {
    // Return only null-person standing reminders
    query = query.is('person', null)
  } else {
    if (date) query = query.eq('date', date)
    if (person) query = query.eq('person', person)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('reminders').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await request.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('reminders').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const supabase = createServiceClient()
  const { error } = await supabase.from('reminders').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
