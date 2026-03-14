'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { he } from 'date-fns/locale'

interface Event {
  id: string; title: string; person: string; date: string
  start_time: string | null; end_time: string | null
  location: string | null; notes: string | null
  is_recurring: boolean; recurrence_days: string[] | null
  completed?: boolean; meeting_link?: string | null
}

interface Reminder {
  id: string; date: string; person: string | null
  text: string; completed: boolean; created_at: string
}

interface KidTheme {
  bg: string; headerGrad: string; border: string; accent: string
  textColor: string; noteBg: string; noteText: string
  badgeBg: string; badgeText: string; cardBg: string
  dark?: boolean; label: string; headerPattern?: string
}

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

// ── Per-kid theme packs ────────────────────────────────────────────────────
const THEMES: Record<string, KidTheme[]> = {
  ami: [
    { // 0 – Princess 👑
      bg: '#FFF0F3', headerGrad: 'linear-gradient(135deg,#FFB6C1,#FF85A1)',
      border: '#FF85A1', accent: '#E91E63', textColor: '#880E4F',
      noteBg: '#FCE4EC', noteText: '#880E4F',
      badgeBg: '#F8BBD9', badgeText: '#880E4F', cardBg: '#FFF0F3',
      label: '👑 פרינסס'
    },
    { // 1 – Rainbow 🌈
      bg: '#FFFDE7', headerGrad: 'linear-gradient(135deg,#FFD54F,#FF8A65)',
      border: '#FFB300', accent: '#F57F17', textColor: '#E65100',
      noteBg: '#FFF8E1', noteText: '#E65100',
      badgeBg: '#FFE082', badgeText: '#BF360C', cardBg: '#FFFDE7',
      label: '🌈 רינבו'
    },
    { // 2 – Unicorn 🦄
      bg: '#F3E5F5', headerGrad: 'linear-gradient(135deg,#CE93D8,#9575CD)',
      border: '#AB47BC', accent: '#7B1FA2', textColor: '#4A148C',
      noteBg: '#EDE7F6', noteText: '#4A148C',
      badgeBg: '#E1BEE7', badgeText: '#4A148C', cardBg: '#F3E5F5',
      label: '🦄 יוניקורן'
    },
  ],
  itan: [
    { // 0 – Sports ⚽
      bg: '#E8F5E9', headerGrad: 'linear-gradient(135deg,#66BB6A,#1B5E20)',
      border: '#43A047', accent: '#1B5E20', textColor: '#1B5E20',
      noteBg: '#F1F8E9', noteText: '#33691E',
      badgeBg: '#C8E6C9', badgeText: '#1B5E20', cardBg: '#F9FBE7',
      label: '⚽ ספורט'
    },
    { // 1 – Gaming 🎮  (dark)
      bg: '#1a1a2e', headerGrad: 'linear-gradient(135deg,#6C3483,#1a1a2e)',
      border: '#A855F7', accent: '#D8B4FE', textColor: '#E9D5FF',
      noteBg: '#2d1b4e', noteText: '#DDD6FE',
      badgeBg: '#4C1D95', badgeText: '#DDD6FE', cardBg: '#16213e',
      dark: true, label: '🎮 גיימינג'
    },
    { // 2 – Chill 😎
      bg: '#E0F7FA', headerGrad: 'linear-gradient(135deg,#26C6DA,#006064)',
      border: '#00ACC1', accent: '#006064', textColor: '#004D40',
      noteBg: '#E0F2F1', noteText: '#004D40',
      badgeBg: '#B2EBF2', badgeText: '#00363A', cardBg: '#E0F7FA',
      label: '😎 צ\'יל'
    },
  ],
  alex: [
    { // 0 – Music 🎵
      bg: '#F3E5F5', headerGrad: 'linear-gradient(135deg,#AB47BC,#4A148C)',
      border: '#8E24AA', accent: '#4A148C', textColor: '#4A148C',
      noteBg: '#EDE7F6', noteText: '#311B92',
      badgeBg: '#E1BEE7', badgeText: '#4A148C', cardBg: '#FAF5FF',
      label: '🎵 מוזיקה'
    },
    { // 1 – Skate 🛹
      bg: '#FFF3E0', headerGrad: 'linear-gradient(135deg,#FF7043,#BF360C)',
      border: '#FF5722', accent: '#BF360C', textColor: '#BF360C',
      noteBg: '#FBE9E7', noteText: '#BF360C',
      badgeBg: '#FFCCBC', badgeText: '#BF360C', cardBg: '#FFF8F5',
      label: '🛹 סקייט'
    },
    { // 2 – Minimal 🌊
      bg: '#ECEFF1', headerGrad: 'linear-gradient(135deg,#546E7A,#263238)',
      border: '#607D8B', accent: '#263238', textColor: '#263238',
      noteBg: '#F5F5F5', noteText: '#37474F',
      badgeBg: '#CFD8DC', badgeText: '#263238', cardBg: '#F8FAFB',
      label: '🌊 מינימל'
    },
  ],
}

// ── Kid base config ────────────────────────────────────────────────────────
const KIDS = [
  { key: 'ami',  name: 'אמי',  age: 6,  photo: 'https://i.imgur.com/cG8XKwn.jpeg' as string|null, initials: 'א' },
  { key: 'alex', name: 'אלכס', age: 15, photo: 'https://i.imgur.com/G0j3TD8.jpeg' as string|null, initials: 'א' },
  { key: 'itan', name: 'איתן', age: 13, photo: 'https://i.imgur.com/5BKBLqt.jpeg' as string|null, initials: 'א' },
]

// ── Avatar component ───────────────────────────────────────────────────────
function KidAvatar({ kid, theme, onClick }: {
  kid: typeof KIDS[0]; theme: KidTheme; onClick: () => void
}) {
  const size = 160
  return (
    <button
      onClick={onClick}
      title={`לחץ לשנות עיצוב (${theme.label})`}
      className="relative flex-shrink-0 rounded-full focus:outline-none transition-transform active:scale-95 hover:scale-105"
      style={{ width: size, height: size }}
    >
      {/* Glow ring */}
      <div className="absolute inset-0 rounded-full"
        style={{ boxShadow: `0 0 0 3px ${theme.border}, 0 0 12px ${theme.border}66` }} />
      {/* Photo or initials */}
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center text-3xl font-black"
        style={{ background: theme.dark ? '#2d2d2d' : theme.bg, border: `3px solid ${theme.border}` }}>
        {kid.photo
          ? <img src={kid.photo} alt={kid.name} className="w-full h-full object-cover" />
          : <span style={{ fontSize: 36 }}>
              {kid.key === 'ami' ? '🌸' : kid.key === 'itan' ? '⚡' : '🎸'}
            </span>
        }
      </div>
      {/* Theme badge */}
      <div className="absolute -bottom-1 -right-1 text-xs rounded-full px-1.5 py-0.5 font-bold shadow-sm"
        style={{ background: theme.accent, color: '#fff', fontSize: 9 }}>
        {theme.label.split(' ')[0]}
      </div>
    </button>
  )
}

// ── EventCard ──────────────────────────────────────────────────────────────
function EventCard({ event, theme, onToggle, onDelete }: {
  event: Event; theme: KidTheme
  onToggle: (e: Event) => void; onDelete: (id: string) => void
}) {
  const done = !!event.completed
  return (
    <div className="group relative rounded-2xl p-3 mb-2 transition-all"
      style={{
        background: done ? (theme.dark ? '#2a2a2a' : '#f5f5f5') : theme.cardBg,
        border: `1.5px solid ${done ? '#ddd' : theme.border}44`,
        borderLeft: done ? undefined : `4px solid ${theme.border}`,
        opacity: done ? 0.6 : 1,
      }}>

      <div className="flex items-start gap-2 flex-row-reverse">
        <input type="checkbox" checked={done} onChange={() => onToggle(event)}
          className="mt-1 w-4 h-4 flex-shrink-0 cursor-pointer rounded"
          style={{ accentColor: theme.accent }} />

        <div className="flex-1 min-w-0 text-right">
          {/* Time + badges */}
          <div className="flex flex-wrap gap-1 flex-row-reverse mb-1">
            {event.start_time && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" dir="ltr"
                style={{ background: theme.badgeBg, color: theme.badgeText }}>
                ⏰ {event.start_time.slice(0,5)}{event.end_time ? `–${event.end_time.slice(0,5)}` : ''}
              </span>
            )}
            {event.is_recurring && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: theme.badgeBg, color: theme.badgeText }}>🔄 קבוע</span>
            )}
          </div>

          {/* Title */}
          <div className={`font-black text-base leading-snug mb-1 ${done ? 'line-through' : ''}`}
            style={{ color: done ? '#aaa' : theme.textColor, fontSize: 15 }}>
            {event.title}
          </div>

          {/* Location */}
          {event.location && (
            <div className="text-xs flex items-center gap-1 flex-row-reverse mb-1"
              style={{ color: done ? '#bbb' : theme.accent }}>
              <span>📍</span><span>{event.location}</span>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="text-xs rounded-xl px-2.5 py-1.5 mt-1 text-right leading-relaxed"
              style={{ background: theme.noteBg, color: done ? '#bbb' : theme.noteText }}>
              <span className="font-bold">📝 </span>{event.notes}
            </div>
          )}

          {/* Meeting link */}
          {event.meeting_link && !done && (
            <a href={event.meeting_link} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-lg mt-1.5 transition-opacity hover:opacity-80"
              style={{ background: theme.accent, color: '#fff' }}>
              🔗 כניסה לפגישה
            </a>
          )}
        </div>

        {/* Delete */}
        <button onClick={() => onDelete(event.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 text-xs flex-shrink-0 mt-0.5">
          🗑️
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function KidsSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newReminder, setNewReminder] = useState<Record<string,string>>({ami:'',alex:'',itan:''})
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingReminders, setLoadingReminders] = useState(true)
  const [lunchMenu, setLunchMenu] = useState('')
  const [lunchEdit, setLunchEdit] = useState(false)
  const [lunchDraft, setLunchDraft] = useState('')
  const [savingLunch, setSavingLunch] = useState(false)
  const [kidThemeIdx, setKidThemeIdx] = useState<Record<string,number>>({ami:0,alex:0,itan:0})

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const dayOfWeek = DAY_NAMES[selectedDate.getDay()]

  const cycleTheme = (key: string) =>
    setKidThemeIdx(prev => ({ ...prev, [key]: (prev[key] + 1) % 3 }))

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const res = await fetch(`/api/events?start=${dateStr}&end=${dateStr}&include_recurring=true`)
      if (res.ok) setEvents(await res.json())
    } finally { setLoadingEvents(false) }
  }, [dateStr])

  const loadReminders = useCallback(async () => {
    setLoadingReminders(true)
    try {
      const res = await fetch(`/api/reminders?date=${dateStr}`)
      if (res.ok) setReminders(await res.json())
    } finally { setLoadingReminders(false) }
  }, [dateStr])

  const loadLunch = useCallback(async () => {
    const res = await fetch(`/api/lunch?date=${dateStr}`)
    if (res.ok) { const d = await res.json(); setLunchMenu(d?.menu||''); setLunchDraft(d?.menu||'') }
    else { setLunchMenu(''); setLunchDraft('') }
    setLunchEdit(false)
  }, [dateStr])

  useEffect(() => { loadEvents(); loadReminders(); loadLunch() }, [loadEvents, loadReminders, loadLunch])

  async function saveLunch() {
    setSavingLunch(true)
    const res = await fetch('/api/lunch', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date: dateStr, menu: lunchDraft }) })
    if (res.ok) { setLunchMenu(lunchDraft); setLunchEdit(false) }
    setSavingLunch(false)
  }

  async function toggleEvent(event: Event) {
    setEvents(prev => prev.map(e => e.id===event.id ? {...e, completed:!e.completed} : e))
    await fetch(`/api/events?id=${event.id}`, { method:'PATCH',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({completed:!event.completed}) })
  }

  async function deleteEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/events?id=${id}`, { method:'DELETE' })
  }

  async function addReminder(person: string) {
    const text = newReminder[person]?.trim(); if (!text) return
    const res = await fetch('/api/reminders', { method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date: dateStr, person, text, completed: false }) })
    if (res.ok) { const data = await res.json(); setReminders(prev => [...prev, data]); setNewReminder(prev=>({...prev,[person]:''})) }
  }

  async function deleteReminder(id: string) {
    setReminders(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/reminders?id=${id}`, { method:'DELETE' })
  }

  function getKidEvents(key: string) {
    return events.filter(e => {
      if (e.person !== key) return false
      if (e.is_recurring && e.recurrence_days) return e.recurrence_days.includes(dayOfWeek)
      return e.date === dateStr
    }).sort((a,b) => (a.start_time??'').localeCompare(b.start_time??''))
  }

  function getKidReminders(key: string) {
    return reminders.filter(r => r.person === key || (!r.person && r.date === dateStr))
  }

  const dateLabel = format(selectedDate, 'EEEE, d בMMMM yyyy', { locale: he })

  return (
    <>
      {/* ── Global styles ─────────────────────────────────────────────── */}
      <style>{`
        body { background: #F0F4F8; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          nav, header { display: none !important; }
          .print-table { display: table !important; }
          .screen-only { display: none !important; }
          @page { size: A4 landscape; margin: 8mm; }
        }
        @media screen { .print-table { display: none; } }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════
          PRINT LAYOUT — hidden on screen, shown on print
      ══════════════════════════════════════════════════════════════════ */}
      <div className="print-table w-full">
        <div style={{ fontFamily: 'Arial, sans-serif', direction: 'rtl' }}>
          <div style={{ textAlign: 'center', marginBottom: 8, borderBottom: '2px solid #000', paddingBottom: 6 }}>
            <strong style={{ fontSize: 18 }}>לו&quot;ז משפחת אלוני — {format(selectedDate, 'd.M.yyyy', { locale: he })}</strong>
            <span style={{ marginRight: 12, fontSize: 12, color: '#555' }}>{dateLabel}</span>
          </div>
          {lunchMenu && (
            <div style={{ marginBottom: 8, fontSize: 11, border: '1px solid #ccc', padding: '4px 8px', borderRadius: 4 }}>
              <strong>🍽️ תפריט צהריים:</strong> {lunchMenu.replace(/\n/g, ' | ')}
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {KIDS.map(kid => (
                  <th key={kid.key} style={{ border: '1.5px solid #333', padding: '6px 8px', background: '#f0f0f0', textAlign: 'center', width: '33%' }}>
                    {kid.name} — {getKidEvents(kid.key).length} פעילויות
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {KIDS.map(kid => (
                  <td key={kid.key} style={{ border: '1.5px solid #333', padding: '6px 8px', verticalAlign: 'top' }}>
                    {getKidEvents(kid.key).length === 0 ? (
                      <div style={{ color: '#aaa', textAlign: 'center' }}>—</div>
                    ) : getKidEvents(kid.key).map(ev => (
                      <div key={ev.id} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px dashed #ddd' }}>
                        <div style={{ fontWeight: 'bold' }}>{ev.title}</div>
                        {ev.start_time && <div style={{ fontSize: 10, color: '#444' }}>⏰ {ev.start_time.slice(0,5)}{ev.end_time ? `–${ev.end_time.slice(0,5)}` : ''}</div>}
                        {ev.location && <div style={{ fontSize: 10 }}>📍 {ev.location}</div>}
                        {ev.notes && <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>📝 {ev.notes}</div>}
                      </div>
                    ))}
                    {getKidReminders(kid.key).length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 4, borderTop: '1px solid #ccc' }}>
                        <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>📌 תזכורות:</div>
                        {getKidReminders(kid.key).map(r => <div key={r.id} style={{ fontSize: 10 }}>• {r.text}</div>)}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SCREEN LAYOUT
      ══════════════════════════════════════════════════════════════════ */}
      <div className="screen-only max-w-6xl mx-auto px-3 pb-12">

        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5 no-print gap-2 flex-row-reverse flex-wrap">
          <button onClick={() => window.print()}
            className="bg-gray-800 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-gray-600 transition shadow-md whitespace-nowrap">
            🖨️ הדפס
          </button>
          <div className="flex items-center gap-2 flex-row-reverse flex-wrap">
            <button onClick={() => setSelectedDate(d => addDays(d, 1))}
              className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow text-xl font-bold">›</button>
            <input type="date" value={dateStr}
              onChange={e => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm" />
            <button onClick={() => setSelectedDate(d => subDays(d, 1))}
              className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow text-xl font-bold">‹</button>
            <button onClick={() => setSelectedDate(new Date())}
              className="text-sm font-bold bg-white border-2 border-amber-400 text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-xl shadow-sm transition">
              היום
            </button>
          </div>
        </div>

        {/* ── Date header ──────────────────────────────────────────────── */}
        <div className="text-center mb-6 no-print">
          <div className="inline-block bg-white rounded-3xl shadow-md px-8 py-4 border border-gray-100">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
              📅 לו&quot;ז ילדים — {format(selectedDate, 'd בMMMM', { locale: he })}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{dateLabel}</p>
          </div>
        </div>

        {/* ── Kid columns ──────────────────────────────────────────────── */}
        {loadingEvents ? (
          <div className="text-center py-16 text-gray-400 text-xl">⏳ טוען...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {KIDS.map(kid => {
              const theme = THEMES[kid.key][kidThemeIdx[kid.key]]
              const evs = getKidEvents(kid.key)
              const kidReminders = getKidReminders(kid.key)

              return (
                <div key={kid.key} className="rounded-3xl overflow-hidden shadow-lg flex flex-col"
                  style={{ background: theme.bg, border: `2px solid ${theme.border}44` }}>

                  {/* ── Kid header ─────────────────────────────────────── */}
                  <div className="px-5 pt-5 pb-4 flex items-center gap-4 flex-row-reverse"
                    style={{ background: theme.headerGrad }}>
                    <KidAvatar kid={kid} theme={theme} onClick={() => cycleTheme(kid.key)} />
                    <div className="flex-1 text-right">
                      <div className="font-black text-2xl text-white drop-shadow">{kid.name}</div>
                      <div className="text-white/70 text-xs mt-0.5">
                        {evs.length === 0 ? 'יום חופשי 🎉' : `${evs.length} פעילויות היום`}
                      </div>
                      <div className="text-white/60 text-xs mt-1">לחץ על התמונה לשנות עיצוב</div>
                    </div>
                  </div>

                  {/* ── Events ─────────────────────────────────────────── */}
                  <div className="flex-1 px-3 pt-3 pb-1">
                    {evs.length === 0 ? (
                      <div className="text-center py-8 text-4xl opacity-30">🎈</div>
                    ) : evs.map(ev => (
                      <EventCard key={ev.id} event={ev} theme={theme} onToggle={toggleEvent} onDelete={deleteEvent} />
                    ))}
                  </div>

                  {/* ── Reminders ──────────────────────────────────────── */}
                  <div className="mx-3 mb-3 rounded-2xl overflow-hidden"
                    style={{ border: `1.5px solid ${theme.border}55`, background: theme.dark ? '#1e1e2e' : 'white' }}>
                    <div className="px-3 py-2 flex items-center gap-1.5 flex-row-reverse"
                      style={{ background: theme.headerGrad, opacity: 0.85 }}>
                      <span className="text-sm">📌</span>
                      <span className="text-xs font-black text-white">תזכורות</span>
                      {kidReminders.length > 0 && (
                        <span className="text-xs rounded-full w-5 h-5 flex items-center justify-center font-black text-white"
                          style={{ background: 'rgba(0,0,0,0.3)', fontSize: 10 }}>
                          {kidReminders.length}
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2">
                      {!loadingReminders && (
                        <>
                          {kidReminders.length === 0 && (
                            <p className="text-xs text-center py-1" style={{ color: theme.dark ? '#555' : '#ccc' }}>אין תזכורות</p>
                          )}
                          <ul className="space-y-1 mb-2">
                            {kidReminders.map(r => (
                              <li key={r.id} className="flex items-center gap-1.5 flex-row-reverse">
                                <input type="checkbox" checked={false} onChange={() => deleteReminder(r.id)}
                                  className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"
                                  style={{ accentColor: theme.accent }} />
                                <span className="flex-1 text-xs text-right"
                                  style={{ color: theme.dark ? '#ccc' : theme.textColor }}>{r.text}</span>
                                <button onClick={() => deleteReminder(r.id)}
                                  className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0 leading-none">×</button>
                              </li>
                            ))}
                          </ul>
                          <div className="flex gap-1.5 flex-row-reverse">
                            <input type="text" value={newReminder[kid.key]||''}
                              onChange={e => setNewReminder(p=>({...p,[kid.key]:e.target.value}))}
                              onKeyDown={e => e.key==='Enter' && addReminder(kid.key)}
                              placeholder="הוסף תזכורת..." dir="rtl"
                              className="flex-1 border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none min-w-0"
                              style={{
                                borderColor: theme.border + '88',
                                background: theme.dark ? '#2a2a3a' : 'white',
                                color: theme.dark ? '#eee' : '#333'
                              }} />
                            <button onClick={() => addReminder(kid.key)}
                              disabled={!newReminder[kid.key]?.trim()}
                              className="text-white text-xs font-black px-3 py-1.5 rounded-xl disabled:opacity-40 transition shadow-sm"
                              style={{ background: theme.accent }}>+</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
