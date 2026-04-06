import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic  = 'force-dynamic'
export const maxDuration = 60   // pHash needs time for large galleries

const HASH_SIZE  = 16    // 16×16 pixels
const THRESHOLD  = 20    // Hamming distance < 20/256 — catches HEIC→JPEG re-encodings
                         // (same image, different compression = typically 3–15 bit diff)
                         // Different images are almost always 40+ bits apart

// ── Perceptual hash helpers ────────────────────────────────────────────────

async function pHash(url: string): Promise<Buffer | null> {
  try {
    // Use Supabase image transform — download a tiny 64×64 thumbnail
    // instead of the full multi-MB file to keep this fast
    const thumbUrl = `${url}?width=64&height=64&resize=fill&quality=60`
    const res = await fetch(thumbUrl, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())

    // Dynamically import sharp (Node.js only, not available on edge)
    const sharp = (await import('sharp')).default
    const pixels = await sharp(buf)
      .resize(HASH_SIZE, HASH_SIZE, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer()

    const avg  = pixels.reduce((s, v) => s + v, 0) / pixels.length
    const bits = Buffer.alloc(Math.ceil(pixels.length / 8), 0)
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] > avg) bits[Math.floor(i / 8)] |= (1 << (i % 8))
    }
    return bits
  } catch {
    return null
  }
}

function hamming(a: Buffer, b: Buffer): number {
  let dist = 0
  for (let i = 0; i < a.length; i++) {
    let x = a[i] ^ b[i]
    while (x) { dist += x & 1; x >>= 1 }
  }
  return dist
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { trip_id } = await request.json()
    if (!trip_id) return NextResponse.json({ error: 'trip_id required' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: rows, error } = await supabase
      .from('trip_media')
      .select('id, file_size, taken_at, public_url')
      .eq('trip_id', trip_id)
      .eq('status', 'ready')
      .eq('media_type', 'photo')
      .order('taken_at', { ascending: true })

    if (error) throw error
    if (!rows?.length) return NextResponse.json({ removed: 0, scanned: 0 })

    const photos = rows  // narrowed: non-null, non-empty

    // Compute pHashes for all photos (in parallel, capped at 8 concurrent)
    const hashes: (Buffer | null)[] = new Array(photos.length).fill(null)
    const CAP = 8
    let qi = 0
    async function worker() {
      while (qi < photos.length) {
        const i = qi++
        hashes[i] = await pHash(photos[i].public_url)
      }
    }
    await Promise.all(Array.from({ length: CAP }, worker))

    // Union-Find to group visually identical photos
    const parent = photos.map((_, i) => i)
    function find(x: number): number { return parent[x] === x ? x : (parent[x] = find(parent[x])) }
    function union(x: number, y: number) { parent[find(x)] = find(y) }

    for (let i = 0; i < photos.length; i++) {
      if (!hashes[i]) continue
      for (let j = i + 1; j < photos.length; j++) {
        if (!hashes[j]) continue
        if (hamming(hashes[i] as Buffer, hashes[j] as Buffer) < THRESHOLD) {
          union(i, j)
        }
      }
    }

    // Collect groups, keep largest file per group
    const groups = new Map<number, number[]>()
    for (let i = 0; i < photos.length; i++) {
      const root = find(i)
      const g = groups.get(root) ?? []; g.push(i); groups.set(root, g)
    }

    const toDelete: string[] = []
    for (const group of groups.values()) {
      if (group.length < 2) continue
      const sorted = group.sort((a, b) => (photos[b].file_size ?? 0) - (photos[a].file_size ?? 0))
      sorted.slice(1).forEach(i => toDelete.push(photos[i].id))
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ removed: 0, scanned: photos.length })
    }

    // Delete in batches
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100)
      await supabase.from('trip_media').update({ status: 'deleted' }).in('id', batch)
    }

    return NextResponse.json({ removed: toDelete.length, scanned: photos.length })
  } catch (e: unknown) {
    console.error('[dedup-visual]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
