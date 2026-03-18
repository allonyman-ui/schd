import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/kid-profiles?kid=ami  → all gallery photos for that kid
// GET /api/kid-profiles           → all profile photos (key → photo_url map)
export async function GET(request: NextRequest) {
  const supabase = createServiceClient()
  const kid = request.nextUrl.searchParams.get('kid')

  if (kid) {
    const { data, error } = await supabase
      .from('kid_gallery')
      .select('*')
      .eq('kid_key', kid)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // Return map of kid_key → profile photo_url
  const { data, error } = await supabase
    .from('kid_gallery')
    .select('kid_key, photo_url')
    .eq('is_profile', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const map: Record<string, string> = {}
  ;(data ?? []).forEach((r: { kid_key: string; photo_url: string }) => { map[r.kid_key] = r.photo_url })
  return NextResponse.json(map)
}

// POST /api/kid-profiles  {kid_key, photo_url, set_as_profile?}
export async function POST(request: NextRequest) {
  const { kid_key, photo_url, set_as_profile } = await request.json()
  if (!kid_key || !photo_url) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const supabase = createServiceClient()

  // Insert new photo
  const { data, error } = await supabase
    .from('kid_gallery')
    .insert({ kid_key, photo_url, is_profile: set_as_profile ?? false })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If set_as_profile, clear other profiles for this kid first
  if (set_as_profile) {
    await supabase.from('kid_gallery').update({ is_profile: false })
      .eq('kid_key', kid_key).neq('id', data.id)
  }

  return NextResponse.json(data)
}

// PATCH /api/kid-profiles  {id, is_profile?: bool, label?: string}
export async function PATCH(request: NextRequest) {
  const { id, is_profile, label } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const supabase = createServiceClient()

  if (is_profile) {
    // First, get the kid_key for this photo
    const { data: photo } = await supabase.from('kid_gallery').select('kid_key').eq('id', id).single()
    if (photo) {
      // Clear other profiles for this kid
      await supabase.from('kid_gallery').update({ is_profile: false }).eq('kid_key', photo.kid_key)
    }
  }

  const updates: Record<string, unknown> = {}
  if (is_profile !== undefined) updates.is_profile = is_profile
  if (label !== undefined) updates.label = label

  const { data, error } = await supabase.from('kid_gallery').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/kid-profiles?id=uuid
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const supabase = createServiceClient()
  const { error } = await supabase.from('kid_gallery').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
