'use client'

import { useState, useEffect, useCallback } from 'react'
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
  completed?: boolean
  meeting_link?: string | null
}

interface Reminder {
  id: string
  date: string
  text: string
  completed: boolean
  created_at: string
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const KIDS = [
  { key: 'ami',  name: 'אמי',   emoji: '🌸', thBg: '#FFEBEE', thColor: '#B71C1C', thBorder: '#E53935' },
  { key: 'alex', name: 'אלכס',  emoji: '⚡', thBg: '#E0F2F1', thColor: '#00695C', thBorder: '#00897B' },
  { key: 'itan', name: 'איתן',  emoji: '🌟', thBg: '#FFF3E0', thColor: '#E65100', thBorder: '#F57C00' },
]

export default function KidsSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newReminder, setNewReminder] = useState('')
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingReminders, setLoadingReminders] = useState(true)
  const [addingReminder, setAddingReminder] = useState(false)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const dayOfWeek = DAY_NAMES[selectedDate.getDay()]

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const res = await fetch(`/api/events?start=${dateStr}&end=${dateStr}&include_recurring=true`)
      if (res.ok) setEvents(await res.json())
    } finally {
      setLoadingEvents(false)
    }
  }, [dateStr])

  const loadReminders = useCallback(async () => {
    setLoadingReminders(true)
    try {
      const res = await fetch(`/api/reminders?date=${dateStr}`)
      if (res.ok) setReminders(await res.json())
    } finally {
      setLoadingReminders(false)
    }
  }, [dateStr])

  useEffect(() => {
    loadEvents()
    loadReminders()
  }, [loadEvents, loadReminders])

  async function toggleEventComplete(event: Event) {
    const updated = { completed: !event.completed }
    // Optimistic update
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, ...updated } : e))
    await fetch(`/api/events?id=${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  async function addReminder() {
    if (!newReminder.trim()) return
    setAddingReminder(true)
    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, text: newReminder.trim(), completed: false }),
    })
    if (res.ok) {
      const data = await res.json()
      setReminders(prev => [...prev, data])
      setNewReminder('')
    }
    setAddingReminder(false)
  }

  async function toggleReminder(reminder: Reminder) {
    const updated = { completed: !reminder.completed }
    setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, ...updated } : r))
    await fetch(`/api/reminders?id=${reminder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  async function deleteReminder(id: string) {
    setReminders(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/reminders?id=${id}`, { method: 'DELETE' })
  }

  function getKidEvents(kidKey: string): Event[] {
    return events
      .filter(e => {
        if (e.person !== kidKey) return false
        if (e.is_recurring && e.recurrence_days) return e.recurrence_days.includes(dayOfWeek)
        return e.date === dateStr
      })
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  }

  const kidEvents = {
    ami: getKidEvents('ami'),
    alex: getKidEvents('alex'),
    itan: getKidEvents('itan'),
  }

  const allTimedSlots = Array.from(new Set(
    [...kidEvents.ami, ...kidEvents.alex, ...kidEvents.itan]
      .filter(e => e.start_time)
      .map(e => e.start_time!)
  )).sort()

  const allDayEvents = {
    ami:  kidEvents.ami.filter(e => !e.start_time),
    alex: kidEvents.alex.filter(e => !e.start_time),
    itan: kidEvents.itan.filter(e => !e.start_time),
  }
  const hasAllDay = allDayEvents.ami.length + allDayEvents.alex.length + allDayEvents.itan.length > 0
  const totalEvents = kidEvents.ami.length + kidEvents.alex.length + kidEvents.itan.length

  const dateLabel = format(selectedDate, 'EEEE, d בMMMM yyyy', { locale: he })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav { display: none !important; }
          main { padding: 0 !important; }
          @page { size: A4 landscape; margin: 6mm; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-2 sm:px-4">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 no-print gap-2 flex-row-reverse flex-wrap">
          <button
            onClick={() => window.print()}
            className="bg-gray-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-700 transition whitespace-nowrap"
          >
            🖨️ הדפס
          </button>
          <div className="flex items-center gap-1 sm:gap-2 flex-row-reverse flex-wrap">
            <button onClick={() => setSelectedDate(d => addDays(d, 1))}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow-sm text-lg">›</button>
            <input type="date" value={dateStr}
              onChange={e => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 w-36" />
            <button onClick={() => setSelectedDate(d => subDays(d, 1))}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow-sm text-lg">‹</button>
            <button onClick={() => setSelectedDate(new Date())}
              className="text-sm text-amber-700 font-semibold hover:underline px-1">היום</button>
          </div>
        </div>

        {/* Date header */}
        <div className="text-center mb-4">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">
            📅 לו&quot;ז ילדים — {format(selectedDate, 'd.M', { locale: he })}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{dateLabel}</p>
        </div>

        {/* Reminders section */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-5 no-print">
          <h2 className="text-base font-bold text-yellow-800 mb-3 flex items-center gap-2 flex-row-reverse justify-end">
            <span>📌 תזכורות להיום</span>
            {!loadingReminders && reminders.length > 0 && (
              <span className="text-xs bg-yellow-200 text-yellow-800 rounded-full px-2 py-0.5">{reminders.length}</span>
            )}
          </h2>

          {/* Reminder list */}
          {loadingReminders ? (
            <p className="text-sm text-yellow-600 text-center py-1">טוען...</p>
          ) : (
            <ul className="space-y-2 mb-3">
              {reminders.length === 0 && (
                <li className="text-sm text-yellow-500 text-center py-1">אין תזכורות להיום</li>
              )}
              {reminders.map(r => (
                <li key={r.id} className="flex items-center gap-2 flex-row-reverse">
                  <input type="checkbox" checked={r.completed} onChange={() => toggleReminder(r)}
                    className="w-4 h-4 accent-amber-500 flex-shrink-0" />
                  <span className={`flex-1 text-sm text-right ${r.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {r.text}
                  </span>
                  <button onClick={() => deleteReminder(r.id)}
                    className="text-gray-300 hover:text-red-400 transition text-base leading-none flex-shrink-0">×</button>
                </li>
              ))}
            </ul>
          )}

          {/* Add reminder */}
          <div className="flex gap-2 flex-row-reverse">
            <input
              type="text"
              value={newReminder}
              onChange={e => setNewReminder(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addReminder()}
              placeholder="הוסף תזכורת..."
              dir="rtl"
              className="flex-1 border border-yellow-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button onClick={addReminder} disabled={addingReminder || !newReminder.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition disabled:opacity-50 whitespace-nowrap">
              + הוסף
            </button>
          </div>
        </div>

        {/* Schedule table */}
        {loadingEvents ? (
          <div className="text-center py-12 text-gray-400 text-lg">טוען לוח זמנים...</div>
        ) : totalEvents === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg font-semibold">אין אירועים ביום זה</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-100">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '480px' }}>
              <colgroup>
                <col style={{ width: '72px' }} />
                <col /><col /><col />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-2 border-gray-300 px-1 py-2 text-xs font-bold text-gray-500 bg-gray-50">שעה</th>
                  {KIDS.map(kid => (
                    <th key={kid.key} className="border-2 px-2 py-2"
                      style={{ background: kid.thBg, color: kid.thColor, borderColor: kid.thBorder }}>
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-lg sm:text-xl">{kid.emoji}</span>
                        <div>
                          <div className="text-base sm:text-lg font-black">{kid.name}</div>
                          <div className="text-xs font-normal opacity-70">
                            {kidEvents[kid.key as keyof typeof kidEvents].length} פעילויות
                          </div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* All-day row */}
                {hasAllDay && (
                  <tr style={{ background: '#FAF5FF' }}>
                    <td className="border border-gray-200 text-center text-xs font-bold py-2 align-middle"
                      style={{ background: '#EDE7F6', color: '#4A148C', borderColor: '#AB47BC' }}>
                      כל היום
                    </td>
                    {KIDS.map(kid => {
                      const evs = allDayEvents[kid.key as keyof typeof allDayEvents]
                      return (
                        <td key={kid.key} className="border border-purple-100 px-2 py-2 align-top">
                          {evs.length === 0 ? (
                            <span className="text-gray-200 text-xs block text-center">—</span>
                          ) : evs.map(ev => (
                            <EventCell key={ev.id} event={ev} onToggleComplete={toggleEventComplete} />
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                )}

                {/* Timed rows */}
                {allTimedSlots.map((slot, idx) => (
                  <tr key={slot} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td className="border border-gray-200 text-center align-middle py-2 font-extrabold text-xs sm:text-sm"
                      style={{ background: '#F5F5F5', color: '#333', borderColor: '#ccc', direction: 'ltr' }}>
                      {slot.slice(0, 5)}
                    </td>
                    {KIDS.map(kid => {
                      const slotEvs = kidEvents[kid.key as keyof typeof kidEvents].filter(e => e.start_time === slot)
                      return (
                        <td key={kid.key} className="border border-gray-100 px-2 py-2 align-top">
                          {slotEvs.length === 0 ? (
                            <span className="text-gray-200 text-sm block text-center">—</span>
                          ) : slotEvs.map(ev => (
                            <EventCell key={ev.id} event={ev} onToggleComplete={toggleEventComplete} />
                          ))}
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

function EventCell({ event, onToggleComplete }: { event: Event; onToggleComplete: (e: Event) => void }) {
  return (
    <div className="mb-1 last:mb-0">
      <div className="flex items-start gap-1.5 flex-row-reverse">
        <input
          type="checkbox"
          checked={!!event.completed}
          onChange={() => onToggleComplete(event)}
          className="mt-0.5 w-3.5 h-3.5 accent-green-500 flex-shrink-0 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          {event.is_recurring && (
            <span className="inline-block text-xs font-bold px-1.5 py-0.5 rounded-full mb-0.5"
              style={{ background: '#E8F5E9', color: '#1B5E20' }}>🔄</span>
          )}
          <div className={`font-extrabold text-xs sm:text-sm leading-tight ${event.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {event.title}
          </div>
          {event.end_time && !event.completed && (
            <div className="text-xs text-gray-400 mt-0.5">עד {event.end_time.slice(0, 5)}</div>
          )}
          {event.location && !event.completed && (
            <div className="text-xs text-gray-400">📍 {event.location}</div>
          )}
          {event.meeting_link && !event.completed && (
            <a
              href={event.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-0.5 font-medium"
            >
              🔗 כניסה לפגישה
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
