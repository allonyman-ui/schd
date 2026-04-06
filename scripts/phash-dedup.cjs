/**
 * Perceptual-hash dedup — finds and removes visually identical photos
 * regardless of HEIC→JPEG re-encoding, quality differences, or metadata changes.
 *
 * Algorithm: resize each photo to 16×16 greyscale, flatten to 256 values,
 * compare mean; Hamming distance < THRESHOLD means "same image".
 *
 * Usage:
 *   /usr/local/bin/node scripts/phash-dedup.cjs          # dry-run (show matches only)
 *   /usr/local/bin/node scripts/phash-dedup.cjs --delete  # actually delete duplicates
 */

const { createClient } = require('../node_modules/@supabase/supabase-js/dist/index.cjs')
const sharp  = require('../node_modules/sharp')
const https  = require('https')
const http   = require('http')

const SUPABASE_URL = 'https://iqsnpllfopcgbvmyouuz.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxc25wbGxmb3BjZ2J2bXlvdXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ5MTM2MSwiZXhwIjoyMDg5MDY3MzYxfQ.AH9d6TJFrQtG6I41k6WdTZgRHVguXZdGv06KAIXQVwc'
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DELETE    = process.argv.includes('--delete')
const HASH_SIZE = 16          // 16×16 = 256-bit hash
const THRESHOLD = 12          // Hamming bits; <12 of 256 = visually identical
const CONCURRENCY = 4

// ── helpers ──────────────────────────────────────────────────────────────────

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, { headers: { 'User-Agent': 'family-trip-dedup/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end',  () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// Compute a 256-bit perceptual hash: 16×16 greyscale DCT-style average hash
async function pHash(buffer) {
  const pixels = await sharp(buffer)
    .resize(HASH_SIZE, HASH_SIZE, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer()

  const avg = pixels.reduce((s, v) => s + v, 0) / pixels.length
  // Each bit: pixel > average → 1, else → 0
  const bits = Buffer.alloc(Math.ceil(pixels.length / 8), 0)
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] > avg) bits[Math.floor(i / 8)] |= (1 << (i % 8))
  }
  return bits
}

// Hamming distance between two Buffers of equal length
function hamming(a, b) {
  let dist = 0
  for (let i = 0; i < a.length; i++) {
    let x = a[i] ^ b[i]
    while (x) { dist += x & 1; x >>= 1 }
  }
  return dist
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${DELETE ? '🗑️  DELETE duplicates' : '🔍  DRY RUN (pass --delete to remove)'}`)
  console.log(`Threshold: Hamming < ${THRESHOLD} of ${HASH_SIZE*HASH_SIZE} bits\n`)

  const { data: rows, error } = await supabase
    .from('trip_media')
    .select('id, file_size, taken_at, uploader, public_url, storage_path, media_type')
    .eq('status', 'ready')
    .eq('media_type', 'photo')
    .order('taken_at', { ascending: true })

  if (error) { console.error(error.message); return }
  console.log(`Fetching pHash for ${rows.length} photos…`)

  // Download + hash all photos in parallel pool
  const hashes = new Array(rows.length).fill(null)
  let done = 0, qi = 0

  async function worker() {
    while (qi < rows.length) {
      const idx = qi++
      const row = rows[idx]
      try {
        // Use Supabase image transform for fast small download (~5 KB vs full image)
        const thumbUrl = `${row.public_url}?width=64&height=64&resize=fill&quality=60`
        const buf = await fetchBuffer(thumbUrl)
        hashes[idx] = await pHash(buf)
        process.stdout.write('.')
      } catch (e) {
        process.stdout.write('!')
        // Fallback: try full image
        try {
          const buf = await fetchBuffer(row.public_url)
          hashes[idx] = await pHash(buf)
          process.stdout.write('+')
        } catch {
          process.stdout.write('X')
        }
      }
      done++
      if (done % 20 === 0) process.stdout.write(` ${done}/${rows.length}\n`)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`\n\nComputed ${hashes.filter(Boolean).length} hashes\n`)

  // Find duplicate groups using Union-Find
  const parent = rows.map((_, i) => i)
  function find(x) { return parent[x] === x ? x : (parent[x] = find(parent[x])) }
  function union(x, y) { parent[find(x)] = find(y) }

  let pairCount = 0
  for (let i = 0; i < rows.length; i++) {
    if (!hashes[i]) continue
    for (let j = i + 1; j < rows.length; j++) {
      if (!hashes[j]) continue
      const dist = hamming(hashes[i], hashes[j])
      if (dist < THRESHOLD) {
        union(i, j)
        pairCount++
        if (pairCount <= 20) {
          console.log(`  Match (dist=${dist}): #${i+1} ${rows[i].taken_at?.slice(0,19)} ${rows[i].file_size}B`)
          console.log(`         #${j+1} ${rows[j].taken_at?.slice(0,19)} ${rows[j].file_size}B`)
        }
      }
    }
  }

  // Collect groups
  const groups = new Map()
  for (let i = 0; i < rows.length; i++) {
    const root = find(i)
    const g = groups.get(root) ?? []; g.push(i); groups.set(root, g)
  }
  const dupeGroups = [...groups.values()].filter(g => g.length > 1)

  console.log(`\nFound ${dupeGroups.length} duplicate groups, ${dupeGroups.reduce((s,g)=>s+g.length-1,0)} photos to remove`)

  if (dupeGroups.length === 0) {
    console.log('✅  No visual duplicates found!')
    return
  }

  // For each group, keep the largest file (best quality), delete the rest
  const toDelete = []
  dupeGroups.forEach((group, gi) => {
    const sorted = group.map(i => rows[i]).sort((a, b) => (b.file_size || 0) - (a.file_size || 0))
    const keep   = sorted[0]
    const remove = sorted.slice(1)
    console.log(`\nGroup ${gi + 1}: keep ${keep.taken_at?.slice(0,10)} ${keep.file_size}B (largest)`)
    remove.forEach(r => {
      console.log(`  delete ${r.id.slice(0,8)} ${r.taken_at?.slice(0,19)} ${r.file_size}B`)
      toDelete.push(r.id)
    })
  })

  if (!DELETE) {
    console.log(`\n⚠️  Dry run — ${toDelete.length} photos would be deleted. Run with --delete to apply.`)
    return
  }

  // Delete in batches
  console.log(`\nDeleting ${toDelete.length} rows…`)
  for (let i = 0; i < toDelete.length; i += 50) {
    const batch = toDelete.slice(i, i + 50)
    const { error: delErr } = await supabase
      .from('trip_media')
      .update({ status: 'deleted' })
      .in('id', batch)
    if (delErr) console.error('Delete error:', delErr.message)
    else process.stdout.write(`deleted ${Math.min(i + 50, toDelete.length)}/${toDelete.length}\n`)
  }
  console.log('✅  Done!')
}

main().catch(e => { console.error(e); process.exit(1) })
