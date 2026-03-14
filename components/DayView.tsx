'use client'

import { Event } from '@/lib/types'
import EventCard from './EventCard'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

interface DayViewProps {
  date: Date
  events: Event[]
  onDelete?: (id: string) => void
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7:00 - 22:00

export default function DayView({ date, events, onDelete }: DayViewProps) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const dayEvents = events.filter(e => e.date === dateStr)

  const allDayEvents = dayEvents.filter(e => !e.start_time)
  const timedEvents = dayEvents.filter(e => e.start_time)

  const hebrewDate = format(date, 'EEEE, d בMMMM yyyy', { locale: he })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">{hebrewDate}</h2>

      {allDayEvents.length > 0 && (
        <div className="mb-4 p-3 bg-white rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">כל היום</h3>
          {allDayEvents.map(event => (
            <EventCard key={event.id} event={event} onDelete={onDelete} />
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {HOURS.map(hour => {
          const hourStr = `${String(hour).padStart(2, '0')}:00`
          const hourEvents = timedEvents.filter(e => {
            const eventHour = parseInt(e.start_time!.split(':')[0])
            return eventHour === hour
          })

          return (
            <div key={hour} className="flex border-b border-gray-100 min-h-[60px]">
              <div className="w-16 text-xs text-gray-400 pt-2 px-2 text-left flex-shrink-0 border-l border-gray-100">
                {hourStr}
              </div>
              <div className="flex-1 p-1">
                {hourEvents.map(event => (
                  <EventCard key={event.id} event={event} onDelete={onDelete} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
