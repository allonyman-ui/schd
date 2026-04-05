'use client'

import { useState } from 'react'
import type { TripMedia } from '@/lib/trip-media'
import { getThumbnailUrl } from '@/lib/trip-media'
import { FAMILY_MEMBERS } from '@/lib/types'

interface Props {
  media: TripMedia
  onClick: () => void
}

export default function MediaThumbnail({ media, onClick }: Props) {
  const [imgError, setImgError] = useState(false)
  const member = FAMILY_MEMBERS.find(m => m.name === media.uploader)

  const thumb = media.media_type === 'photo' && !imgError
    ? getThumbnailUrl(media.public_url, 600)
    : null

  const timeStr = media.taken_at
    ? new Date(media.taken_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer overflow-hidden rounded-xl group"
      style={{ breakInside: 'avoid', marginBottom: '8px' }}
    >
      {media.media_type === 'photo' && thumb ? (
        <img
          src={thumb}
          alt={media.caption ?? ''}
          className="w-full block object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          style={{ aspectRatio: media.width && media.height ? `${media.width}/${media.height}` : '1/1' }}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : media.media_type === 'video' ? (
        <div className="relative w-full bg-gray-900" style={{ aspectRatio: '16/9' }}>
          <video
            src={media.public_url}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
            playsInline
          />
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition">
            <div className="w-12 h-12 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        // Fallback for broken image
        <div className="w-full bg-gray-800 flex items-center justify-center" style={{ aspectRatio: '1/1' }}>
          <span className="text-4xl">📷</span>
        </div>
      )}

      {/* Always-visible bottom gradient with info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-2 pointer-events-none flex flex-col gap-0.5">
        {/* Location */}
        {media.location_name && (
          <span className="text-white/80 text-[10px] leading-tight flex items-center gap-1">
            <span>📍</span>
            <span className="truncate">{media.location_name}</span>
          </span>
        )}
        {/* Time + uploader */}
        <div className="flex items-center gap-1.5">
          {timeStr && (
            <span className="text-white/55 text-[10px]">{timeStr}</span>
          )}
          {member && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
              {member.hebrewName}
            </span>
          )}
        </div>
      </div>

      {/* Video duration badge */}
      {media.media_type === 'video' && media.duration_sec && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
          {formatDuration(media.duration_sec)}
        </div>
      )}
    </div>
  )
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
