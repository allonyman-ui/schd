import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('kid_profiles').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { key, photo_url } = await request.json()
  if (!key || !photo_url) return NextResponse.json({ error: 'Missing key or photo_url' }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('kid_profiles')
    .upsert({ key, photo_url, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
