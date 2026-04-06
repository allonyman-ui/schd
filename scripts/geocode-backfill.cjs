/**
 * Fast geocode backfill — fills location_name for rows that have lat/lon but no name.
 * No file downloads needed; just reverse-geocodes existing GPS coords.
 *
 * Usage: /usr/local/bin/node scripts/geocode-backfill.cjs
 */
const { createClient } = require('../node_modules/@supabase/supabase-js/dist/index.cjs')
const https = require('https')

const SUPABASE_URL = 'https://iqsnpllfopcgbvmyouuz.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxc25wbGxmb3BjZ2J2bXlvdXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ5MTM2MSwiZXhwIjoyMDg5MDY3MzYxfQ.AH9d6TJFrQtG6I41k6WdTZgRHVguXZdGv06KAIXQVwc'
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DELAY_MS = 1100  // Nominatim rate limit: 1 req/sec

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'family-trip-app/1.0' } }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch(e) { reject(e) } })
      res.on('error', reject)
    }).on('error', reject)
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=he&zoom=14`
  try {
    const d = await fetchJson(url)
    const a = d.address ?? {}
    // Try most specific name first, fall back to broader area
    return (
      a.city_district || a.suburb || a.neighbourhood ||
      a.city || a.town || a.village || a.municipality ||
      a.county || a.state || a.country || null
    )
  } catch { return null }
}

async function main() {
  // Fetch rows with GPS but no location_name
  const { data: rows, error } = await supabase
    .from('trip_media')
    .select('id, latitude, longitude, location_name')
    .eq('status', 'ready')
    .not('latitude', 'is', null)
    .is('location_name', null)
    .order('id')

  if (error) { console.error(error.message); return }
  console.log(`Found ${rows.length} rows with GPS but no location_name`)
  if (!rows.length) { console.log('Nothing to do!'); return }

  // Deduplicate GPS coords so we don't call Nominatim twice for the same location
  const cache = new Map()  // "lat2,lon2" → location_name

  let updated = 0, failed = 0
  for (const row of rows) {
    const cacheKey = `${row.latitude.toFixed(2)},${row.longitude.toFixed(2)}`

    let name
    if (cache.has(cacheKey)) {
      name = cache.get(cacheKey)
      process.stdout.write('c')  // cache hit
    } else {
      await sleep(DELAY_MS)
      name = await reverseGeocode(row.latitude, row.longitude)
      cache.set(cacheKey, name)
      process.stdout.write(name ? '✓' : '?')
    }

    if (name) {
      const { error: upErr } = await supabase
        .from('trip_media')
        .update({ location_name: name })
        .eq('id', row.id)
      if (upErr) { console.error('\nDB error:', upErr.message); failed++ }
      else updated++
    } else {
      failed++
    }
  }

  console.log(`\n\nDone: ${updated} updated, ${failed} failed/no-result`)
  console.log(`Cache size: ${cache.size} unique locations`)

  // Show what we wrote
  const { data: check } = await supabase
    .from('trip_media')
    .select('location_name')
    .eq('status', 'ready')
    .not('location_name', 'is', null)
  const counts = {}
  for (const r of check ?? []) counts[r.location_name] = (counts[r.location_name]??0)+1
  console.log('\nLocation breakdown:')
  Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v} photos`))
}

main().catch(e => { console.error(e); process.exit(1) })
