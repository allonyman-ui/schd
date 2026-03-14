'use client'

import { useState, useEffect } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { he } from 'date-fns/locale'

interface Event {
  id: string
  title: string
  person: string
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  notes: string | null
  is_recurring: boolean
  recurrence_days: string[] | null
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const KIDS = [
  {
    key: 'ami',
    name: 'אמי',
    emoji: '🌸',
    thBg: '#FFEBEE',
    thColor: '#B71C1C',
    thBorder: '#E53935',
    cellBg: '#FFF5F5',
  },
  {
    key: 'alex',
    name: 'אלכס',
    emoji: '⚡',
    thBg: '#E0F2F1',
    thColor: '#00695C',
    thBorder: '#00897B',
    cellBg: '#F0FAF9',
  },
  {
    key: 'itan',
    name: 'איתן',
    emoji: '🌟',
    thBg: '#FFF3E0',
    thColor: '#E65100',
    thBorder: '#F57C00',
    cellBg: '#FFFAF0',
  },
]

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

export default function KidsSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
  }, [selectedDate])

  async function loadEvents() {
    setLoading(true)
    try {
      const d = format(selectedDate, 'yyyy-MM-dd')
      const res = await fetch(`/api/events?start=${d}&end=${d}&include_recurring=true`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      }
    } finally {
      setLoading(false)
    }
  }

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const dayOfWeek = DAY_NAMES[selectedDate.getDay()]

  function getKidEvents(kidKey: string): Event[] {
    return events
      .filter(e => {
        if (e.person !== kidKey) return false
        if (e.is_recurring && e.recurrence_days) {
          return e.recurrence_days.includes(dayOfWeek)
        }
        return e.date === dateStr
      })
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  }

  const kidEvents = {
    ami: getKidEvents('ami'),
    alex: getKidEvents('alex'),
    itan: getKidEvents('itan'),
  }

  // All unique time slots across all kids (timed events only)
  const allTimedSlots = [...new Set(
    [...kidEvents.ami, ...kidEvents.alex, ...kidEvents.itan]
      .filter(e => e.start_time)
      .map(e => e.start_time!)
  )].sort()

  // Events without time (all-day)
  const allDayAmi  = kidEvents.ami.filter(e => !e.start_time)
  const allDayAlex = kidEvents.alex.filter(e => !e.start_time)
  const allDayItan = kidEvents.itan.filter(e => !e.start_time)
  const hasAllDay  = allDayAmi.length || allDayAlex.length || allDayItan.length

  const totalKidEvents = [...kidEvents.ami, ...kidEvents.alex, ...kidEvents.itan].length

  const dateLabel = format(selectedDate, 'EEEE, d בMMMM yyyy', { locale: he })

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          nav { display: none !important; }
          main { padding: 0 !important; }
          .print-container { padding: 4mm 6mm; }
          @page { size: A4 landscape; margin: 6mm; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto print-container">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between mb-4 no-print flex-row-reverse">
          {/* Print button */}
          <button
            onClick={() => window.print()}
            className="bg-gray-900 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-gray-700 transition"
          >
            🖨️ הדפס / שמור PDF
          </button>

          {/* Date navigation */}
          <div className="flex items-center gap-2 flex-row-reverse">
            <button
              onClick={() => setSelectedDate(d => addDays(d, 1))}
              className="w-9 h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow-sm"
            >
              ›
            </button>
            <input
              type="date"
              value={dateStr}
              onChange={e => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={() => setSelectedDate(d => subDays(d, 1))}
              className="w-9 h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow-sm"
            >
              ‹
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="text-sm text-amber-700 font-semibold hover:underline"
            >
              היום
            </button>
          </div>
        </div>

        {/* ── Page header ── */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-gray-900">
            📅 לו&quot;ז ילדים — {format(selectedDate, 'd.M', { locale: he })}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{dateLabel}</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-lg">טוען...</div>
        ) : totalKidEvents === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg font-semibold">אין אירועים ביום זה</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '88px' }} />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th
                    className="border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-500"
                    style={{ background: '#F5F5F5' }}
                  >
                    שעה
                  </th>
                  {KIDS.map(kid => (
                    <th
                      key={kid.key}
                      className="border-2 px-3 py-3"
                      style={{
                        background: kid.thBg,
                        color: kid.thColor,
                        borderColor: kid.thBorder,
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xl">{kid.emoji}</span>
                        <div>
                          <div className="text-lg font-black">{kid.name}</div>
                          <div className="text-xs font-normal opacity-70">
                            {kidEvents[kid.key as 'ami' | 'alex' | 'itan'].length} פעילויות
                          </div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* All-day events row */}
                {!!hasAllDay && (
                  <tr style={{ background: '#F3E5F5' }}>
                    <td
                      className="border border-gray-200 text-center text-xs font-bold py-2 align-middle"
                      style={{ background: '#EDE7F6', color: '#4A148C', borderColor: '#AB47BC' }}
                    >
                      כל היום
                    </td>
                    {KIDS.map(kid => {
                      const dayEvs = kid.key === 'ami' ? allDayAmi : kid.key === 'alex' ? allDayAlex : allDayItan
                      return (
                        <td
                          key={kid.key}
                          className="border border-purple-200 px-3 py-2 align-top"
                          style={{ background: '#FAF5FF' }}
                        >
                          {dayEvs.length === 0 ? (
                            <span className="text-gray-300 text-xs block text-center">—</span>
                          ) : (
                            dayEvs.map(ev => <EventCell key={ev.id} event={ev} />)
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )}

                {/* Timed event rows */}
                {allTimedSlots.map((slot, rowIdx) => (
                  <tr key={slot} style={{ background: rowIdx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    {/* Time cell */}
                    <td
                      className="border border-gray-200 text-center align-middle py-2 font-extrabold text-sm"
                      style={{ background: '#F5F5F5', color: '#333', borderColor: '#ccc', direction: 'ltr' }}
                    >
                      {formatTime(slot)}
                    </td>

                    {/* Kid cells */}
                    {KIDS.map(kid => {
                      const slotEvents = kidEvents[kid.key as 'ami' | 'alex' | 'itan'].filter(
                        e => e.start_time === slot
                      )
                      return (
                        <td
                          key={kid.key}
                          className="border border-gray-100 px-3 py-2 align-top"
                        >
                          {slotEvents.length === 0 ? (
                            <span className="text-gray-200 text-sm block text-center">—</span>
                          ) : (
                            slotEvents.map(ev => <EventCell key={ev.id} event={ev} />)
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function EventCell({ event }: { event: Event }) {
  return (
    <div className="mb-1 last:mb-0">
      {event.is_recurring && (
        <span
          className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-1"
          style={{ background: '#E8F5E9', color: '#1B5E20' }}
        >
          🔄 שבועי
        </span>
      )}
      <div className="font-extrabold text-sm leading-tight text-gray-900">{event.title}</div>
      {event.end_time && (
        <div className="text-xs text-gray-500 mt-0.5">
          עד {event.end_time.slice(0, 5)}
        </div>
      )}
      {event.location && (
        <div className="text-xs text-gray-500 mt-0.5">📍 {event.location}</div>
      )}
      {event.notes && (
        <div className="text-xs text-gray-400 mt-0.5">{event.notes}</div>
      )}
    </div>
  )
}
