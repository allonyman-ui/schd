'use client'

import { useEffect, useRef, useState } from 'react'
import type { TripMedia } from '@/lib/trip-media'
import MediaThumbnail from './MediaThumbnail'

interface Props {
  items: TripMedia[]
  onItemClick: (index: number) => void
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
}

export default function MediaGrid({ items, onItemClick, onLoadMore, hasMore, loading }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading) onLoadMore()
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [onLoadMore, hasMore, loading])

  if (!items.length && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-white/40">
        <div className="text-5xl mb-4">📷</div>
        <p className="text-lg font-bold">עדיין אין תמונות</p>
        <p className="text-sm mt-1">העלו תמונות ממסך ההעלאה</p>
      </div>
    )
  }

  return (
    <div>
      {/* CSS Masonry via columns */}
      <div
        style={{
          columns: 'var(--grid-cols, 2)',
          columnGap: '8px',
        }}
        className="[--grid-cols:2] sm:[--grid-cols:3] md:[--grid-cols:4]"
      >
        {items.map((item, i) => (
          <MediaThumbnail
            key={item.id}
            media={item}
            onClick={() => onItemClick(i)}
          />
        ))}
      </div>

      {/* Load more sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && (
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
        </div>
      )}
    </div>
  )
}
