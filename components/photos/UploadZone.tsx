'use client'

import { useCallback, useRef, useState } from 'react'
import type { Trip } from '@/lib/trip-media'
import { FAMILY_MEMBERS } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────
type ItemStatus = 'pending' | 'preparing' | 'uploading' | 'done' | 'duplicate' | 'error'

interface UploadItem {
  id: string
  file: File
  status: ItemStatus
  progress: number   // 0-100
  error?: string
}

interface PreparedMeta {
  fileHash: string
  takenAt?: string
  latitude?: number
  longitude?: number
  locationName?: string
}

interface Props {
  trip: Trip
  onUploaded?: () => void
}

// ── Constants ──────────────────────────────────────────────────────
const CONCURRENCY_PREPARE = 4   // parallel hash+EXIF workers
const CONCURRENCY_UPLOAD  = 6   // parallel upload workers
const XHR_TIMEOUT_MS      = 180_000  // 3 min per file (large videos)

const MEMBER_COLORS: Record<string, string> = {
  alex:  '#1d4ed8',
  itan:  '#15803d',
  ami:   '#be123c',
  danil: '#7c3aed',
  assaf: '#b45309',
}

const MIME_FALLBACK: Record<string, string> = {
  jpg:  'image/jpeg', jpeg: 'image/jpeg', png:  'image/png',
  gif:  'image/gif',  webp: 'image/webp', heic: 'image/heic',
  heif: 'image/heif', mp4:  'video/mp4',  mov:  'video/quicktime',
  avi:  'video/x-msvideo', mkv: 'video/x-matroska',
  webm: 'video/webm', m4v:  'video/mp4',
}

function getMimeType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_FALLBACK[ext] ?? 'application/octet-stream'
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function formatETA(remainingSec: number): string {
  if (remainingSec < 60) return `${Math.round(remainingSec)}ש׳`
  const m = Math.floor(remainingSec / 60)
  const s = Math.round(remainingSec % 60)
  return `${m}:${s.toString().padStart(2, '0')} דק׳`
}

// ── Component ──────────────────────────────────────────────────────
export default function UploadZone({ trip, onUploaded }: Props) {
  const [uploader, setUploader]       = useState<string | null>(null)
  const [items, setItems]             = useState<UploadItem[]>([])
  const [isRunning, setIsRunning]     = useState(false)
  const [dupCount, setDupCount]       = useState(0)
  const [startTime, setStartTime]     = useState<number | null>(null)
  const [completedCount, setCompleted] = useState(0)
  const [dedupReport, setDedupReport] = useState<{
    skippedByHash: number
    removedFromDb: number
  } | null>(null)

  const galleryInputId = useRef(`gallery-${uid()}`)
  const cameraInputId  = useRef(`camera-${uid()}`)

  // Ref-map: mirrors state for reads inside async closures
  const itemsRef       = useRef<Map<string, UploadItem>>(new Map())
  // Fingerprint dedup: "name:size:lastModified"
  const fingerprintRef = useRef<Set<string>>(new Set())
  // Pre-computed EXIF+hash results, populated by background prepare workers
  const preparedRef    = useRef<Map<string, PreparedMeta>>(new Map())
  // In-progress prepare promises (by item id)
  const preparingRef   = useRef<Map<string, Promise<void>>>(new Map())

  // Geocode cache: keyed on "lat.2dec,lon.2dec" → Promise<name|null>
  // Shared across all workers so same location is never fetched twice
  const geocacheRef    = useRef<Map<string, Promise<string | null>>>(new Map())

  function updateItem(id: string, patch: Partial<UploadItem>) {
    itemsRef.current.set(id, { ...itemsRef.current.get(id)!, ...patch })
    setItems(Array.from(itemsRef.current.values()))
  }

  function fingerprint(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`
  }

  // ── Geocode with dedup cache ───────────────────────────────────────
  // zoom=10 gives city-level precision (avoids sub-district names like "1η Κοινότητα Αθηνών")
  // City-first strategy: prefer city/town over sub-district for readability
  function geocode(lat: number, lon: number): Promise<string | null> {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
    if (!geocacheRef.current.has(key)) {
      geocacheRef.current.set(key, (async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=he&zoom=10`,
            { headers: { 'User-Agent': 'allony-family-app/1.0' } }
          )
          if (!res.ok) return null
          const d = await res.json()
          const a = d.address ?? {}
          // Always prefer city/town (most recognisable), fall back to county/country
          const city    = a.city ?? a.town ?? a.village ?? a.municipality ?? ''
          const country = a.country ?? ''
          if (city && country) return `${city}, ${country}`
          if (city) return city
          return a.county ?? a.state ?? country ?? null
        } catch { return null }
      })())
    }
    return geocacheRef.current.get(key)!
  }

  // ── Hash a file (first+last 2 MB for speed on large videos) ───────
  async function hashFile(file: File): Promise<string> {
    const CHUNK = 2 * 1024 * 1024
    let buf: ArrayBuffer
    if (file.size <= CHUNK * 2) {
      buf = await file.arrayBuffer()
    } else {
      const head = await file.slice(0, CHUNK).arrayBuffer()
      const tail = await file.slice(file.size - CHUNK).arrayBuffer()
      const merged = new Uint8Array(head.byteLength + tail.byteLength)
      merged.set(new Uint8Array(head), 0)
      merged.set(new Uint8Array(tail), head.byteLength)
      buf = merged.buffer
    }
    const digest = await crypto.subtle.digest('SHA-256', buf)
    const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
    return `${hex}-${file.size}`
  }

  // ── Prepare one item: hash + EXIF (runs in background) ───────────
  async function prepareOne(item: UploadItem): Promise<void> {
    try {
      const [fileHash, exifMeta] = await Promise.all([
        hashFile(item.file),
        (async () => {
          try {
            const exifr = (await import('exifr')).default
            return await exifr.parse(item.file, {
              tiff: true, xmp: true, icc: false, iptc: true,
              reviveValues: true, translateValues: true, mergeOutput: true,
            })
          } catch { return null }
        })(),
      ])

      const meta: PreparedMeta = { fileHash }

      if (exifMeta) {
        // Date candidates in priority order
        for (const field of ['DateTimeOriginal','CreateDate','DateTime','DateCreated','TrackCreateDate','MediaCreateDate']) {
          const v = exifMeta[field]
          if (v instanceof Date && !isNaN(v.getTime())) { meta.takenAt = v.toISOString(); break }
        }
        // GPS
        const lat = exifMeta.latitude ?? exifMeta.GPSLatitude
        const lon = exifMeta.longitude ?? exifMeta.GPSLongitude
        if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
          meta.latitude  = lat
          meta.longitude = lon
          // Kick off geocoding immediately (shared cache, won't re-fetch for same location)
          geocode(lat, lon).then(name => {
            if (name) {
              const existing = preparedRef.current.get(item.id)
              if (existing) preparedRef.current.set(item.id, { ...existing, locationName: name })
            }
          })
        }
      }

      preparedRef.current.set(item.id, meta)
    } catch {
      // Prepare failed — uploadOne will compute inline as fallback
    }
  }

  // ── Launch background prepare workers for new items ───────────────
  function runPreparePool(itemIds: string[]) {
    let pi = 0
    async function prepWorker() {
      while (pi < itemIds.length) {
        const id = itemIds[pi++]
        const item = itemsRef.current.get(id)
        if (!item || preparedRef.current.has(id) || preparingRef.current.has(id)) continue
        const p = prepareOne(item)
        preparingRef.current.set(id, p)
        await p
      }
    }
    Promise.all(Array.from({ length: CONCURRENCY_PREPARE }, prepWorker))
  }

  // ── Add files ─────────────────────────────────────────────────────
  function addFiles(files: FileList | null) {
    if (!files || !files.length) return
    let skipped = 0
    const newItems: UploadItem[] = []

    Array.from(files).forEach(file => {
      const fp = fingerprint(file)
      if (fingerprintRef.current.has(fp)) { skipped++; return }
      fingerprintRef.current.add(fp)
      newItems.push({ id: uid(), file, status: 'pending', progress: 0 })
    })

    if (skipped > 0) setDupCount(prev => prev + skipped)

    newItems.forEach(it => itemsRef.current.set(it.id, it))
    setItems(Array.from(itemsRef.current.values()))

    // Kick off background preparation immediately
    runPreparePool(newItems.map(it => it.id))
  }

  // ── Upload one file ───────────────────────────────────────────────
  async function uploadOne(item: UploadItem, uploaderName: string): Promise<'done' | 'duplicate' | 'error'> {
    updateItem(item.id, { status: 'uploading', progress: 5 })
    const file     = item.file
    const mimeType = getMimeType(file)

    try {
      // Wait for background prepare if still in progress (usually already done)
      const prepPromise = preparingRef.current.get(item.id)
      if (prepPromise) await prepPromise

      // Use pre-computed data if available, else compute inline
      let prepared = preparedRef.current.get(item.id)
      if (!prepared) {
        updateItem(item.id, { progress: 10 })
        const fileHash = await hashFile(file)
        prepared = { fileHash }

        try {
          const exifr = (await import('exifr')).default
          const exif  = await exifr.parse(file, {
            tiff: true, xmp: true, icc: false, iptc: true,
            reviveValues: true, translateValues: true, mergeOutput: true,
          })
          if (exif) {
            for (const f of ['DateTimeOriginal','CreateDate','DateTime','DateCreated','TrackCreateDate','MediaCreateDate']) {
              const v = exif[f]
              if (v instanceof Date && !isNaN(v.getTime())) { prepared.takenAt = v.toISOString(); break }
            }
            const lat = exif.latitude ?? exif.GPSLatitude
            const lon = exif.longitude ?? exif.GPSLongitude
            if (lat != null && lon != null) {
              prepared.latitude  = lat
              prepared.longitude = lon
              prepared.locationName = (await geocode(lat, lon)) ?? undefined
            }
          }
        } catch { /* metadata optional */ }

        preparedRef.current.set(item.id, prepared)
      }

      updateItem(item.id, { progress: 20 })

      const { fileHash, takenAt, latitude, longitude, locationName } = prepared

      // Presign
      const presignRes = await fetchWithTimeout('/api/upload-media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id:           trip.id,
          trip_slug:         trip.slug,
          uploader:          uploaderName,
          filename:          file.name,
          original_filename: file.name,   // original device filename — key iOS HEIC dedup signal
          content_type:      mimeType,
          file_size:         file.size,
          file_hash:         fileHash,
          taken_at:          takenAt,
          latitude,
          longitude,
          location_name:     locationName,
        }),
      }, 30_000)

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error(err.error ?? `Presign ${presignRes.status}`)
      }

      const presignData = await presignRes.json()
      if (presignData.duplicate) {
        updateItem(item.id, { status: 'duplicate', progress: 100 })
        return 'duplicate'
      }

      const { signed_url, media_id } = presignData

      // PUT directly to Supabase with live progress (20→95%)
      await xhrUpload(signed_url, file, mimeType, (pct) => {
        updateItem(item.id, { progress: 20 + Math.round(pct * 0.75) })
      })

      // Confirm
      const confirmRes = await fetchWithTimeout('/api/upload-media/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id }),
      }, 15_000)
      if (!confirmRes.ok) throw new Error(`Confirm ${confirmRes.status}`)

      updateItem(item.id, { status: 'done', progress: 100 })
      return 'done'
    } catch (e: unknown) {
      updateItem(item.id, { status: 'error', error: (e as Error).message })
      return 'error'
    }
  }

  // ── Start all uploads ─────────────────────────────────────────────
  const startUpload = useCallback(async () => {
    if (!uploader || isRunning) return
    setIsRunning(true)
    setCompleted(0)
    setDedupReport(null)
    setStartTime(Date.now())

    const queue = Array.from(itemsRef.current.values())
      .filter(it => it.status === 'pending' || it.status === 'error')
      .map(it => it.id)

    // Reset errors → pending
    queue.forEach(id => {
      const it = itemsRef.current.get(id)!
      if (it.status === 'error') updateItem(id, { status: 'pending', progress: 0, error: undefined })
    })

    let skippedByHash = 0
    let qi = 0

    async function worker() {
      while (qi < queue.length) {
        const id   = queue[qi++]
        const item = itemsRef.current.get(id)
        if (!item || item.status === 'done' || item.status === 'duplicate') continue
        const result = await uploadOne(item, uploader!)
        if (result === 'duplicate') skippedByHash++
        setCompleted(c => c + 1)
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY_UPLOAD }, worker))

    // Post-batch DB dedup scan
    let removedFromDb = 0
    try {
      const r = await fetch('/api/dedup-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: trip.id }),
      })
      if (r.ok) { const d = await r.json(); removedFromDb = d.removed ?? 0 }
    } catch { /* best-effort */ }

    setIsRunning(false)
    setStartTime(null)

    if (skippedByHash > 0 || removedFromDb > 0) {
      setDedupReport({ skippedByHash, removedFromDb })
    }

    const finalItems = Array.from(itemsRef.current.values())
    if (finalItems.some(it => it.status === 'error')) { /* errors visible in list */ }
    const uploaded = finalItems.filter(it => it.status === 'done').length
    if (uploaded > 0) onUploaded?.()
  }, [uploader, isRunning, trip, onUploaded])

  function removeItem(id: string) {
    const it = itemsRef.current.get(id)
    if (it) fingerprintRef.current.delete(fingerprint(it.file))
    itemsRef.current.delete(id)
    preparedRef.current.delete(id)
    setItems(Array.from(itemsRef.current.values()))
  }

  function clearDone() {
    Array.from(itemsRef.current.entries()).forEach(([id, it]) => {
      if (it.status === 'done' || it.status === 'duplicate') {
        fingerprintRef.current.delete(fingerprint(it.file))
        itemsRef.current.delete(id)
        preparedRef.current.delete(id)
      }
    })
    setItems(Array.from(itemsRef.current.values()))
  }

  // ── Derived stats ─────────────────────────────────────────────────
  const total      = items.length
  const pending    = items.filter(it => it.status === 'pending' || it.status === 'preparing').length
  const uploading  = items.filter(it => it.status === 'uploading').length
  const done       = items.filter(it => it.status === 'done').length
  const duplicates = items.filter(it => it.status === 'duplicate').length
  const errors     = items.filter(it => it.status === 'error').length
  const finishedCount = done + duplicates

  const overallPct = total ? Math.round(
    items.reduce((s, it) => s + (['done','duplicate'].includes(it.status) ? 100 : it.progress), 0) / total
  ) : 0

  // ETA calculation
  const eta = (() => {
    if (!isRunning || !startTime || finishedCount < 2) return null
    const elapsed = (Date.now() - startTime) / 1000
    const rate    = finishedCount / elapsed     // files per second
    const remain  = (total - finishedCount) / rate
    return remain > 3 ? formatETA(remain) : null
  })()

  const canUpload   = !isRunning && !!uploader && (pending + errors) > 0
  const allFinished = total > 0 && finishedCount === total && errors === 0

  // Show only active (uploading/error) items to avoid huge DOM
  const visibleItems = items.filter(it => it.status === 'uploading' || it.status === 'error').slice(0, 12)

  return (
    <div className="flex flex-col gap-5">
      {/* ── Person selector ── */}
      <div>
        <p className="text-white/60 text-sm mb-2 text-right">מי אתה/את?</p>
        <div className="flex flex-wrap gap-2">
          {FAMILY_MEMBERS.map(m => (
            <button
              key={m.name}
              onClick={() => setUploader(m.name)}
              disabled={isRunning}
              className="flex-1 min-w-[72px] py-3 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-50"
              style={
                uploader === m.name
                  ? { background: MEMBER_COLORS[m.name], color: '#fff', boxShadow: `0 0 20px ${MEMBER_COLORS[m.name]}80` }
                  : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }
              }
            >
              {m.hebrewName}
            </button>
          ))}
        </div>
      </div>

      {/* ── File picker buttons ──
           Use <label> → <input> directly — iOS Safari blocks JS .click()
           on display:none inputs. Labels work natively on all browsers.    */}
      <div className="flex gap-3">
        <label
          htmlFor={galleryInputId.current}
          className="flex-1 py-5 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all active:scale-95 cursor-pointer select-none"
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
        >
          <span className="text-3xl">🖼️</span>
          <span>גלריה</span>
          <span className="text-white/40 text-xs">בחר עד 200 קבצים</span>
        </label>
        <label
          htmlFor={cameraInputId.current}
          className="flex-1 py-5 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all active:scale-95 cursor-pointer select-none"
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
        >
          <span className="text-3xl">📷</span>
          <span>מצלמה</span>
          <span className="text-white/40 text-xs">צלם עכשיו</span>
        </label>
      </div>

      {/* Inputs: visually hidden but NOT display:none — iOS requires this */}
      <input
        id={galleryInputId.current}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, overflow: 'hidden' }}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        id={cameraInputId.current}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, overflow: 'hidden' }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* ── Tips for large batches ── */}
      {total === 0 && (
        <div className="text-center text-white/25 text-xs leading-relaxed px-2">
          ניתן לבחור עד 200 תמונות וסרטונים בבת אחת
          <br />מעלה 6 קבצים במקביל • מזהה כפילויות אוטומטית
        </div>
      )}

      {/* ── Client-side fingerprint dupe notice ── */}
      {dupCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
          <span>⚠️</span>
          <span>{dupCount} {dupCount === 1 ? 'קובץ כפול זוהה' : 'קבצים כפולים זוהו'} והוסרו מהרשימה</span>
          <button onClick={() => setDupCount(0)} className="mr-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Post-upload dedup report ── */}
      {dedupReport && (dedupReport.skippedByHash > 0 || dedupReport.removedFromDb > 0) && (
        <div className="rounded-2xl p-4 flex flex-col gap-2 text-sm" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="flex items-center justify-between">
            <span className="text-yellow-300 font-bold">דוח כפילויות</span>
            <button onClick={() => setDedupReport(null)} className="text-white/30 hover:text-white/60 text-xs">✕</button>
          </div>
          {dedupReport.skippedByHash > 0 && (
            <div className="flex items-center gap-2 text-yellow-200/80">
              <span>⏭️</span>
              <span><strong>{dedupReport.skippedByHash}</strong> {dedupReport.skippedByHash === 1 ? 'קובץ' : 'קבצים'} כבר קיימים — לא הועלו שוב</span>
            </div>
          )}
          {dedupReport.removedFromDb > 0 && (
            <div className="flex items-center gap-2 text-yellow-200/80">
              <span>🗑️</span>
              <span><strong>{dedupReport.removedFromDb}</strong> {dedupReport.removedFromDb === 1 ? 'כפיל נמצא ונמחק' : 'כפילויות נמצאו ונמחקו'} מהאלבום</span>
            </div>
          )}
        </div>
      )}

      {/* ── Queue summary ── */}
      {total > 0 && (
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {/* Counts + ETA row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-3 text-white/60 flex-wrap">
              {(pending + uploading) > 0 && <span>⏳ {pending + uploading}</span>}
              {done        > 0 && <span className="text-green-400">✅ {done}</span>}
              {duplicates  > 0 && <span className="text-yellow-400">⚠️ {duplicates}</span>}
              {errors      > 0 && <span className="text-red-400">❌ {errors}</span>}
              {eta && <span className="text-white/40 text-xs">~{eta}</span>}
            </div>
            <span className="text-white font-bold shrink-0 ml-2">
              {isRunning ? `${finishedCount}/${total}` : `${total} קבצים`}
            </span>
          </div>

          {/* Overall progress bar */}
          {isRunning && (
            <div>
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-white/30 text-xs">
                <span>{overallPct}%</span>
                <span>{CONCURRENCY_UPLOAD} העלאות במקביל</span>
              </div>
            </div>
          )}

          {/* Active uploads */}
          {visibleItems.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {visibleItems.map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-xs truncate">{item.file.name}</p>
                    {item.status === 'uploading' && (
                      <div className="mt-0.5 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                    {item.status === 'error' && (
                      <p className="text-red-400 text-xs mt-0.5 truncate">{item.error}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm">
                    {item.status === 'uploading' && <span className="text-white/50 text-xs">{item.progress}%</span>}
                    {item.status === 'error' && (
                      <button onClick={() => removeItem(item.id)} className="text-white/30 hover:text-white/60 text-xs">✕</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Clear done */}
          {finishedCount > 0 && !isRunning && (
            <button onClick={clearDone} className="text-xs text-white/30 hover:text-white/60 transition text-left">
              נקה {finishedCount} שהסתיימו ✓
            </button>
          )}
        </div>
      )}

      {/* ── Upload button ── */}
      {!allFinished && (
        <button
          onClick={startUpload}
          disabled={!canUpload}
          className="w-full py-4 rounded-2xl font-black text-base transition-all active:scale-[0.97] disabled:opacity-40"
          style={{ background: canUpload ? '#2563eb' : 'rgba(255,255,255,0.1)', color: '#fff' }}
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              מעלה... {finishedCount}/{total} ({overallPct}%)
            </span>
          ) : errors > 0 ? (
            `נסה שוב ${errors} שנכשלו`
          ) : (
            `העלה ${pending} קובץ${pending !== 1 ? 'ים' : ''}`
          )}
        </button>
      )}

      {/* ── All done ── */}
      {allFinished && (
        <div className="text-center py-5 rounded-2xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-white font-black text-lg">סיום!</p>
          {done > 0 && <p className="text-green-400 text-sm mt-1">✅ {done} {done === 1 ? 'קובץ' : 'קבצים'} הועלו לאלבום</p>}
          {duplicates > 0 && <p className="text-yellow-400 text-sm mt-0.5">⚠️ {duplicates} כבר קיימים — לא הועלו שוב</p>}
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

function xhrUpload(
  url: string, file: File, mimeType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.timeout = XHR_TIMEOUT_MS
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload    = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error(`Upload failed: ${xhr.status}`)) }
    xhr.onerror   = () => reject(new Error('Network error'))
    xhr.ontimeout = () => reject(new Error('Timeout'))
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', mimeType)
    xhr.send(file)
  })
}
