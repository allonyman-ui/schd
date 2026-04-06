/**
 * Deep duplicate diagnostic — shows exactly WHY dupes slip through.
 *
 * Usage: /usr/local/bin/node scripts/diagnose-dupes.cjs
 */
const { createClient } = require('../node_modules/@supabase/supabase-js/dist/index.cjs')

const SUPABASE_URL = 'https://iqsnpllfopcgbvmyouuz.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxc25wbGxmb3BjZ2J2bXlvdXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ5MTM2MSwiZXhwIjoyMDg5MDY3MzYxfQ.AH9d6TJFrQtG6I41k6WdTZgRHVguXZdGv06KAIXQVwc'
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  // Fetch ALL rows including deleted
  const { data: all, error } = await supabase
    .from('trip_media')
    .select('id, file_hash, file_size, storage_path, taken_at, created_at, status, uploader, mime_type')
    .order('created_at', { ascending: true })

  if (error) { console.error(error.message); return }

  const ready   = all.filter(r => r.status === 'ready')
  const pending = all.filter(r => r.status === 'pending')
  const deleted = all.filter(r => r.status === 'deleted')

  console.log(`Total rows: ${all.length}  (ready:${ready.length}  pending:${pending.length}  deleted:${deleted.length})`)
  console.log(`file_hash populated (ready): ${ready.filter(r=>r.file_hash).length}/${ready.length}`)
  console.log(`file_size populated (ready): ${ready.filter(r=>r.file_size).length}/${ready.length}`)

  // ── Find ready dupes by every strategy ───────────────────────────

  console.log('\n=== READY rows duplicate check ===')

  // 1. Hash
  const byHash = new Map()
  for (const r of ready) {
    if (!r.file_hash) continue
    const g = byHash.get(r.file_hash) ?? []; g.push(r); byHash.set(r.file_hash, g)
  }
  const hashGroups = [...byHash.values()].filter(g => g.length > 1)
  console.log(`  By hash:         ${hashGroups.reduce((s,g)=>s+g.length-1,0)} dupes in ${hashGroups.length} groups`)

  // 2. file_size + taken_at (second)
  const bySizeTs = new Map()
  for (const r of ready) {
    if (!r.file_size || !r.taken_at) continue
    const key = `${r.file_size}::${r.taken_at.slice(0,19)}`
    const g = bySizeTs.get(key) ?? []; g.push(r); bySizeTs.set(key, g)
  }
  const sizeTsGroups = [...bySizeTs.values()].filter(g => g.length > 1)
  console.log(`  By size+second:  ${sizeTsGroups.reduce((s,g)=>s+g.length-1,0)} dupes in ${sizeTsGroups.length} groups`)

  // 3. file_size + taken_at (day)
  const bySizeDay = new Map()
  for (const r of ready) {
    if (!r.file_size || !r.taken_at || r.file_size < 50000) continue
    const key = `${r.file_size}::${r.taken_at.slice(0,10)}`
    const g = bySizeDay.get(key) ?? []; g.push(r); bySizeDay.set(key, g)
  }
  const sizeDayGroups = [...bySizeDay.values()].filter(g => g.length > 1)
  console.log(`  By size+day:     ${sizeDayGroups.reduce((s,g)=>s+g.length-1,0)} dupes in ${sizeDayGroups.length} groups`)

  // 4. file_size alone (high confidence for >5MB files)
  const bySizeOnly = new Map()
  for (const r of ready) {
    if (!r.file_size || r.file_size < 5_000_000) continue
    const g = bySizeOnly.get(r.file_size) ?? []; g.push(r); bySizeOnly.set(r.file_size, g)
  }
  const sizeOnlyGroups = [...bySizeOnly.values()].filter(g => g.length > 1)
  console.log(`  By size only (>5MB): ${sizeOnlyGroups.reduce((s,g)=>s+g.length-1,0)} dupes in ${sizeOnlyGroups.length} groups`)

  // 5. created_at timestamp proximity (same second = concurrent upload race)
  const byCreatedSecond = new Map()
  for (const r of ready) {
    const key = `${r.uploader}::${r.created_at.slice(0,19)}`
    const g = byCreatedSecond.get(key) ?? []; g.push(r); byCreatedSecond.set(key, g)
  }
  const createdGroups = [...byCreatedSecond.values()].filter(g => g.length > 1)
  console.log(`  By uploader+created_second: ${createdGroups.reduce((s,g)=>s+g.length-1,0)} dupes in ${createdGroups.length} groups`)

  // ── Show sample dupe groups ───────────────────────────────────────
  const allDupeGroups = [...hashGroups, ...sizeDayGroups, ...sizeOnlyGroups]
  if (allDupeGroups.length === 0) {
    console.log('\n✅ No duplicates found in ready rows right now.')
    console.log('Dupes may be appearing only DURING uploads (race condition).')
    console.log('→ The fix is a DB-level unique constraint (see below).')
  } else {
    console.log(`\n=== Sample dupe groups ===`)
    allDupeGroups.slice(0, 8).forEach((g, i) => {
      console.log(`\nGroup ${i+1} — ${g.length} copies:`)
      g.forEach(r => console.log(
        `  [${r.status}] id:${r.id.slice(0,8)} hash:${(r.file_hash??'NULL').slice(0,10)} ` +
        `size:${r.file_size} taken:${(r.taken_at??'').slice(0,19)} ` +
        `created:${r.created_at.slice(0,19)} by:${r.uploader}`
      ))
    })
  }

  // ── Check if unique index exists ──────────────────────────────────
  console.log('\n=== DB constraint check ===')
  const { data: indexes, error: idxErr } = await supabase.rpc('pg_indexes_check').catch(() => ({ data: null, error: 'rpc not available' }))
  // Try a simulated race: insert two rows with same hash and see which one wins
  console.log('To prevent the race condition, run this SQL in Supabase Dashboard:')
  console.log()
  console.log('  CREATE UNIQUE INDEX IF NOT EXISTS trip_media_unique_hash')
  console.log('    ON trip_media (trip_id, file_hash)')
  console.log("    WHERE file_hash IS NOT NULL AND status != 'deleted';")
  console.log()
  console.log('This makes it IMPOSSIBLE for two rows with the same hash to exist,')
  console.log('even if 6 workers call presign at the exact same millisecond.')

  // ── Pending orphans ───────────────────────────────────────────────
  if (pending.length > 0) {
    console.log(`\n=== Orphaned pending rows: ${pending.length} ===`)
    console.log('These were started but never confirmed (upload failed or timed out).')
    console.log('They will block future uploads of the same files.')
    pending.forEach(r => console.log(
      `  id:${r.id.slice(0,8)} size:${r.file_size} created:${r.created_at.slice(0,19)} by:${r.uploader} path:${r.storage_path.split('/').pop()}`
    ))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
