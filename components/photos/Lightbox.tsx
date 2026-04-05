'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { TripMedia, MediaReaction } from '@/lib/trip-media'
import { FAMILY_MEMBERS } from '@/lib/types'

interface Props {
  items: TripMedia[]
  initialIndex: number
  viewerName: string | null
  onClose: () => void
  onReactionChange?: (mediaId: string, emoji: string) => void
}

const REACTION_EMOJIS = ['❤️', '😂', '😍', '🔥', '👏', '😮']

export default function Lightbox({ items, initialIndex, viewerName, onClose, onReactionChange }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [showReactions, setShowReactions] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const item = items[index]
  const member = FAMILY_MEMBERS.find(m => m.name === item?.uploader)

  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIndex(i => Math.min(items.length - 1, i + 1)), [items.length])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') next()
      if (e.key === 'ArrowRight') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  // Pause video when navigating away
  useEffect(() => {
    videoRef.current?.pause()
  }, [index])

  // Touch swipe
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current ?? 0))
    if (Math.abs(dx) > 50 && dy < 80) {
      if (dx < 0) next()
      else prev()
    }
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

  if (!item) return null

  const myReactionEmojis = (item.reactions ?? [])
    .filter(r => r.person === viewerName)
    .map(r => r.emoji)

  // Group reactions by emoji
  const reactionGroups: Record<string, string[]> = {}
  for (const r of item.reactions ?? []) {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = []
    reactionGroups[r.emoji].push(r.person)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white text-xl"
        >
          ✕
        </button>
        <div className="text-center">
          {member && (
            <div className="text-white font-bold text-sm">{member.hebrewName}</div>
          )}
          <div className="text-white/50 text-xs">
            {index + 1} / {items.length}
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0">
        {item.media_type === 'photo' ? (
          <img
            key={item.id}
            src={item.public_url}
            alt={item.caption ?? ''}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        ) : (
          <video
            key={item.id}
            ref={videoRef}
            src={item.public_url}
            controls
            playsInline
            className="max-w-full max-h-full"
            style={{ outline: 'none' }}
          />
        )}

        {/* Prev/Next arrows (desktop) */}
        {index > 0 && (
          <button
            onClick={prev}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white hidden sm:flex items-center justify-center hover:bg-black/70 transition"
          >
            ›
          </button>
        )}
        {index < items.length - 1 && (
          <button
            onClick={next}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white hidden sm:flex items-center justify-center hover:bg-black/70 transition"
          >
            ‹
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 px-4 py-3 bg-black/60 backdrop-blur-sm">
        {/* Caption */}
        {item.caption && (
          <p className="text-white/80 text-sm text-center mb-2">{item.caption}</p>
        )}

        {/* Existing reactions summary */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex gap-2 flex-wrap justify-center mb-2">
            {Object.entries(reactionGroups).map(([emoji, people]) => (
              <span
                key={emoji}
                className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1 text-sm"
              >
                <span>{emoji}</span>
                <span className="text-white/70 text-xs font-bold">{people.length}</span>
              </span>
            ))}
          </div>
        )}

        {/* Reaction picker toggle */}
        <div className="flex items-center justify-center gap-3">
          {viewerName && (
            <button
              onClick={() => setShowReactions(s => !s)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-full px-4 py-1.5 text-white text-sm transition"
            >
              <span>😊</span>
              <span>תגובה</span>
            </button>
          )}
          <div className="text-white/40 text-xs">
            {new Date(item.taken_at).toLocaleDateString('he-IL')}
          </div>
        </div>

        {/* Reaction emoji picker */}
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
