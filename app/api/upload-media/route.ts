import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  getPublicUrl,
  insertTripMedia,
  ensureTripMediaBucket,
  TRIP_MEDIA_BUCKET,
} from '@/lib/trip-media'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Fallback direct upload for small files (≤4MB)
// For larger files, use /api/upload-media/presign + /api/upload-media/confirm
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const trip_id = formData.get('trip_id') as string | null
    const trip_slug = formData.get('trip_slug') as string | null
    const uploader = formData.get('uploader') as string | null
    const caption = formData.get('caption') as string | null
    const taken_at = formData.get('taken_at') as string | null

    if (!file || !trip_id || !uploader) {
      return NextResponse.json({ error: 'file, trip_id, uploader required' }, { status: 400 })
    }

    await ensureTripMediaBucket()

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const mediaType = file.type.startsWith('video/') ? 'video' : 'photo'
    const path = `${trip_slug || trip_id}/${uploader}/${randomUUID()}.${ext}`

    const supabase = createServiceClient()
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(TRIP_MEDIA_BUCKET)
      .upload(path, Buffer.from(arrayBuffer), {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const publicUrl = getPublicUrl(path)
    const media = await insertTripMedia({
      trip_id,
      uploader,
      storage_path:  path,
      public_url:    publicUrl,
      media_type:    mediaType,
      mime_type:     file.type,
      file_size:     file.size,
      file_hash:     null,
      width:         null,
      height:        null,
      duration_sec:  null,
      latitude:      null,
      longitude:     null,
      location_name: null,
      caption: caption ?? null,
      taken_at: taken_at ?? new Date().toISOString(),
      status: 'ready',
    })

    return NextResponse.json(media, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
