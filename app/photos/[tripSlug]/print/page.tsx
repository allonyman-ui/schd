'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Trip, TripMedia } from '@/lib/trip-media'
import { FAMILY_MEMBERS } from '@/lib/types'

// ── Date helpers ──────────────────────────────────────────────────

function dayKey(takenAt: string | null): string {
  return takenAt ? takenAt.slice(0, 10) : ''
}

function formatDayLabel(key: string): string {
  if (!key) return 'ללא תאריך'
  const d = new Date(key + 'T12:00:00')
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function groupByDay(items: TripMedia[]): { key: string; label: string; items: TripMedia[] }[] {
  const map = new Map<string, TripMedia[]>()
  for (const item of items) {
    const k = dayKey(item.taken_at)
    const arr = map.get(k); if (arr) arr.push(item); else map.set(k, [item])
  }
  return Array.from(map.entries()).map(([key, items]) => ({ key, label: formatDayLabel(key), items }))
}

// ── ZIP download (client-side via jszip) ──────────────────────────

async function downloadZip(items: TripMedia[], tripTitle: string, onProgress: (pct: number) => void) {
  const JSZip = (await import('jszip')).default
  const zip   = new JSZip()
  const folder = zip.folder(tripTitle ?? 'album')!

  let done = 0
  const BATCH = 4

  async function fetchOne(item: TripMedia) {
    try {
      const res  = await fetch(item.public_url)
      const blob = await res.blob()
      const ext  = item.public_url.split('.').pop()?.split('?')[0] ?? 'jpg'
      const ts   = item.taken_at ? item.taken_at.slice(0, 10) : 'no-date'
      const name = `${ts}_${item.uploader}_${item.id.slice(0, 6)}.${ext}`
      folder.file(name, blob)
    } catch { /* skip failed items */ }
    done++
    onProgress(Math.round((done / items.length) * 85))
  }

  // Pool of 4 concurrent fetches
  let i = 0
  async function worker() {
    while (i < items.length) { await fetchOne(items[i++]) }
  }
  await Promise.all(Array.from({ length: BATCH }, worker))

  onProgress(90)
  const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } })
  onProgress(98)

  const url = URL.createObjectURL(content)
  const a   = document.createElement('a')
  a.href     = url
  a.download = `${(tripTitle ?? 'album').replace(/\s+/g, '-')}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  onProgress(100)
}

// ── Component ─────────────────────────────────────────────────────

export default function PrintAlbumPage() {
  const { tripSlug } = useParams<{ tripSlug: string }>()
  const router = useRouter()

  const [trip, setTrip]       = useState<Trip | null>(null)
  const [items, setItems]     = useState<TripMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [zipPct, setZipPct]   = useState<number | null>(null)
  const [layout, setLayout]   = useState<'2' | '3' | '4'>('3')  // columns per print row
  const [onlyPhotos, setOnlyPhotos] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const tripsRes  = await fetch('/api/trips')
      const trips: Trip[] = await tripsRes.json()
      const found = trips.find(t => t.slug === tripSlug)
      if (!found) { setLoading(false); return }
      setTrip(found)

      const res  = await fetch(`/api/download-album?trip_id=${found.id}&media_type=photo`)
      const data = await res.json()
      setItems(data.items ?? [])
      setLoading(false)
    }
    load()
  }, [tripSlug])

  const photos = onlyPhotos ? items.filter(i => i.media_type === 'photo') : items
  const groups = groupByDay(photos)

  const handlePrint = useCallback(() => window.print(), [])

  const handleZip = useCallback(async () => {
    if (zipPct !== null) return
    setZipPct(0)
    await downloadZip(photos, trip?.title ?? 'album', setZipPct)
    setTimeout(() => setZipPct(null), 2000)
  }, [photos, trip, zipPct])

  const colsClass = layout === '2' ? 'grid-cols-2' : layout === '3' ? 'grid-cols-3' : 'grid-cols-4'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {/* ── Screen-only toolbar ── */}
      <div
        className="print:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 flex-wrap"
        style={{ background: 'rgba(5,14,30,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Back */}
        <button
          onClick={() => router.push(`/photos/${tripSlug}`)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white shrink-0"
        >
          ‹
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-white font-black text-sm truncate">{trip?.title ?? '...'} · {photos.length} תמונות</h1>
          <p className="text-white/40 text-xs">אלבום להדפסה</p>
        </div>

        {/* Layout selector */}
        <div className="flex gap-1 shrink-0">
          {(['2','3','4'] as const).map(c => (
            <button
              key={c}
              onClick={() => setLayout(c)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
              style={layout === c ? { background: '#2563eb', color: '#fff' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
            >
              {c}×
            </button>
          ))}
        </div>

        {/* Print */}
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shrink-0"
          style={{ background: '#2563eb', color: '#fff' }}
        >
          🖨️ הדפס / שמור PDF
        </button>

        {/* ZIP download */}
        <button
          onClick={handleZip}
          disabled={zipPct !== null}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shrink-0 disabled:opacity-60 transition-all"
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
        >
          {zipPct !== null ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              {zipPct < 100 ? `${zipPct}%` : '✓'}
            </>
          ) : (
            <>📦 הורד ZIP ({photos.length})</>
          )}
        </button>
      </div>

      {/* ── ZIP progress bar ── */}
      {zipPct !== null && zipPct < 100 && (
        <div className="print:hidden fixed bottom-0 left-0 right-0 z-50 px-4 py-3"
          style={{ background: 'rgba(5,14,30,0.95)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-white text-sm font-bold">📦 יוצר ZIP...</span>
            <span className="text-white/50 text-xs ml-auto">{zipPct}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full transition-all duration-200" style={{ width: `${zipPct}%` }} />
          </div>
          <p className="text-white/30 text-xs mt-1">מוריד {photos.length} תמונות לקובץ ZIP — ייתכן שיקח כמה דקות</p>
        </div>
      )}

      {/* ── Print stylesheet ── */}
      <style>{`
        @media print {
          @page { margin: 10mm; size: A4 portrait; }
          body { background: white !important; }
          .print-page-break { page-break-before: always; }
          .print-day-header { page-break-after: avoid; }
        }
      `}</style>

      {/* ── Album content ── */}
      <div
        ref={printRef}
        className="min-h-screen p-4 md:p-8"
        style={{ background: 'white', color: '#1a1a1a' }}
        dir="rtl"
      >
        {/* Album title */}
        <div className="text-center mb-8 print-day-header">
          <h1 className="text-3xl font-black" style={{ color: '#1a1a1a' }}>{trip?.title ?? 'האלבום שלנו'}</h1>
          <p className="text-gray-400 text-sm mt-1">{photos.length} תמונות</p>
        </div>

        {groups.map((group, gi) => (
          <div key={group.key || 'no-date'} className={gi > 0 ? 'mt-8' : ''}>
            {/* Day header */}
            <div className="flex items-center gap-3 mb-3 print-day-header">
              <h2 className="font-black text-lg" style={{ color: '#111' }}>{group.label}</h2>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-sm shrink-0">{group.items.length} תמונות</span>
            </div>

            {/* Location */}
            {group.items[0]?.location_name && (
              <p className="text-gray-400 text-sm mb-3 flex items-center gap-1 print-day-header">
                <span>📍</span>
                <span>{group.items[0].location_name}</span>
              </p>
            )}

            {/* Photo grid */}
            <div className={`grid ${colsClass} gap-2`}>
              {group.items.map(item => {
                const member  = FAMILY_MEMBERS.find(m => m.name === item.uploader)
                const timeStr = item.taken_at
                  ? new Date(item.taken_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                  : null

                return (
                  <div key={item.id} className="flex flex-col gap-1" style={{ breakInside: 'avoid' }}>
                    <img
                      src={item.public_url}
                      alt={item.caption ?? ''}
                      className="w-full object-cover rounded"
                      style={{ aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : '4/3', maxHeight: '200px' }}
                      loading="eager"
                    />
                    <div className="flex items-center justify-between text-gray-400" style={{ fontSize: '9px' }}>
                      {timeStr && <span>{timeStr}</span>}
                      {member  && <span>{member.hebrewName}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="mt-12 text-center text-gray-300 text-xs print-day-header">
          allony.com · {new Date().getFullYear()}
        </div>
      </div>
    </>
  )
}
