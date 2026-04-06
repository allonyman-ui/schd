import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createSignedUploadUrl, getPublicUrl, insertTripMedia, findByHash, cleanOrphanedPending } from '@/lib/trip-media'

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

// Postgres unique-violation error code
const PG_UNIQUE_VIOLATION = '23505'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      trip_id, trip_slug, uploader,
      filename, content_type, file_size,
      taken_at, caption, width, height,
      latitude, longitude, location_name,
      file_hash, original_filename,
    } = body

    if (!trip_id || !uploader || !filename) {
      return NextResponse.json({ error: 'trip_id, uploader, filename required' }, { status: 400 })
    }

    // ── Opportunistically clean orphaned pending rows (best-effort, non-blocking) ──
    // Orphans are pending rows older than 10 minutes whose upload never completed.
    // They block re-uploads of the same files. We clean them before the hash check
    // so they don't falsely block this upload.
    cleanOrphanedPending(trip_id).catch(() => { /* non-blocking */ })

    // ── Duplicate check ───────────────────────────────────────────────────────────
    if (file_hash) {
      const existing = await findByHash(trip_id, file_hash, file_size, taken_at, latitude, longitude, uploader, original_filename ?? filename)
      if (existing) {
        return NextResponse.json({
          duplicate:    true,
          existing_url: existing.public_url,
          media_id:     existing.id,
        })
      }
    }

    // ── New file — generate signed URL ────────────────────────────────────────────
    const mimeType  = resolveMime(content_type, filename)
    const ext       = filename.split('.').pop()?.toLowerCase() || 'bin'
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'photo'
    const path      = `${trip_slug || trip_id}/${uploader}/${randomUUID()}.${ext}`

    const signedUrl = await createSignedUploadUrl(path)
    const publicUrl = getPublicUrl(path)

    try {
      const media = await insertTripMedia({
        trip_id,
        uploader,
        storage_path:  path,
        public_url:    publicUrl,
        media_type:    mediaType,
        mime_type:     mimeType,
        file_size:     file_size     ?? null,
        file_hash:         file_hash                   ?? null,
        original_filename: (original_filename ?? filename ?? null),
        width:             width                       ?? null,
        height:        height         ?? null,
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
    } catch (insertErr: unknown) {
      // ── Unique constraint violation → race condition; treat as duplicate ─────────
      // This fires when two workers insert the same file_hash in the same millisecond,
      // faster than findByHash can detect. With the DB constraint in place this is the
      // final safety net: the second insert fails, we return duplicate:true cleanly.
      const code = (insertErr as { code?: string }).code
        ?? ((insertErr as { cause?: { code?: string } }).cause?.code)
      if (code === PG_UNIQUE_VIOLATION) {
        console.info('[presign] unique constraint caught race-condition dupe, hash:', file_hash?.slice(0, 12))
        // Find the winning row so we can return its id/url
        const existing = await findByHash(trip_id, file_hash, file_size, taken_at, latitude, longitude, uploader, original_filename ?? filename)
        return NextResponse.json({
          duplicate:    true,
          existing_url: existing?.public_url ?? null,
          media_id:     existing?.id ?? null,
        })
      }
      throw insertErr
    }
  } catch (e: unknown) {
    console.error('[presign]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
