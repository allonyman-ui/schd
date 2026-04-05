import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createSignedUploadUrl, getPublicUrl, insertTripMedia, findByHash } from '@/lib/trip-media'

export const dynamic = 'force-dynamic'

const MIME_FALLBACK: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif',  webp: 'image/webp', heic: 'image/heic',
  heif: 'image/heif', mp4: 'video/mp4',  mov: 'video/quicktime',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  webm: 'video/webm', m4v: 'video/mp4',
}

function resolveMime(contentType: string | undefined, filename: string): string {
  if (contentType && contentType !== 'application/octet-stream') return contentType
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME_FALLBACK[ext] ?? 'application/octet-stream'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      trip_id, trip_slug, uploader,
      filename, content_type, file_size,
      taken_at, caption, width, height,
      latitude, longitude, location_name,
      file_hash,
    } = body

    if (!trip_id || !uploader || !filename) {
      return NextResponse.json({ error: 'trip_id, uploader, filename required' }, { status: 400 })
    }

    // ── Duplicate check by hash ───────────────────────────────────────
    if (file_hash) {
      const existing = await findByHash(trip_id, file_hash)
      if (existing) {
        // File already exists — tell the client to skip it
        return NextResponse.json({
          duplicate: true,
          existing_url: existing.public_url,
          media_id: existing.id,
        })
      }
    }

    // ── New file — generate signed URL ───────────────────────────────
    const mimeType  = resolveMime(content_type, filename)
    const ext       = filename.split('.').pop()?.toLowerCase() || 'bin'
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'photo'
    const path      = `${trip_slug || trip_id}/${uploader}/${randomUUID()}.${ext}`

    const signedUrl = await createSignedUploadUrl(path)
    const publicUrl = getPublicUrl(path)

    const media = await insertTripMedia({
      trip_id,
      uploader,
      storage_path:  path,
      public_url:    publicUrl,
      media_type:    mediaType,
      mime_type:     mimeType,
      file_size:     file_size     ?? null,
      file_hash:     file_hash     ?? null,
      width:         width         ?? null,
      height:        height        ?? null,
      duration_sec:  null,
      caption:       caption       ?? null,
      taken_at:      taken_at      ?? new Date().toISOString(),
      latitude:      latitude      ?? null,
      longitude:     longitude     ?? null,
      location_name: location_name ?? null,
      status:        'pending',
    })

    return NextResponse.json({
      duplicate:  false,
      signed_url: signedUrl,
      media_id:   media.id,
      public_url: publicUrl,
    })
  } catch (e: unknown) {
    console.error('[presign]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
