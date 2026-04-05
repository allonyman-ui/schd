'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Trip } from '@/lib/trip-media'
import UploadZone from '@/components/photos/UploadZone'

export default function UploadPage() {
  const { tripSlug } = useParams<{ tripSlug: string }>()
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/trips')
      .then(r => r.json())
      .then((trips: Trip[]) => {
        const found = trips.find(t => t.slug === tripSlug)
        setTrip(found ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tripSlug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050e1e' }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#050e1e' }}>
        <p className="text-white/60">הטיול לא נמצא</p>
        <button onClick={() => router.back()} className="text-blue-400 underline text-sm">חזור</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#050e1e 0%,#091629 60%,#040d1a 100%)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white"
        >
          ‹
        </button>
        <div className="text-center">
          <h1 className="text-white font-black text-base">{trip.title}</h1>
          <p className="text-white/40 text-xs">העלאת תמונות ווידאו</p>
        </div>
        <div className="w-9" />
      </div>

      <div className="flex-1 px-4 pb-8">
        <UploadZone
          trip={trip}
          onUploaded={() => {
            // After 2s redirect to gallery
            setTimeout(() => router.push(`/photos/${tripSlug}`), 2000)
          }}
        />
      </div>
    </div>
  )
}
