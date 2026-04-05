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

// Check if a file with this hash already exists in the trip (ready status)
export async function findByHash(tripId: string, fileHash: string): Promise<TripMedia | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('trip_media')
    .select('*')
    .eq('trip_id', tripId)
    .eq('file_hash', fileHash)
    .eq('status', 'ready')
    .limit(1)
    .single()
  return data ?? null
}

// Scan a trip and soft-delete all duplicate rows (keeps earliest per hash)
// Returns number of rows removed
export async function dedupTrip(tripId: string): Promise<number> {
  const supabase = createServiceClient()

  // Find all hashes that have more than one ready row
  const { data: allRows } = await supabase
    .from('trip_media')
    .select('id, file_hash, created_at')
    .eq('trip_id', tripId)
    .eq('status', 'ready')
    .not('file_hash', 'is', null)
    .order('created_at', { ascending: true })

  if (!allRows || allRows.length === 0) return 0

  // Group by hash, keep first (earliest), collect rest for deletion
  const seen = new Map<string, boolean>()
  const toDelete: string[] = []

  for (const row of allRows) {
    const hash = row.file_hash as string
    if (seen.has(hash)) {
      toDelete.push(row.id)
    } else {
      seen.set(hash, true)
    }
  }

  if (toDelete.length === 0) return 0

  const { error } = await supabase
    .from('trip_media')
    .update({ status: 'deleted' })
    .in('id', toDelete)

  if (error) throw error
  return toDelete.length
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
