'use client'

import { useEffect, useRef } from 'react'
import type { TripMedia } from '@/lib/trip-media'
import MediaThumbnail from './MediaThumbnail'

interface Props {
  items: TripMedia[]
  onItemClick: (index: number) => void
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
}

// ── date helpers ──────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" (or empty string) from a taken_at ISO string */
function dayKey(takenAt: string | null): string {
  if (!takenAt) return ''
  return takenAt.slice(0, 10)
}

/** Format a YYYY-MM-DD key into a Hebrew date label */
function formatDayLabel(key: string): string {
  if (!key) return 'ללא תאריך'
  const d = new Date(key + 'T12:00:00') // noon to avoid TZ shifts
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Pick the most-common location_name for a group of items */
function dominantLocation(group: TripMedia[]): string | null {
  const counts: Record<string, number> = {}
  for (const item of group) {
    if (item.location_name) counts[item.location_name] = (counts[item.location_name] ?? 0) + 1
  }
  const entries = Object.entries(counts)
  if (!entries.length) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

// ── group by day ──────────────────────────────────────────────────────────────

interface DayGroup {
  key: string           // YYYY-MM-DD or ''
  label: string         // formatted Hebrew date
  location: string | null
  items: TripMedia[]
  startIndex: number    // absolute index in `items` array (for lightbox)
}

function groupByDay(items: TripMedia[]): DayGroup[] {
  const map = new Map<string, TripMedia[]>()
  for (const item of items) {
    const k = dayKey(item.taken_at)
    const arr = map.get(k)
    if (arr) arr.push(item)
    else map.set(k, [item])
  }

  const groups: DayGroup[] = []
  let cursor = 0
  for (const [key, groupItems] of map) {
    groups.push({
      key,
      label: formatDayLabel(key),
      location: dominantLocation(groupItems),
      items: groupItems,
      startIndex: cursor,
    })
    cursor += groupItems.length
  }
  return groups
}

// ── component ─────────────────────────────────────────────────────────────────

export default function MediaGrid({ items, onItemClick, onLoadMore, hasMore, loading }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !loading) onLoadMore() },
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

  const groups = groupByDay(items)

  return (
    <div>
      {groups.map(group => (
        <div key={group.key || 'no-date'} className="mb-6">
          {/* ── Date + location header ── */}
          <div className="flex items-start gap-3 px-1 pt-3 pb-2 mb-1">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-white font-black text-sm leading-tight">{group.label}</span>
              {group.location && (
                <span className="inline-flex items-center gap-1 mt-1.5 self-start">
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5"
                    style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}
                  >
                    <span>📍</span>
                    <span>{group.location}</span>
                  </span>
                </span>
              )}
            </div>
            <span className="text-white/25 text-xs shrink-0 mt-0.5">{group.items.length}</span>
          </div>

          {/* ── Masonry grid ── */}
          <div
            style={{ columns: 'var(--grid-cols, 2)', columnGap: '8px' }}
            className="[--grid-cols:2] sm:[--grid-cols:3] md:[--grid-cols:4]"
          >
            {group.items.map((item, i) => (
              <MediaThumbnail
                key={item.id}
                media={item}
                onClick={() => onItemClick(group.startIndex + i)}
              />
            ))}
          </div>
        </div>
      ))}

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
