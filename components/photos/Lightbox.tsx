'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { TripMedia } from '@/lib/trip-media'
import { getThumbnailUrl } from '@/lib/trip-media'
import { FAMILY_MEMBERS } from '@/lib/types'

interface Props {
  items: TripMedia[]
  initialIndex: number
  viewerName: string | null
  onClose: () => void
  onReactionChange?: (mediaId: string, emoji: string) => void
  onDelete?: (mediaId: string) => void
}

const REACTION_EMOJIS = ['❤️', '😂', '😍', '🔥', '👏', '😮']

export default function Lightbox({ items, initialIndex, viewerName, onClose, onReactionChange, onDelete }: Props) {
  const [index, setIndex]               = useState(initialIndex)
  const [showReactions, setShowReactions] = useState(false)
  const [showInfo, setShowInfo]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const videoRef    = useRef<HTMLVideoElement>(null)

  const item   = items[index]
  const member = FAMILY_MEMBERS.find(m => m.name === item?.uploader)

  const prev = useCallback(() => { setShowReactions(false); setShowInfo(false); setConfirmDelete(false); setIndex(i => Math.max(0, i - 1)) }, [])
  const next = useCallback(() => { setShowReactions(false); setShowInfo(false); setConfirmDelete(false); setIndex(i => Math.min(items.length - 1, i + 1)) }, [items.length])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')  next()
      if (e.key === 'ArrowRight') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  // Pause video when navigating
  useEffect(() => { videoRef.current?.pause() }, [index])

  // Touch swipe
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current ?? 0))
    if (Math.abs(dx) > 50 && dy < 80) { if (dx < 0) next(); else prev() }
    touchStartX.current = null
  }

  async function handleReaction(emoji: string) {
    if (!viewerName || !item) return
    try {
      await fetch('/api/media-reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: item.id, person: viewerName, emoji }),
      })
      onReactionChange?.(item.id, emoji)
    } catch {}
    setShowReactions(false)
  }

  async function handleDownload() {
    if (!item) return
    const a = document.createElement('a')
    a.href = item.public_url
    a.download = item.storage_path.split('/').pop() ?? 'media'
    a.target = '_blank'
    a.click()
  }

  async function handleDelete() {
    if (!item || deleting) return
    setDeleting(true)
    try {
      await fetch(`/api/trip-media?id=${item.id}`, { method: 'DELETE' })
      onDelete?.(item.id)
      // Navigate to next item or close
      if (items.length <= 1) {
        onClose()
      } else if (index >= items.length - 1) {
        setIndex(i => Math.max(0, i - 1))
      }
    } catch {}
    setDeleting(false)
    setConfirmDelete(false)
  }

  if (!item) return null

  const myReactionEmojis = (item.reactions ?? []).filter(r => r.person === viewerName).map(r => r.emoji)
  const reactionGroups: Record<string, string[]> = {}
  for (const r of item.reactions ?? []) {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = []
    reactionGroups[r.emoji].push(r.person)
  }

  // Format date/time nicely
  const takenDate = item.taken_at ? new Date(item.taken_at) : null
  const dateStr   = takenDate?.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr   = takenDate?.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/70 backdrop-blur-sm shrink-0">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white text-lg">✕</button>

        <div className="text-center flex-1 px-2">
          {member && <div className="text-white font-bold text-sm leading-none">{member.hebrewName}</div>}
          <div className="text-white/40 text-xs mt-0.5">{index + 1} / {items.length}</div>
        </div>

        {/* Top-right actions */}
        <div className="flex items-center gap-1.5">
          {/* Info toggle */}
          <button
            onClick={() => { setShowInfo(s => !s); setShowReactions(false); setConfirmDelete(false) }}
            className="w-9 h-9 flex items-center justify-center rounded-full transition"
            style={{ background: showInfo ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: '#fff' }}
            title="מידע"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8h.01M12 12v4" />
            </svg>
          </button>
          {/* Download */}
          <button onClick={handleDownload} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white" title="הורד">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          {/* Delete */}
          <button
            onClick={() => { setConfirmDelete(s => !s); setShowInfo(false); setShowReactions(false) }}
            className="w-9 h-9 flex items-center justify-center rounded-full transition"
            style={{ background: confirmDelete ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)', color: confirmDelete ? '#fca5a5' : '#fff' }}
            title="מחק"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Info panel (slides down) ── */}
      {showInfo && (
        <div className="shrink-0 px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-white/10">
          <div className="flex flex-col gap-2 text-sm">
            {/* Date & time */}
            {dateStr && (
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-base">📅</span>
                <span>{dateStr}{timeStr ? ` · ${timeStr}` : ''}</span>
              </div>
            )}
            {/* Location */}
            {item.location_name && (
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-base">📍</span>
                <span>{item.location_name}</span>
              </div>
            )}
            {/* GPS coordinates */}
            {item.latitude != null && item.longitude != null && (
              <a
                href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-blue-400 text-xs"
              >
                <span>🗺️</span>
                <span>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)} — פתח במפות</span>
              </a>
            )}
            {/* Uploader */}
            {member && (
              <div className="flex items-center gap-2 text-white/60">
                <span className="text-base">👤</span>
                <span>הועלה על ידי {member.hebrewName}</span>
              </div>
            )}
            {/* File size */}
            {item.file_size && (
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <span>💾</span>
                <span>{formatBytes(item.file_size)}</span>
                {item.width && item.height && <span>· {item.width}×{item.height}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete confirm banner ── */}
      {confirmDelete && (
        <div className="shrink-0 px-4 py-3 bg-red-950/80 backdrop-blur-sm flex items-center gap-3">
          <span className="text-white text-sm flex-1">למחוק את הקובץ לצמיתות?</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-1.5 rounded-full bg-red-600 text-white text-sm font-bold disabled:opacity-50"
          >
            {deleting ? '...' : 'מחק'}
          </button>
          <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-full bg-white/10 text-white text-sm">ביטול</button>
        </div>
      )}

      {/* ── Media ── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0">
        {item.media_type === 'photo' ? (
          // Load full-res for current photo only; this prevents OOM crashes on
          // mobile Safari when the user swipes quickly through many large photos.
          // We use the `key` to force a fresh element (and network request) each
          // time the index changes, so the old image is garbage-collected.
          <img
            key={item.id}
            src={item.public_url}
            alt={item.caption ?? ''}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        ) : (
          <video key={item.id} ref={videoRef} src={item.public_url} controls playsInline className="max-w-full max-h-full" style={{ outline: 'none' }} />
        )}

        {/* Pre-load adjacent photos as lightweight thumbnails so swiping feels instant.
            These are 800 px thumbnails (not full-res) — fast to load, low memory. */}
        {[index - 1, index + 1].map(i => {
          const adj = items[i]
          if (!adj || adj.media_type !== 'photo') return null
          return <img key={`pre-${adj.id}`} src={getThumbnailUrl(adj.public_url, 800)} alt="" className="hidden" aria-hidden />
        })}

        {/* Desktop arrows */}
        {index > 0 && (
          <button onClick={prev} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white text-xl hidden sm:flex items-center justify-center hover:bg-black/70 transition">›</button>
        )}
        {index < items.length - 1 && (
          <button onClick={next} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white text-xl hidden sm:flex items-center justify-center hover:bg-black/70 transition">‹</button>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div className="shrink-0 px-4 py-3 bg-black/70 backdrop-blur-sm">
        {/* Inline date/location strip (always visible, compact) */}
        <div className="flex items-center justify-center gap-3 mb-2 text-xs text-white/50">
          {dateStr && <span>📅 {dateStr}{timeStr ? ` ${timeStr}` : ''}</span>}
          {item.location_name && <span>📍 {item.location_name}</span>}
        </div>

        {/* Caption */}
        {item.caption && <p className="text-white/80 text-sm text-center mb-2">{item.caption}</p>}

        {/* Reaction summary */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex gap-2 flex-wrap justify-center mb-2">
            {Object.entries(reactionGroups).map(([emoji, people]) => (
              <span key={emoji} className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1 text-sm">
                <span>{emoji}</span>
                <span className="text-white/70 text-xs font-bold">{people.length}</span>
              </span>
            ))}
          </div>
        )}

        {/* Reaction toggle */}
        {viewerName && (
          <div className="flex justify-center">
            <button
              onClick={() => { setShowReactions(s => !s); setShowInfo(false) }}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-full px-4 py-1.5 text-white text-sm transition"
            >
              <span>😊</span><span>תגובה</span>
            </button>
          </div>
        )}

        {/* Emoji picker */}
        {showReactions && (
          <div className="flex gap-3 justify-center mt-3">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="text-2xl transition-transform active:scale-110 hover:scale-125"
                style={{ opacity: myReactionEmojis.includes(emoji) ? 1 : 0.6 }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
