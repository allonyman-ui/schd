'use client'

import { Event, FAMILY_MEMBERS } from '@/lib/types'
import EventCard from './EventCard'
import { format, addDays, startOfWeek } from 'date-fns'
import { he } from 'date-fns/locale'

interface WeekViewProps {
  weekStart: Date
  events: Event[]
  onDelete?: (id: string) => void
  personFilter?: string
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export default function WeekView({ weekStart, events, onDelete, personFilter }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="week-grid overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {/* Header */}
        {days.map((day, i) => (
          <div key={i} className="text-center">
            <div className="text-sm font-semibold text-gray-600">{HEBREW_DAYS[i]}</div>
            <div className="text-lg font-bold text-gray-800">{format(day, 'd')}</div>
            <div className="text-xs text-gray-400">{format(day, 'MMM', { locale: he })}</div>
          </div>
        ))}

        {/* Events per day */}
        {days.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const dayEvents = events.filter(e => e.date === dateStr)
          const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr

          return (
            <div
              key={i}
              className={`min-h-[120px] rounded-xl p-1.5 ${
                isToday ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-white'
              } shadow-sm`}
            >
              {dayEvents.length === 0 ? (
                <div className="text-xs text-gray-300 text-center mt-4">—</div>
              ) : (
                dayEvents.map(event => (
                  <EventCard key={event.id} event={event} showPerson={!personFilter} onDelete={onDelete} />
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
