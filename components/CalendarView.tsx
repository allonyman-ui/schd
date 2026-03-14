'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfWeek, addWeeks, subWeeks, addDays, subDays } from 'date-fns'
import { Event } from '@/lib/types'
import DayView from './DayView'
import WeekView from './WeekView'
import PrintButton from './PrintButton'

interface CalendarViewProps {
  personFilter?: string
}

export default function CalendarView({ personFilter }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }) // Sunday

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const start = viewMode === 'week'
      ? format(weekStart, 'yyyy-MM-dd')
      : format(currentDate, 'yyyy-MM-dd')
    const end = viewMode === 'week'
      ? format(addDays(weekStart, 6), 'yyyy-MM-dd')
      : format(currentDate, 'yyyy-MM-dd')

    let url = `/api/events?start=${start}&end=${end}`
    if (personFilter) url += `&person=${personFilter}`

    const res = await fetch(url)
    const data = await res.json()
    setEvents(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [viewMode, currentDate, weekStart, personFilter])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  function navigate(direction: 'prev' | 'next') {
    if (viewMode === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
    } else {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק אירוע זה?')) return
    await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
    fetchEvents()
  }

  const weekLabel = viewMode === 'week'
    ? `${format(weekStart, 'd/M')} - ${format(addDays(weekStart, 6), 'd/M/yyyy')}`
    : format(currentDate, 'dd/MM/yyyy')

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6 no-print flex-row-reverse">
        <div className="flex items-center gap-2">
          <PrintButton />
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 text-sm font-medium transition ${
                viewMode === 'week' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              שבוע
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2 text-sm font-medium transition ${
                viewMode === 'day' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              יום
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('next')}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            ‹
          </button>
          <span className="font-medium text-gray-700 min-w-[140px] text-center">{weekLabel}</span>
          <button
            onClick={() => navigate('prev')}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            ›
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            היום
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">טוען...</div>
      ) : viewMode === 'week' ? (
        <WeekView
          weekStart={weekStart}
          events={events}
          onDelete={handleDelete}
          personFilter={personFilter}
        />
      ) : (
        <DayView
          date={currentDate}
          events={events}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
