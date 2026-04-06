'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Trip, TripMedia } from '@/lib/trip-media'
import MediaGrid from '@/components/photos/MediaGrid'
import Lightbox from '@/components/photos/Lightbox'
import PersonFilterBar from '@/components/photos/PersonFilterBar'
import { FAMILY_MEMBERS } from '@/lib/types'

const PAGE_SIZE = 30

type DedupState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; removed: number; scanned: number }
  | { status: 'error'; message: string }

export default function TripGalleryPage() {
  const { tripSlug } = useParams<{ tripSlug: string }>()
  const router = useRouter()

  const [trip,         setTrip]         = useState<Trip | null>(null)
  const [items,        setItems]         = useState<TripMedia[]>([])
  const [total,        setTotal]         = useState(0)
  const [page,         setPage]          = useState(1)
  const [loading,      setLoading]       = useState(true)
  const [loadingMore,  setLoadingMore]   = useState(false)
  const [uploader,     setUploader]      = useState<string | null>(null)
  const [mediaType,    setMediaType]     = useState<'all' | 'photo' | 'video'>('all')
  const [lightboxIndex,setLightboxIndex] = useState<number | null>(null)
  const [viewerName,   setViewerName]    = useState<string | null>(null)
  const [showNamePicker,setShowNamePicker] = useState(false)
  const [dedup,        setDedup]         = useState<DedupState>({ status: 'idle' })

  // ── Load trip ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/trips')
      .then(r => r.json())
      .then((trips: Trip[]) => setTrip(trips.find(t => t.slug === tripSlug) ?? null))
  }, [tripSlug])

  // ── Load media ───────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    setPage(1)
    setItems([])
    loadPage(1, uploader, mediaType)
  }, [tripSlug, uploader, mediaType])

  async function loadPage(
    p: number,
    filterUploader: string | null,
    filterMediaType: 'all' | 'photo' | 'video'
  ) {
    const tripsRes = await fetch('/api/trips')
    const trips: Trip[] = await tripsRes.json()
    const foundTrip = trips.find(t => t.slug === tripSlug)
    if (!foundTrip) { setLoading(false); return }
    if (!trip) setTrip(foundTrip)

    const params = new URLSearchParams({
      trip_id:  foundTrip.id,
      page:     String(p),
      pageSize: String(PAGE_SIZE),
    })
    if (filterUploader)              params.set('uploader',   filterUploader)
    if (filterMediaType !== 'all')   params.set('media_type', filterMediaType)

    const res  = await fetch(`/api/trip-media?${params}`)
    const data = await res.json()

    setItems(prev => {
      const merged = p === 1 ? data.items : [...prev, ...data.items]
      // Safety-net dedup: ensure the same DB row never appears twice in the UI
      // (guards against IntersectionObserver or StrictMode double-fires)
      const seen = new Set<string>()
      return merged.filter((it: TripMedia) => {
        if (seen.has(it.id)) return false
        seen.add(it.id)
        return true
      })
    })
    setTotal(data.total)
    setLoading(false)
    setLoadingMore(false)
  }

  // ── Dedup ────────────────────────────────────────────────────────
  const runDedup = useCallback(async () => {
    if (!trip || dedup.status === 'running') return
    setDedup({ status: 'running' })
    try {
      const res = await fetch('/api/dedup-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: trip.id }),
      })
      if (!res.ok) throw new Error(`שגיאה ${res.status}`)
      const { removed, scanned } = await res.json()
      setDedup({ status: 'done', removed, scanned })

      // Reload gallery if anything was removed
      if (removed > 0) {
        setLoading(true)
        setPage(1)
        setItems([])
        await loadPage(1, uploader, mediaType)
      }
    } catch (e: unknown) {
      setDedup({ status: 'error', message: (e as Error).message })
    }
  }, [trip, dedup.status, uploader, mediaType])

  // ── Load more ────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (loadingMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    setPage(nextPage)
    loadPage(nextPage, uploader, mediaType)
  }, [page, uploader, mediaType, loadingMore, tripSlug])

  // ── Reactions ────────────────────────────────────────────────────
  function handleReactionChange(mediaId: string, emoji: string) {
    setItems(prev => prev.map(item => {
      if (item.id !== mediaId) return item
      const reactions = item.reactions ?? []
      const exists = reactions.find(r => r.person === viewerName && r.emoji === emoji)
      if (exists) {
        return { ...item, reactions: reactions.filter(r => !(r.person === viewerName && r.emoji === emoji)) }
      }
      return { ...item, reactions: [...reactions, { id: Date.now().toString(), media_id: mediaId, person: viewerName!, emoji, created_at: new Date().toISOString() }] }
    }))
  }

  const hasMore = items.length < total

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#050e1e 0%,#091629 60%,#040d1a 100%)' }}>

      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-30 px-4 pt-4 pb-3"
        style={{ background: 'rgba(5,14,30,0.92)', backdropFilter: 'blur(12px)' }}
      >
        {/* Top row */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => router.push('/photos')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white shrink-0"
          >
            ‹
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-white font-black text-lg truncate">{trip?.title ?? '...'}</h1>
            <p className="text-white/40 text-xs">
              {total} {mediaType === 'photo' ? 'תמונות' : mediaType === 'video' ? 'סרטונים' : 'פריטים'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Who am I */}
            <button
              onClick={() => setShowNamePicker(s => !s)}
              className="text-xs px-3 py-1.5 rounded-full font-bold transition-all"
              style={{ background: viewerName ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              {viewerName ? FAMILY_MEMBERS.find(m => m.name === viewerName)?.hebrewName : 'מי אני?'}
            </button>

            {/* Print / download */}
            <button
              onClick={() => router.push(`/photos/${tripSlug}/print`)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white text-base"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              title="הורד / הדפס אלבום"
            >
              🖨️
            </button>

            {/* Upload */}
            <button
              onClick={() => router.push(`/photos/${tripSlug}/upload`)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white text-xl font-bold"
              style={{ background: 'rgba(37,99,235,0.6)' }}
              title="העלה תמונות"
            >
              +
            </button>
          </div>
        </div>

        {/* Name picker */}
        {showNamePicker && (
          <div className="flex flex-wrap gap-2 mb-2">
            {FAMILY_MEMBERS.map(m => (
              <button
                key={m.name}
                onClick={() => { setViewerName(m.name); setShowNamePicker(false) }}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition"
                style={
                  viewerName === m.name
                    ? { background: '#2563eb', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }
                }
              >
                {m.hebrewName}
              </button>
            ))}
          </div>
        )}

        {/* Person filter */}
        <PersonFilterBar selected={uploader} onChange={setUploader} />

        {/* Media type tabs + dedup button on same row */}
        <div className="flex items-center gap-1.5 mt-2">
          {([
            { key: 'all',   label: 'הכל',    icon: '📁' },
            { key: 'photo', label: 'תמונות', icon: '🖼️' },
            { key: 'video', label: 'וידאו',   icon: '🎬' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setMediaType(tab.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={
                mediaType === tab.key
                  ? { background: '#fff', color: '#0a0a0a' }
                  : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }
              }
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Dedup button */}
          <button
            onClick={runDedup}
            disabled={dedup.status === 'running'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-50"
            style={
              dedup.status === 'running'
                ? { background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }
                : { background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }
            }
            title="סרוק ומחק כפילויות"
          >
            {dedup.status === 'running' ? (
              <>
                <span className="w-3 h-3 border border-red-400/50 border-t-red-400 rounded-full animate-spin inline-block" />
                <span>בודק...</span>
              </>
            ) : (
              <>
                <span>🗑️</span>
                <span>כפילויות</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Dedup result banner ── */}
      {(dedup.status === 'done' || dedup.status === 'error') && (
        <div
          className="mx-4 mt-2 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm"
          style={
            dedup.status === 'error'
              ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }
              : dedup.removed > 0
                ? { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }
                : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
          }
        >
          <span className="text-lg">
            {dedup.status === 'error' ? '⚠️' : dedup.removed > 0 ? '✅' : '✓'}
          </span>
          <div className="flex-1 min-w-0">
            {dedup.status === 'error' && (
              <p className="text-red-300 font-bold">שגיאה: {dedup.message}</p>
            )}
            {dedup.status === 'done' && dedup.removed === 0 && (
              <p className="text-white/70">
                נסרקו <strong className="text-white">{dedup.scanned}</strong> קבצים — לא נמצאו כפילויות 👍
              </p>
            )}
            {dedup.status === 'done' && dedup.removed > 0 && (
              <>
                <p className="text-green-300 font-bold">
                  הוסרו <strong>{dedup.removed}</strong> כפילויות
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  נסרקו {dedup.scanned} קבצים · הגלריה עודכנה
                </p>
              </>
            )}
          </div>
          <button
            onClick={() => setDedup({ status: 'idle' })}
            className="text-white/30 hover:text-white/60 transition shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Media grid ── */}
      <div className="flex-1 px-2 pt-2 pb-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        ) : (
          <MediaGrid
            items={items}
            onItemClick={i => setLightboxIndex(i)}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            loading={loadingMore}
          />
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          initialIndex={lightboxIndex}
          viewerName={viewerName}
          onClose={() => setLightboxIndex(null)}
          onReactionChange={handleReactionChange}
          onDelete={(mediaId) => {
            setItems(prev => prev.filter(it => it.id !== mediaId))
            setTotal(prev => prev - 1)
            if (items.length <= 1) setLightboxIndex(null)
          }}
        />
      )}
    </div>
  )
}
