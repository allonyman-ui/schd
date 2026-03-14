import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('lunch_menus')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { date, menu } = await request.json()
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  const supabase = createServiceClient()

  // Upsert — update if exists, insert if not
  const { data, error } = await supabase
    .from('lunch_menus')
    .upsert({ date, menu: menu || '' }, { onConflict: 'date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
