import { createServiceClient } from '@/lib/supabase'

export const TRIP_MEDIA_BUCKET = 'trip-media'

export interface Trip {
  id: string
  slug: string
  title: string
  description: string | null
  cover_url: string | null
  starts_on: string | null
  ends_on: string | null
  created_at: string
  media_count?: number
}

export interface TripMedia {
  id: string
  trip_id: string
  uploader: string
  storage_path: string
  public_url: string
  media_type: 'photo' | 'video'
  mime_type: string | null
  file_size: number | null
  file_hash: string | null
  width: number | null
  height: number | null
  duration_sec: number | null
  caption: string | null
  taken_at: string
  latitude: number | null
  longitude: number | null
  location_name: string | null
  status: 'pending' | 'ready' | 'deleted'
  created_at: string
  reactions?: MediaReaction[]
}

export interface MediaReaction {
  id: string
  media_id: string
  person: string
  emoji: string
  created_at: string
}

// ── Trips ─────────────────────────────────────────────────────────

export async function getTrips(): Promise<Trip[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('starts_on', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getTripBySlug(slug: string): Promise<Trip | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) return null
  return data
}

export async function createTrip(trip: Omit<Trip, 'id' | 'created_at' | 'media_count'>): Promise<Trip> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('trips')
    .insert(trip)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTripCover(tripId: string, coverUrl: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('trips')
    .update({ cover_url: coverUrl })
    .eq('id', tripId)
  if (error) throw error
}

// ── Trip Media ────────────────────────────────────────────────────

export async function getTripMedia(
  tripId: string,
  opts: { uploader?: string; mediaType?: 'photo' | 'video'; page?: number; pageSize?: number } = {}
): Promise<{ items: TripMedia[]; total: number }> {
  const supabase = createServiceClient()
  const { uploader, mediaType, page = 1, pageSize = 30 } = opts
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('trip_media')
    .select('*', { count: 'exact' })
    .eq('trip_id', tripId)
    .eq('status', 'ready')
    .order('taken_at', { ascending: true })
    .range(from, to)

  if (uploader)   query = query.eq('uploader', uploader)
  if (mediaType)  query = query.eq('media_type', mediaType)

  const { data, error, count } = await query
  if (error) throw error
  return { items: data ?? [], total: count ?? 0 }
}

// Check if a file already exists in the trip.
// Checks by hash first (exact), then several fallbacks for old rows without hashes.
//
// For 'pending' rows we only consider RECENT ones (< 5 min old) — older pending
// rows are orphans from failed/timed-out uploads and should be ignored so the
// user can re-attempt uploading the same file.
export async function findByHash(
  tripId: string,
  fileHash: string,
  fileSize?: number,
  takenAt?: string
): Promise<TripMedia | null> {
  const supabase = createServiceClient()

  // Cutoff: pending rows older than this are orphans (upload failed), ignore them
  const orphanCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  // 1. Exact hash — ready rows (definitive)
  const { data: byHashReady } = await supabase
    .from('trip_media')
    .select('*')
    .eq('trip_id', tripId)
    .eq('file_hash', fileHash)
    .eq('status', 'ready')
    .limit(1)
    .maybeSingle()
  if (byHashReady) return byHashReady

  // 2. Exact hash — recent pending rows (in-progress concurrent upload)
  const { data: byHashPending } = await supabase
    .from('trip_media')
    .select('*')
    .eq('trip_id', tripId)
    .eq('file_hash', fileHash)
    .eq('status', 'pending')
    .gte('created_at', orphanCutoff)   // only fresh pending rows
    .limit(1)
    .maybeSingle()
  if (byHashPending) return byHashPending

  // 3. Size + second-precision timestamp (catches rows without hash)
  if (fileSize && takenAt) {
    const ts = new Date(takenAt).toISOString().slice(0, 19)
    const { data: byMeta } = await supabase
      .from('trip_media')
      .select('*')
      .eq('trip_id', tripId)
      .eq('file_size', fileSize)
      .eq('status', 'ready')
      .like('taken_at', `${ts}%`)
      .limit(1)
      .maybeSingle()
    if (byMeta) return byMeta
  }

  // 4. Size alone, same day — catches re-uploads where taken_at changed
  //    (old rows stored upload time; new upload has real EXIF capture time)
  if (fileSize && fileSize > 50_000 && takenAt) {
    const day = takenAt.slice(0, 10)
    const { data: bySize } = await supabase
      .from('trip_media')
      .select('*')
      .eq('trip_id', tripId)
      .eq('file_size', fileSize)
      .eq('status', 'ready')
      .like('taken_at', `${day}%`)
      .limit(1)
      .maybeSingle()
    if (bySize) return bySize
  }

  return null
}

// Scan a trip and soft-delete all duplicate rows.
// Matching strategy (applied in priority order, most to least precise):
//   1. file_hash          — exact content hash, 100% reliable
//   2. file_size + taken_at (second precision) — old rows without hash, same timestamp
//   3. file_size + taken_at (day precision)    — same file re-uploaded with different time metadata
// Keeps the earliest created_at in each group. Returns { removed, scanned }.
export async function dedupTrip(tripId: string): Promise<{ removed: number; scanned: number }> {
  const supabase = createServiceClient()

  // Include 'pending' rows so concurrent uploads are caught too
  const { data: allRows } = await supabase
    .from('trip_media')
    .select('id, file_hash, file_size, taken_at, created_at, uploader')
    .eq('trip_id', tripId)
    .in('status', ['ready', 'pending'])
    .order('created_at', { ascending: true })

  if (!allRows || allRows.length === 0) return { removed: 0, scanned: 0 }

  const seen    = new Map<string, string>()  // key → id of the canonical copy
  const toDelete: string[] = []

  for (const row of allRows) {
    const keys: string[] = []

    if (row.file_hash) {
      // Strategy 1: exact hash (most reliable)
      keys.push(`h::${row.file_hash}`)
    }

    if (row.file_size && row.taken_at) {
      // Strategy 2: size + second-precision timestamp
      const ts = new Date(row.taken_at).toISOString().slice(0, 19)
      keys.push(`s::${row.file_size}::${ts}`)

      // Strategy 3: size + day (catches re-uploads with different EXIF/upload time)
      // Only for files > 50 KB to avoid false-positives on tiny thumbnails
      if (row.file_size > 50_000) {
        const day = row.taken_at.slice(0, 10)
        keys.push(`d::${row.file_size}::${day}`)
      }
    }

    if (keys.length === 0) continue

    // Check if ANY key was seen before (= duplicate)
    const seenKey = keys.find(k => seen.has(k))
    if (seenKey) {
      toDelete.push(row.id)
    } else {
      // Register all keys for this canonical row
      keys.forEach(k => seen.set(k, row.id))
    }
  }

  if (toDelete.length === 0) return { removed: 0, scanned: allRows.length }

  // Delete in batches of 100 to stay within Supabase limits
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100)
    const { error } = await supabase
      .from('trip_media')
      .update({ status: 'deleted' })
      .in('id', batch)
    if (error) throw error
  }

  return { removed: toDelete.length, scanned: allRows.length }
}

// Clean up pending rows older than 10 minutes for a trip.
// These are orphans from uploads that failed / timed out / browser closed.
// They block legitimate re-uploads of the same files.
// Safe to call fire-and-forget — never throws.
export async function cleanOrphanedPending(tripId: string): Promise<void> {
  try {
    const supabase = createServiceClient()
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    await supabase
      .from('trip_media')
      .update({ status: 'deleted' })
      .eq('trip_id', tripId)
      .eq('status', 'pending')
      .lt('created_at', cutoff)
  } catch { /* non-blocking — ignore all errors */ }
}

export async function insertTripMedia(
  media: Omit<TripMedia, 'id' | 'created_at' | 'reactions'>
): Promise<TripMedia> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('trip_media')
    .insert(media)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function confirmTripMedia(mediaId: string): Promise<TripMedia> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('trip_media')
    .update({ status: 'ready' })
    .eq('id', mediaId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTripMedia(mediaId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('trip_media')
    .update({ status: 'deleted' })
    .eq('id', mediaId)
  if (error) throw error
}

// ── Reactions ─────────────────────────────────────────────────────

export async function getReactionsForMedia(mediaIds: string[]): Promise<MediaReaction[]> {
  if (!mediaIds.length) return []
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('media_reactions')
    .select('*')
    .in('media_id', mediaIds)
  if (error) throw error
  return data ?? []
}

export async function toggleReaction(
  mediaId: string,
  person: string,
  emoji: string
): Promise<{ added: boolean }> {
  const supabase = createServiceClient()
  const { data: existing } = await supabase
    .from('media_reactions')
    .select('id')
    .eq('media_id', mediaId)
    .eq('person', person)
    .eq('emoji', emoji)
    .single()

  if (existing) {
    await supabase.from('media_reactions').delete().eq('id', existing.id)
    return { added: false }
  } else {
    await supabase.from('media_reactions').insert({ media_id: mediaId, person, emoji })
    return { added: true }
  }
}

// ── Storage helpers ───────────────────────────────────────────────

export async function ensureTripMediaBucket(): Promise<void> {
  const supabase = createServiceClient()
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some(b => b.name === TRIP_MEDIA_BUCKET)) {
    await supabase.storage.createBucket(TRIP_MEDIA_BUCKET, { public: true })
  }
}

export async function createSignedUploadUrl(path: string): Promise<string> {
  const supabase = createServiceClient()
  await ensureTripMediaBucket()
  const { data, error } = await supabase.storage
    .from(TRIP_MEDIA_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) throw error ?? new Error('Could not create signed URL')
  return data.signedUrl
}

export function getPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return `${base}/storage/v1/object/public/${TRIP_MEDIA_BUCKET}/${path}`
}

export function getThumbnailUrl(publicUrl: string, size = 400): string {
  // Supabase image transformations
  return `${publicUrl}?width=${size}&height=${size}&resize=cover&quality=75`
}
