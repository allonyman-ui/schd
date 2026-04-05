import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createSignedUploadUrl, getPublicUrl, insertTripMedia } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trip_id, trip_slug, uploader, filename, content_type, file_size, taken_at, caption, width, height } = body

    if (!trip_id || !uploader || !filename || !content_type) {
      return NextResponse.json({ error: 'trip_id, uploader, filename, content_type required' }, { status: 400 })
    }

    const ext = filename.split('.').pop()?.toLowerCase() || 'bin'
    const mediaType = content_type.startsWith('video/') ? 'video' : 'photo'
    const path = `${trip_slug || trip_id}/${uploader}/${randomUUID()}.${ext}`

    const signedUrl = await createSignedUploadUrl(path)
    const publicUrl = getPublicUrl(path)

    const media = await insertTripMedia({
      trip_id,
      uploader,
      storage_path: path,
      public_url: publicUrl,
      media_type: mediaType,
      mime_type: content_type,
      file_size: file_size ?? null,
      width: width ?? null,
      height: height ?? null,
      duration_sec: null,
      caption: caption ?? null,
      taken_at: taken_at ?? new Date().toISOString(),
      status: 'pending',
    })

    return NextResponse.json({ signed_url: signedUrl, media_id: media.id, public_url: publicUrl })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
