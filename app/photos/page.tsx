'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Trip } from '@/lib/trip-media'

export default function PhotosPage() {
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    fetch('/api/trips')
      .then(r => r.json())
      .then(data => {
        setTrips(Array.isArray(data) ? data : [])
        setLoading(false)
        setTimeout(() => setVisible(true), 60)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col px-4 pb-10 transition-opacity duration-500"
      style={{
        background: 'linear-gradient(160deg,#050e1e 0%,#091629 40%,#040d1a 100%)',
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Header */}
      <div className="pt-8 pb-6 text-center">
        <div className="text-5xl mb-3">📸</div>
        <h1 className="text-2xl font-black text-white">תמונות מהטיולים</h1>
        <p className="text-white/40 text-sm mt-1">בחרו אלבום לצפייה או העלאה</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <div className="text-4xl mb-3">🏖️</div>
          <p>אין אלבומים עדיין</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-md mx-auto w-full">
          {trips.map(trip => (
            <TripCard key={trip.id} trip={trip} onClick={() => router.push(`/photos/${trip.slug}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const dateRange = formatDateRange(trip.starts_on, trip.ends_on)

  return (
    <button
      onClick={onClick}
      className="w-full rounded-3xl overflow-hidden text-right transition-all active:scale-[0.97] hover:scale-[1.02]"
      style={{
        background: trip.cover_url ? 'none' : 'rgba(255,255,255,0.07)',
        border: '1.5px solid rgba(255,255,255,0.14)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        position: 'relative',
      }}
    >
      {trip.cover_url && (
        <img
          src={trip.cover_url}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div
        className="relative p-5"
        style={trip.cover_url ? { background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 100%)' } : {}}
      >
        <div className="flex items-center gap-4">
          <div className="text-4xl shrink-0">🏛️</div>
          <div>
            <div className="font-black text-white text-lg leading-tight">{trip.title}</div>
            {dateRange && <div className="text-white/50 text-xs mt-1">{dateRange}</div>}
            {trip.description && <div className="text-white/40 text-xs mt-0.5">{trip.description}</div>}
          </div>
        </div>
      </div>
    </button>
  )
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start) return ''
  const s = new Date(start).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
  if (!end) return s
  const e = new Date(end).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${s} – ${e}`
}
