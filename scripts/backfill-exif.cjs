/**
 * Backfill script: Download existing trip_media files, extract real EXIF
 * capture date + GPS, reverse-geocode via Nominatim, update DB rows.
 *
 * Usage:
 *   /usr/local/bin/node scripts/backfill-exif.cjs [trip_id]
 *
 * If trip_id is omitted, processes ALL trips.
 */

const { createClient } = require('../node_modules/@supabase/supabase-js/dist/index.cjs')
const exifr = require('../node_modules/exifr/dist/full.umd.cjs')
const https = require('https')
const http = require('http')

const SUPABASE_URL = 'https://iqsnpllfopcgbvmyouuz.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxc25wbGxmb3BjZ2J2bXlvdXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ5MTM2MSwiZXhwIjoyMDg5MDY3MzYxfQ.AH9d6TJFrQtG6I41k6WdTZgRHVguXZdGv06KAIXQVwc'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const TRIP_MEDIA_BUCKET = 'trip-media'
const CONCURRENCY = 4
const NOMINATIM_DELAY_MS = 1100   // respect 1 req/sec rate limit

// ── helpers ──────────────────────────────────────────────────────────────────

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, { headers: { 'User-Agent': 'family-trip-app/1.0' } }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end',  () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=he`
    const buf  = await fetchBuffer(url)
    const json = JSON.parse(buf.toString())
    const a = json.address ?? {}
    // Build a nice short name: city / town / village / neighbourhood + country
    const city    = a.city || a.town || a.village || a.municipality || a.county || ''
    const country = a.country || ''
    if (city && country) return `${city}, ${country}`
    if (city) return city
    if (json.display_name) return json.display_name.split(',').slice(0, 2).join(',').trim()
    return null
  } catch (e) {
    console.warn('  Nominatim error:', e.message)
    return null
  }
}

// Date candidates in priority order
const DATE_FIELDS = [
  'DateTimeOriginal', 'CreateDate', 'DateTime',
  'DateCreated', 'TrackCreateDate', 'MediaCreateDate',
]

function extractExifDate(exif) {
  for (const f of DATE_FIELDS) {
    const v = exif[f]
    if (v instanceof Date && !isNaN(v)) return v.toISOString()
    if (typeof v === 'string' && v.length >= 10) {
      const d = new Date(v.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
      if (!isNaN(d)) return d.toISOString()
    }
  }
  return null
}

// ── main ─────────────────────────────────────────────────────────────────────

async function processRow(row, geocodeCache, nominatimQueue) {
  // Only process photos (videos rarely have readable EXIF via exifr)
  if (row.media_type !== 'photo') return null

  // Skip rows that already have all data
  if (row.latitude != null && row.location_name && row.taken_at) {
    const uploadTs = new Date(row.created_at).getTime()
    const takenTs  = new Date(row.taken_at).getTime()
    // If taken_at differs meaningfully from created_at, it's already real EXIF data
    if (Math.abs(takenTs - uploadTs) > 60 * 1000) {
      process.stdout.write('·')
      return null
    }
  }

  // Download file
  let buffer
  try {
    const url = `${SUPABASE_URL}/storage/v1/object/public/${TRIP_MEDIA_BUCKET}/${row.storage_path}`
    buffer = await fetchBuffer(url)
  } catch (e) {
    process.stdout.write('!')
    return null
  }

  // Parse EXIF
  let exif
  try {
    exif = await exifr.parse(buffer, {
      tiff: true, xmp: true, icc: false, iptc: true,
      reviveValues: true, translateValues: true, mergeOutput: true,
    })
  } catch {
    exif = null
  }

  if (!exif) {
    process.stdout.write('-')
    return null
  }

  const takenAt  = extractExifDate(exif)
  const lat      = exif.latitude  ?? exif.GPSLatitude  ?? null
  const lon      = exif.longitude ?? exif.GPSLongitude ?? null

  if (!takenAt && lat == null) {
    process.stdout.write('?')
    return null
  }

  // Reverse geocode (with cache)
  let locationName = row.location_name ?? null
  if (lat != null && lon != null) {
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`
    if (geocodeCache.has(cacheKey)) {
      locationName = geocodeCache.get(cacheKey)
    } else {
      // Serialize Nominatim calls to respect rate limit
      const name = await nominatimQueue(async () => {
        await sleep(NOMINATIM_DELAY_MS)
        return reverseGeocode(lat, lon)
      })
      locationName = name
      geocodeCache.set(cacheKey, name)
    }
  }

  const update = {}
  if (takenAt)          update.taken_at       = takenAt
  if (lat != null)      update.latitude       = lat
  if (lon != null)      update.longitude      = lon
  if (locationName)     update.location_name  = locationName

  if (Object.keys(update).length === 0) {
    process.stdout.write('?')
    return null
  }

  const { error } = await supabase
    .from('trip_media')
    .update(update)
    .eq('id', row.id)

  if (error) {
    console.error('\n  DB error for', row.id, error.message)
    process.stdout.write('E')
    return null
  }

  process.stdout.write('✓')
  return { id: row.id, takenAt, lat, lon, locationName }
}

// Simple serial queue for Nominatim
function makeSerialQueue() {
  let chain = Promise.resolve()
  return function enqueue(fn) {
    chain = chain.then(fn)
    return chain
  }
}

async function runPool(rows, geocodeCache, nominatimQueue) {
  let i = 0
  let done = 0
  const total = rows.length

  async function worker() {
    while (i < total) {
      const row = rows[i++]
      await processRow(row, geocodeCache, nominatimQueue)
      done++
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker())
  await Promise.all(workers)
}

async function main() {
  const tripId = process.argv[2] ?? null

  console.log('🔍 Fetching trip_media rows…')
  let query = supabase
    .from('trip_media')
    .select('id, trip_id, media_type, storage_path, public_url, taken_at, latitude, longitude, location_name, created_at')
    .eq('status', 'ready')
    .order('created_at', { ascending: true })

  if (tripId) query = query.eq('trip_id', tripId)

  const { data: rows, error } = await query
  if (error) { console.error('Failed to fetch rows:', error.message); process.exit(1) }

  const photos = (rows ?? []).filter(r => r.media_type === 'photo')
  console.log(`📷 Found ${photos.length} photo rows (of ${rows.length} total)`)

  if (photos.length === 0) { console.log('Nothing to process.'); return }

  const geocodeCache = new Map()
  const nominatimQueue = makeSerialQueue()

  console.log(`\nProcessing (· = skipped, ✓ = updated, - = no EXIF, ? = no useful data, ! = download error, E = DB error):\n`)
  await runPool(photos, geocodeCache, nominatimQueue)

  console.log('\n\n✅ Done!')
}

main().catch(e => { console.error(e); process.exit(1) })
