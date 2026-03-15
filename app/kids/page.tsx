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
  dark?: boolean; label: string
}

interface EventForm {
  title: string; person: string; date: string
  start_time: string; end_time: string
  location: string; notes: string
  is_recurring: boolean; recurrence_days: string[]
  meeting_link: string
}

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const HE_DAYS: Record<string,string> = {
  sunday:'א׳', monday:'ב׳', tuesday:'ג׳', wednesday:'ד׳', thursday:'ה׳', friday:'ו׳', saturday:'ש׳'
}
const HE_DAYS_FULL: Record<string,string> = {
  sunday:'ראשון', monday:'שני', tuesday:'שלישי', wednesday:'רביעי', thursday:'חמישי', friday:'שישי', saturday:'שבת'
}

// ── Per-kid theme packs ────────────────────────────────────────────────────
const THEMES: Record<string, KidTheme[]> = {
  ami: [
    { bg: '#FFF0F3', headerGrad: 'linear-gradient(135deg,#FFB6C1,#FF85A1)',
      border: '#FF85A1', accent: '#E91E63', textColor: '#880E4F',
      noteBg: '#FCE4EC', noteText: '#880E4F',
      badgeBg: '#F8BBD9', badgeText: '#880E4F', cardBg: '#FFF0F3', label: '👑 פרינסס' },
    { bg: '#FFFDE7', headerGrad: 'linear-gradient(135deg,#FFD54F,#FF8A65)',
      border: '#FFB300', accent: '#F57F17', textColor: '#E65100',
      noteBg: '#FFF8E1', noteText: '#E65100',
      badgeBg: '#FFE082', badgeText: '#BF360C', cardBg: '#FFFDE7', label: '🌈 רינבו' },
    { bg: '#F3E5F5', headerGrad: 'linear-gradient(135deg,#CE93D8,#9575CD)',
      border: '#AB47BC', accent: '#7B1FA2', textColor: '#4A148C',
      noteBg: '#EDE7F6', noteText: '#4A148C',
      badgeBg: '#E1BEE7', badgeText: '#4A148C', cardBg: '#F3E5F5', label: '🦄 יוניקורן' },
  ],
  itan: [
    { bg: '#E8F5E9', headerGrad: 'linear-gradient(135deg,#66BB6A,#1B5E20)',
      border: '#43A047', accent: '#1B5E20', textColor: '#1B5E20',
      noteBg: '#F1F8E9', noteText: '#33691E',
      badgeBg: '#C8E6C9', badgeText: '#1B5E20', cardBg: '#F9FBE7', label: '⚽ ספורט' },
    { bg: '#1a1a2e', headerGrad: 'linear-gradient(135deg,#6C3483,#1a1a2e)',
      border: '#A855F7', accent: '#D8B4FE', textColor: '#E9D5FF',
      noteBg: '#2d1b4e', noteText: '#DDD6FE',
      badgeBg: '#4C1D95', badgeText: '#DDD6FE', cardBg: '#16213e', dark: true, label: '🎮 גיימינג' },
    { bg: '#E0F7FA', headerGrad: 'linear-gradient(135deg,#26C6DA,#006064)',
      border: '#00ACC1', accent: '#006064', textColor: '#004D40',
      noteBg: '#E0F2F1', noteText: '#004D40',
      badgeBg: '#B2EBF2', badgeText: '#00363A', cardBg: '#E0F7FA', label: "😎 צ'יל" },
  ],
  alex: [
    { bg: '#F3E5F5', headerGrad: 'linear-gradient(135deg,#AB47BC,#4A148C)',
      border: '#8E24AA', accent: '#4A148C', textColor: '#4A148C',
      noteBg: '#EDE7F6', noteText: '#311B92',
      badgeBg: '#E1BEE7', badgeText: '#4A148C', cardBg: '#FAF5FF', label: '🎵 מוזיקה' },
    { bg: '#FFF3E0', headerGrad: 'linear-gradient(135deg,#FF7043,#BF360C)',
      border: '#FF5722', accent: '#BF360C', textColor: '#BF360C',
      noteBg: '#FBE9E7', noteText: '#BF360C',
      badgeBg: '#FFCCBC', badgeText: '#BF360C', cardBg: '#FFF8F5', label: '🛹 סקייט' },
    { bg: '#ECEFF1', headerGrad: 'linear-gradient(135deg,#546E7A,#263238)',
      border: '#607D8B', accent: '#263238', textColor: '#263238',
      noteBg: '#F5F5F5', noteText: '#37474F',
      badgeBg: '#CFD8DC', badgeText: '#263238', cardBg: '#F8FAFB', label: '🌊 מינימל' },
  ],
}

const ADULT_THEMES: Record<string, KidTheme> = {
  assaf: {
    bg: '#EFF6FF', headerGrad: 'linear-gradient(135deg,#3B82F6,#1E3A8A)',
    border: '#3B82F6', accent: '#1D4ED8', textColor: '#1E3A8A',
    noteBg: '#DBEAFE', noteText: '#1E3A8A',
    badgeBg: '#BFDBFE', badgeText: '#1E3A8A', cardBg: '#EFF6FF', label: '💼 אסף',
  },
  danil: {
    bg: '#F0FDF4', headerGrad: 'linear-gradient(135deg,#4ADE80,#14532D)',
    border: '#22C55E', accent: '#15803D', textColor: '#14532D',
    noteBg: '#DCFCE7', noteText: '#14532D',
    badgeBg: '#BBF7D0', badgeText: '#14532D', cardBg: '#F0FDF4', label: '🌿 דניאל',
  },
}

const KIDS = [
  { key: 'ami',  name: 'אמי',  photo: 'https://i.imgur.com/cG8XKwn.jpeg' as string|null, initials: 'א' },
  { key: 'alex', name: 'אלכס', photo: 'https://i.imgur.com/G0j3TD8.jpeg' as string|null, initials: 'א' },
  { key: 'itan', name: 'איתן', photo: 'https://i.imgur.com/5BKBLqt.jpeg' as string|null, initials: 'א' },
]
const ADULTS = [
  { key: 'assaf', name: 'אסף',   emoji: '💼' },
  { key: 'danil', name: 'דניאל', emoji: '🌿' },
]
const ALL_PEOPLE = [
  { key: 'ami',   name: 'אמי' },
  { key: 'alex',  name: 'אלכס' },
  { key: 'itan',  name: 'איתן' },
  { key: 'assaf', name: 'אסף' },
  { key: 'danil', name: 'דניאל' },
]
const FAMILY_PEOPLE = [
  { key: 'ami',   name: 'אמי',    color: '#E91E63', photo: 'https://i.imgur.com/cG8XKwn.jpeg' as string|null, emoji: '🌸' },
  { key: 'alex',  name: 'אלכס',   color: '#8E24AA', photo: 'https://i.imgur.com/G0j3TD8.jpeg' as string|null, emoji: '🎵' },
  { key: 'itan',  name: 'איתן',   color: '#2E7D32', photo: 'https://i.imgur.com/5BKBLqt.jpeg' as string|null, emoji: '⚽' },
  { key: 'assaf', name: 'אסף',    color: '#1D4ED8', photo: null, emoji: '💼' },
  { key: 'danil', name: 'דניאל',  color: '#15803D', photo: null, emoji: '🌿' },
]

type TabKey = 'family' | 'kids' | 'assaf' | 'danil' | 'stats'
const TABS = [
  { key: 'family' as TabKey, label: '🏠 משפחה' },
  { key: 'kids'   as TabKey, label: '👧👦 ילדים' },
  { key: 'assaf'  as TabKey, label: '💼 אסף' },
  { key: 'danil'  as TabKey, label: '🌿 דניאל' },
  { key: 'stats'  as TabKey, label: '📊 תובנות AI' },
]

const INSIGHT_STYLES: Record<string,{ bg: string; border: string; dot: string; titleColor: string }> = {
  warning:    { bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444', titleColor: '#991B1B' },
  connection: { bg: '#F5F3FF', border: '#DDD6FE', dot: '#7C3AED', titleColor: '#4C1D95' },
  tip:        { bg: '#EFF6FF', border: '#BFDBFE', dot: '#2563EB', titleColor: '#1E3A8A' },
  info:       { bg: '#F9FAFB', border: '#E5E7EB', dot: '#6B7280', titleColor: '#374151' },
}

// ── Live clock ─────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span dir="ltr" className="font-mono font-black text-gray-700 text-xl tabular-nums">
      {format(now, 'HH:mm:ss')}
    </span>
  )
}

// ── KidAvatar ──────────────────────────────────────────────────────────────
function KidAvatar({ kid, theme, onClick }: {
  kid: typeof KIDS[0]; theme: KidTheme; onClick: () => void
}) {
  const size = 160
  return (
    <button onClick={onClick} title={`לחץ לשנות עיצוב (${theme.label})`}
      className="relative flex-shrink-0 rounded-full focus:outline-none transition-transform active:scale-95 hover:scale-105"
      style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full"
        style={{ boxShadow: `0 0 0 3px ${theme.border}, 0 0 12px ${theme.border}66` }} />
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: theme.dark ? '#2d2d2d' : theme.bg, border: `3px solid ${theme.border}` }}>
        {kid.photo
          ? <img src={kid.photo} alt={kid.name} className="w-full h-full object-cover" />
          : <span style={{ fontSize: 36 }}>{kid.key === 'ami' ? '🌸' : kid.key === 'itan' ? '⚡' : '🎸'}</span>
        }
      </div>
      <div className="absolute -bottom-1 -right-1 text-xs rounded-full px-1.5 py-0.5 font-bold shadow-sm"
        style={{ background: theme.accent, color: '#fff', fontSize: 9 }}>
        {theme.label.split(' ')[0]}
      </div>
    </button>
  )
}

// ── EventCard ──────────────────────────────────────────────────────────────
function EventCard({ event, theme, onToggle, onDelete, onEdit }: {
  event: Event; theme: KidTheme
  onToggle: (e: Event) => void; onDelete: (id: string) => void; onEdit: (e: Event) => void
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
          className="mt-1 w-4 h-4 flex-shrink-0 cursor-pointer rounded" style={{ accentColor: theme.accent }} />
        <div className="flex-1 min-w-0 text-right">
          {(event.start_time || event.is_recurring) && (
            <div className="flex flex-wrap gap-1 flex-row-reverse mb-1">
              {event.start_time && (
                <span className="text-sm px-2.5 py-0.5 rounded-full font-black" dir="ltr"
                  style={{ background: theme.badgeBg, color: theme.badgeText }}>
                  ⏰ {event.start_time.slice(0,5)}{event.end_time ? ` – ${event.end_time.slice(0,5)}` : ''}
                </span>
              )}
              {event.is_recurring && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: theme.badgeBg, color: theme.badgeText }}>🔄 קבוע</span>
              )}
            </div>
          )}
          <div className={`font-black leading-snug mb-1 ${done ? 'line-through' : ''}`}
            style={{ color: done ? '#aaa' : theme.textColor, fontSize: 16 }}>{event.title}</div>
          {event.location && (
            <div className="text-sm flex items-center gap-1 flex-row-reverse mb-1" style={{ color: done ? '#bbb' : theme.accent }}>
              <span>📍</span><span>{event.location}</span>
            </div>
          )}
          {event.notes && (
            <div className="text-sm rounded-xl px-2.5 py-1.5 mt-1 text-right leading-relaxed"
              style={{ background: theme.noteBg, color: done ? '#bbb' : theme.noteText }}>
              <span className="font-bold">📝 </span>{event.notes}
            </div>
          )}
          {event.meeting_link && !done && (
            <a href={event.meeting_link} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-lg mt-1.5 transition-opacity hover:opacity-80"
              style={{ background: theme.accent, color: '#fff' }}>🔗 כניסה לפגישה</a>
          )}
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onEdit(event)} className="text-gray-300 hover:text-blue-500 text-xs" title="ערוך">✏️</button>
          <button onClick={() => onDelete(event.id)} className="text-gray-300 hover:text-red-500 text-xs" title="מחק">🗑️</button>
        </div>
      </div>
    </div>
  )
}

// ── EventModal ─────────────────────────────────────────────────────────────
function EventModal({ form, editing, onClose, onSave, onChange }: {
  form: EventForm; editing: boolean
  onClose: () => void; onSave: () => void; onChange: (f: Partial<EventForm>) => void
}) {
  const cls = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white text-right"
  const lbl = "block text-xs font-bold text-gray-500 mb-1 text-right"
  const toggleDay = (day: string) => onChange({
    recurrence_days: form.recurrence_days.includes(day)
      ? form.recurrence_days.filter(d => d !== day)
      : [...form.recurrence_days, day]
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">{editing ? '✏️ עריכת אירוע' : '➕ הוספת אירוע'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div><label className={lbl}>👤 עבור מי</label>
            <select value={form.person} onChange={e => onChange({ person: e.target.value })} className={cls}>
              <option value="">— בחר —</option>
              {ALL_PEOPLE.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select></div>
          <div><label className={lbl}>📝 כותרת *</label>
            <input type="text" value={form.title} onChange={e => onChange({ title: e.target.value })} placeholder="שם האירוע..." className={cls} /></div>
          <div><label className={lbl}>📅 תאריך</label>
            <input type="date" value={form.date} onChange={e => onChange({ date: e.target.value })} className={cls} dir="ltr" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>⏰ שעת התחלה</label>
              <input type="time" value={form.start_time} onChange={e => onChange({ start_time: e.target.value })} className={cls} dir="ltr" /></div>
            <div><label className={lbl}>⏰ שעת סיום</label>
              <input type="time" value={form.end_time} onChange={e => onChange({ end_time: e.target.value })} className={cls} dir="ltr" /></div>
          </div>
          <div><label className={lbl}>📍 מיקום</label>
            <input type="text" value={form.location} onChange={e => onChange({ location: e.target.value })} placeholder="כתובת / שם מקום..." className={cls} /></div>
          <div><label className={lbl}>📋 פרטים נוספים</label>
            <textarea value={form.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="מה להביא, הוראות, הערות..." rows={3} className={cls + ' resize-none'} /></div>
          <div><label className={lbl}>🔗 קישור לפגישה (אופציונלי)</label>
            <input type="url" value={form.meeting_link} onChange={e => onChange({ meeting_link: e.target.value })} placeholder="https://..." className={cls} dir="ltr" /></div>
          <div className="rounded-2xl border-2 border-gray-100 p-3">
            <label className="flex items-center gap-2 cursor-pointer flex-row-reverse justify-end">
              <span className="text-sm font-bold text-gray-700">אירוע קבוע (חוזר)</span>
              <input type="checkbox" checked={form.is_recurring} onChange={e => onChange({ is_recurring: e.target.checked })} className="w-5 h-5 cursor-pointer" style={{ accentColor: '#3B82F6' }} />
            </label>
            {form.is_recurring && (
              <div className="mt-3">
                <div className="text-xs font-bold text-gray-500 mb-2 text-right">ימי חזרה:</div>
                <div className="flex flex-wrap gap-1.5 flex-row-reverse">
                  {DAY_NAMES.map(day => (
                    <button key={day} onClick={() => toggleDay(day)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${form.recurrence_days.includes(day) ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {HE_DAYS[day]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-row-reverse">
          <button onClick={onSave} disabled={!form.title.trim() || !form.person}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black py-2.5 rounded-2xl transition shadow-md text-sm">
            {editing ? '💾 שמור שינויים' : '✅ הוסף אירוע'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition">ביטול</button>
        </div>
      </div>
    </div>
  )
}

// ── Standalone Reminders Panel ──────────────────────────────────────────────
function RemindersPanel({ reminders, newVal, loading, onNewChange, onAdd, onDelete }: {
  reminders: Reminder[]; newVal: string; loading: boolean
  onNewChange: (v: string) => void; onAdd: () => void; onDelete: (id: string) => void
}) {
  return (
    <div className="mt-6 max-w-2xl mx-auto no-print">
      <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-amber-100">
        <div className="px-4 py-3 flex items-center gap-2 flex-row-reverse"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)' }}>
          <span className="text-lg">📋</span>
          <span className="font-black text-white text-sm flex-1 text-right">תזכורות</span>
          {reminders.length > 0 && (
            <span className="bg-white/30 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-black">{reminders.length}</span>
          )}
        </div>
        <div className="px-4 py-3">
          {!loading && reminders.length === 0 && (
            <p className="text-sm text-center text-gray-300 py-1 mb-2">אין תזכורות</p>
          )}
          <ul className="space-y-2 mb-3">
            {reminders.map(r => (
              <li key={r.id} className="flex items-center gap-2 flex-row-reverse">
                <input type="checkbox" checked={false} onChange={() => onDelete(r.id)}
                  className="w-4 h-4 cursor-pointer flex-shrink-0" style={{ accentColor: '#F59E0B' }} />
                <span className="flex-1 text-sm text-right text-gray-700">{r.text}</span>
                <button onClick={() => onDelete(r.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 flex-row-reverse">
            <input type="text" value={newVal} onChange={e => onNewChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAdd()}
              placeholder="הוסף תזכורת..." dir="rtl"
              className="flex-1 border-2 border-amber-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 min-w-0 bg-amber-50/40" />
            <button onClick={onAdd} disabled={!newVal.trim()}
              className="text-white text-sm font-black px-4 py-2 rounded-xl disabled:opacity-40 transition shadow-sm"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)' }}>+</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function KidsSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [activeTab, setActiveTab] = useState<TabKey>('family')
  const [events, setEvents] = useState<Event[]>([])

  // Standalone reminders — not tied to any date or person
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newReminder, setNewReminder] = useState('')
  const [loadingReminders, setLoadingReminders] = useState(true)

  const [loadingEvents, setLoadingEvents] = useState(true)
  const [kidThemeIdx, setKidThemeIdx] = useState<Record<string,number>>({ami:0,alex:0,itan:0})

  // Event modal
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event|null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const emptyForm = useCallback((person = ''): EventForm => ({
    title:'', person, date: format(selectedDate,'yyyy-MM-dd'),
    start_time:'', end_time:'', location:'', notes:'',
    is_recurring: false, recurrence_days: [], meeting_link:''
  }), [selectedDate])
  const [eventForm, setEventForm] = useState<EventForm>(() => emptyForm())

  // Dashboard / AI insights
  const [dashStats, setDashStats] = useState<any>(null)
  const [dashInsights, setDashInsights] = useState<any[]>([])
  const [loadingDash, setLoadingDash] = useState(false)
  const [dashWeekDate, setDashWeekDate] = useState('')

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

  // Load ALL standalone reminders (not tied to date)
  const loadReminders = useCallback(async () => {
    setLoadingReminders(true)
    try {
      const res = await fetch('/api/reminders?general=true')
      if (res.ok) setReminders(await res.json())
    } finally { setLoadingReminders(false) }
  }, [])

  const loadDashboard = useCallback(async (dateOverride?: string) => {
    setLoadingDash(true)
    try {
      const d = dateOverride || dateStr
      const res = await fetch(`/api/insights?date=${d}`)
      if (res.ok) {
        const data = await res.json()
        setDashStats(data.stats)
        setDashInsights(data.insights)
        setDashWeekDate(d)
      }
    } finally { setLoadingDash(false) }
  }, [dateStr])

  useEffect(() => { loadEvents() }, [loadEvents])
  useEffect(() => { loadReminders() }, [loadReminders])

  useEffect(() => {
    if (activeTab === 'stats') loadDashboard()
  }, [activeTab]) // eslint-disable-line

  // Events CRUD
  function openAddEvent(person = '') {
    setEditingEvent(null); setEventForm(emptyForm(person)); setShowModal(true)
  }
  function openEditEvent(event: Event) {
    setEditingEvent(event)
    setEventForm({
      title: event.title, person: event.person, date: event.date,
      start_time: event.start_time||'', end_time: event.end_time||'',
      location: event.location||'', notes: event.notes||'',
      is_recurring: event.is_recurring, recurrence_days: event.recurrence_days||[],
      meeting_link: event.meeting_link||''
    })
    setShowModal(true)
  }
  async function saveEvent() {
    if (!eventForm.title.trim() || !eventForm.person) return
    setSavingEvent(true)
    try {
      const payload = { ...eventForm,
        start_time: eventForm.start_time||null, end_time: eventForm.end_time||null,
        location: eventForm.location||null, notes: eventForm.notes||null,
        meeting_link: eventForm.meeting_link||null,
        recurrence_days: eventForm.is_recurring ? eventForm.recurrence_days : null,
      }
      if (editingEvent) {
        const res = await fetch(`/api/events?id=${editingEvent.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
        if (res.ok) { const updated = await res.json(); setEvents(prev => prev.map(e => e.id===editingEvent.id ? {...e,...updated} : e)) }
      } else {
        const res = await fetch('/api/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
        if (res.ok) { const created = await res.json(); if (!created.duplicate) setEvents(prev => [...prev, created]) }
      }
      setShowModal(false)
    } finally { setSavingEvent(false) }
  }
  async function toggleEvent(event: Event) {
    setEvents(prev => prev.map(e => e.id===event.id ? {...e, completed:!e.completed} : e))
    await fetch(`/api/events?id=${event.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({completed:!event.completed}) })
  }
  async function deleteEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id!==id))
    await fetch(`/api/events?id=${id}`, { method:'DELETE' })
  }

  // Reminders CRUD (standalone — no person/date)
  async function addReminder() {
    const text = newReminder.trim(); if (!text) return
    const res = await fetch('/api/reminders', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date: format(new Date(),'yyyy-MM-dd'), person: null, text, completed: false }) })
    if (res.ok) { const data = await res.json(); setReminders(prev => [...prev, data]); setNewReminder('') }
  }
  async function deleteReminder(id: string) {
    setReminders(prev => prev.filter(r => r.id!==id))
    await fetch(`/api/reminders?id=${id}`, { method:'DELETE' })
  }

  // Helpers
  function getPersonEvents(key: string) {
    return events.filter(e => {
      if (e.person !== key) return false
      if (e.is_recurring && e.recurrence_days) return e.recurrence_days.includes(dayOfWeek)
      return e.date === dateStr
    }).sort((a,b) => (a.start_time??'').localeCompare(b.start_time??''))
  }

  const dateLabel = format(selectedDate, 'EEEE, d בMMMM yyyy', { locale: he })

  // Dashboard helpers
  const PERSON_NAMES: Record<string,string> = { ami:'אמי', alex:'אלכס', itan:'איתן', assaf:'אסף', danil:'דניאל' }
  const PERSON_COLORS: Record<string,string> = { ami:'#E91E63', alex:'#8E24AA', itan:'#2E7D32', assaf:'#1D4ED8', danil:'#15803D' }

  function heatmapColor(personKey: string, count: number) {
    if (count === 0) return { bg: '#F3F4F6', text: '#D1D5DB' }
    const c = PERSON_COLORS[personKey] || '#6B7280'
    const alphas = ['33','66','99','cc']
    const alpha = alphas[Math.min(count - 1, 3)]
    return { bg: c + alpha, text: count >= 3 ? c : c }
  }

  return (
    <>
      <style>{`
        body { background: #F0F4F8; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          nav, header { display: none !important; }
          .print-table { display: block !important; }
          .screen-only { display: none !important; }
          @page { size: A4 landscape; margin: 5mm; }
        }
        @media screen { .print-table { display: none; } }
      `}</style>

      {showModal && (
        <EventModal form={eventForm} editing={!!editingEvent}
          onClose={() => setShowModal(false)} onSave={saveEvent}
          onChange={patch => setEventForm(prev => ({ ...prev, ...patch }))} />
      )}

      {/* ── PRINT ──────────────────────────────────────────────────────── */}
      <div className="print-table w-full">
        <div style={{ fontFamily: 'Arial, sans-serif', direction: 'rtl', fontSize: 15 }}>
          <div style={{ textAlign: 'center', marginBottom: 6, borderBottom: '2.5px solid #000', paddingBottom: 5 }}>
            <div style={{ fontSize: 24, fontWeight: 900 }}>📅 לו&quot;ז משפחת אלוני — {format(selectedDate, 'd.M.yyyy', { locale: he })}</div>
            <div style={{ fontSize: 14, color: '#444', marginTop: 2 }}>{dateLabel}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {KIDS.map(kid => {
              const evs = getPersonEvents(kid.key)
              return (
                <div key={kid.key} style={{ border: '2px solid #222', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ background: '#222', color: '#fff', padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{kid.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>{evs.length === 0 ? 'יום חופשי' : `${evs.length} פעילויות`}</div>
                  </div>
                  <div style={{ padding: '6px 8px', minHeight: 40 }}>
                    {evs.length === 0 ? <div style={{ color: '#bbb', textAlign: 'center', fontSize: 14, padding: '8px 0' }}>—</div>
                    : evs.map((ev, i) => (
                      <div key={ev.id} style={{ marginBottom: i<evs.length-1?7:0, paddingBottom: i<evs.length-1?7:0, borderBottom: i<evs.length-1?'1px dashed #ccc':'none' }}>
                        <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>{ev.title}</div>
                        {ev.start_time && <div style={{ fontSize: 13, color: '#333', marginTop: 2 }} dir="ltr">⏰ {ev.start_time.slice(0,5)}{ev.end_time?`–${ev.end_time.slice(0,5)}`:''}</div>}
                        {ev.location && <div style={{ fontSize: 13, color: '#333', marginTop: 1 }}>📍 {ev.location}</div>}
                        {ev.notes && <div style={{ fontSize: 12, color: '#555', marginTop: 2, background: '#f5f5f5', padding: '2px 5px', borderRadius: 3 }}>📝 {ev.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── SCREEN ─────────────────────────────────────────────────────── */}
      <div className="screen-only max-w-6xl mx-auto px-3 pb-12">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 no-print gap-2 flex-row-reverse flex-wrap">
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-gray-800 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-gray-600 transition shadow-md whitespace-nowrap">🖨️ הדפס</button>
            <button onClick={() => openAddEvent(activeTab !== 'kids' && activeTab !== 'family' && activeTab !== 'stats' ? activeTab : '')}
              className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition shadow-md whitespace-nowrap">➕ הוסף אירוע</button>
          </div>
          <div className="flex items-center gap-2 flex-row-reverse flex-wrap">
            <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow text-xl font-bold">›</button>
            <input type="date" value={dateStr} onChange={e => setSelectedDate(new Date(e.target.value + 'T12:00:00'))} className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm" />
            <button onClick={() => setSelectedDate(d => subDays(d, 1))} className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow text-xl font-bold">‹</button>
            <button onClick={() => setSelectedDate(new Date())} className="text-sm font-bold bg-white border-2 border-amber-400 text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-xl shadow-sm transition">היום</button>
          </div>
        </div>

        {/* Date + clock */}
        <div className="text-center mb-4 no-print">
          <div className="inline-block bg-white rounded-3xl shadow-md px-8 py-4 border border-gray-100">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">📅 לו&quot;ז משפחת אלוני — {format(selectedDate, 'd בMMMM', { locale: he })}</h1>
            <p className="text-sm text-gray-500 mt-1">{dateLabel}</p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-xs text-gray-400">שעה עכשיו:</span><LiveClock />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 justify-center no-print flex-wrap">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-sm ${activeTab===tab.key ? 'bg-gray-800 text-white shadow-md scale-105' : 'bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── FAMILY TAB ─────────────────────────────────────────────── */}
        {activeTab === 'family' && (
          <div className="max-w-4xl mx-auto">
            <div className="rounded-3xl mb-4 px-6 py-5 text-center shadow-md"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f,#1e3a5f)' }}>
              <div className="text-3xl font-black text-white mb-1">🏠 משפחת אלוני</div>
              <div className="text-blue-200 text-sm">{dateLabel}</div>
              <div className="flex justify-center gap-4 mt-3 text-blue-100 text-xs">
                <span>👥 {FAMILY_PEOPLE.filter(p => getPersonEvents(p.key).length > 0).length} עם אירועים</span>
                <span>📋 {FAMILY_PEOPLE.reduce((s,p) => s+getPersonEvents(p.key).length, 0)} אירועים סה&quot;כ</span>
              </div>
            </div>
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100">
              {FAMILY_PEOPLE.map((person, idx) => {
                const evs = getPersonEvents(person.key)
                return (
                  <div key={person.key} className={`flex items-stretch flex-row-reverse min-h-[80px] ${idx>0?'border-t border-gray-100':''}`}>
                    <div className="flex-shrink-0 w-32 sm:w-40 flex flex-col items-center justify-center py-3 px-2 gap-2"
                      style={{ background: `${person.color}12`, borderRight: `5px solid ${person.color}` }}>
                      {person.photo
                        ? <img src={person.photo} alt={person.name} className="w-14 h-14 rounded-full object-cover shadow-sm" style={{ border: `3px solid ${person.color}` }} />
                        : <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-sm" style={{ background: `${person.color}22`, border: `3px solid ${person.color}` }}>{person.emoji}</div>
                      }
                      <div className="text-center">
                        <div className="font-black text-sm" style={{ color: person.color }}>{person.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{evs.length>0?`${evs.length} אירועים`:'חופשי'}</div>
                      </div>
                    </div>
                    <div className={`flex-1 px-4 py-3 flex flex-wrap gap-2 items-center content-center ${evs.length===0?'opacity-50':''}`}>
                      {evs.length===0 ? (
                        <div className="flex items-center gap-2 text-gray-400"><span className="text-xl">🎉</span><span className="text-sm font-medium">אין אירועים היום</span></div>
                      ) : evs.map(ev => (
                        <div key={ev.id} className="rounded-2xl overflow-hidden shadow-sm flex-shrink-0 max-w-[200px] group/ev relative"
                          style={{ border: `1.5px solid ${person.color}44` }}>
                          {ev.start_time && (
                            <div className="px-2.5 py-0.5 text-xs font-black text-white text-center" dir="ltr" style={{ background: person.color }}>
                              {ev.start_time.slice(0,5)}{ev.end_time?` – ${ev.end_time.slice(0,5)}`:''}
                            </div>
                          )}
                          <div className="px-2.5 py-2 bg-white">
                            <div className="font-bold text-sm text-gray-800 text-right leading-snug">{ev.title}</div>
                            {ev.location && <div className="text-xs text-gray-500 text-right mt-0.5 flex items-center gap-1 flex-row-reverse"><span>📍</span><span className="truncate">{ev.location}</span></div>}
                            {ev.notes && <div className="text-xs text-amber-700 rounded-lg px-1.5 py-0.5 mt-1 text-right leading-snug" style={{ background: '#FEF3C7' }}>📝 {ev.notes}</div>}
                          </div>
                          <div className="absolute top-1 left-1 hidden group-hover/ev:flex gap-0.5">
                            <button onClick={() => openEditEvent(ev)} className="w-5 h-5 rounded-full bg-white shadow text-xs flex items-center justify-center hover:bg-blue-50">✏️</button>
                            <button onClick={() => deleteEvent(ev.id)} className="w-5 h-5 rounded-full bg-white shadow text-xs flex items-center justify-center hover:bg-red-50">🗑️</button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => openAddEvent(person.key)}
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all opacity-30 hover:opacity-100 border-2 border-dashed"
                        style={{ borderColor: person.color, color: person.color }} title={`הוסף אירוע ל${person.name}`}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── KIDS TAB ───────────────────────────────────────────────── */}
        {activeTab === 'kids' && (
          loadingEvents ? <div className="text-center py-16 text-gray-400 text-xl">⏳ טוען...</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {KIDS.map(kid => {
                const theme = THEMES[kid.key][kidThemeIdx[kid.key]]
                const evs = getPersonEvents(kid.key)
                return (
                  <div key={kid.key} className="rounded-3xl overflow-hidden shadow-lg flex flex-col"
                    style={{ background: theme.bg, border: `2px solid ${theme.border}44` }}>
                    <div className="px-5 pt-5 pb-4 flex items-center gap-4 flex-row-reverse" style={{ background: theme.headerGrad }}>
                      <KidAvatar kid={kid} theme={theme} onClick={() => cycleTheme(kid.key)} />
                      <div className="flex-1 text-right">
                        <div className="font-black text-2xl text-white drop-shadow">{kid.name}</div>
                        <div className="text-white/70 text-xs mt-0.5">{evs.length===0?'יום חופשי 🎉':`${evs.length} פעילויות היום`}</div>
                        <div className="text-white/60 text-xs mt-1">לחץ על התמונה לשנות עיצוב</div>
                        <button onClick={() => openAddEvent(kid.key)} className="mt-2 text-xs font-black px-3 py-1 rounded-xl transition"
                          style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>➕ הוסף אירוע</button>
                      </div>
                    </div>
                    <div className="flex-1 px-3 pt-3 pb-3">
                      {evs.length===0 ? <div className="text-center py-8 text-4xl opacity-30">🎈</div>
                      : evs.map(ev => <EventCard key={ev.id} event={ev} theme={theme} onToggle={toggleEvent} onDelete={deleteEvent} onEdit={openEditEvent} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── ADULT TABS ─────────────────────────────────────────────── */}
        {(activeTab==='assaf'||activeTab==='danil') && (() => {
          const adult = ADULTS.find(a => a.key===activeTab)!
          const theme = ADULT_THEMES[activeTab]
          const evs = getPersonEvents(adult.key)
          return (
            <div className="max-w-2xl mx-auto">
              <div className="rounded-3xl overflow-hidden shadow-lg flex flex-col" style={{ background: theme.bg, border: `2px solid ${theme.border}44` }}>
                <div className="px-6 py-5 flex items-center gap-5 flex-row-reverse" style={{ background: theme.headerGrad }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.5)' }}>{adult.emoji}</div>
                  <div className="flex-1 text-right">
                    <div className="font-black text-3xl text-white drop-shadow">{adult.name}</div>
                    <div className="text-white/70 text-sm mt-1">{evs.length===0?'יום חופשי ✨':`${evs.length} אירועים היום`}</div>
                    <button onClick={() => openAddEvent(adult.key)} className="mt-2 text-xs font-black px-3 py-1 rounded-xl transition"
                      style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>➕ הוסף אירוע</button>
                  </div>
                </div>
                <div className="flex-1 px-4 pt-4 pb-4">
                  {loadingEvents ? <div className="text-center py-8 text-gray-400">⏳ טוען...</div>
                  : evs.length===0 ? <div className="text-center py-10 text-5xl opacity-20">✨</div>
                  : evs.map(ev => <EventCard key={ev.id} event={ev} theme={theme} onToggle={toggleEvent} onDelete={deleteEvent} onEdit={openEditEvent} />)}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── STATS / AI DASHBOARD ───────────────────────────────────── */}
        {activeTab === 'stats' && (
          <div className="max-w-5xl mx-auto">
            {/* Dashboard header */}
            <div className="rounded-3xl mb-5 px-6 py-5 shadow-md flex items-center justify-between flex-row-reverse"
              style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f,#0f172a)' }}>
              <div className="text-right">
                <div className="text-2xl font-black text-white">📊 תובנות AI — משפחת אלוני</div>
                <div className="text-blue-200 text-sm mt-1">
                  {dashStats ? `שבוע ${dashStats.weekDates?.[0]} עד ${dashStats.weekDates?.[6]}` : 'טוען נתוני שבוע...'}
                </div>
              </div>
              <button onClick={() => loadDashboard(dateStr)}
                disabled={loadingDash}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-sm transition flex items-center gap-2">
                {loadingDash ? <><span className="animate-spin">⏳</span> מנתח...</> : '🔄 רענן'}
              </button>
            </div>

            {loadingDash && !dashStats && (
              <div className="text-center py-20">
                <div className="text-5xl mb-4 animate-bounce">🤖</div>
                <div className="text-xl font-bold text-gray-600">Claude מנתח את לוח הזמנים...</div>
                <div className="text-sm text-gray-400 mt-2">מחפש קשרים ותובנות</div>
              </div>
            )}

            {dashStats && (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { icon: '📋', label: 'אירועים השבוע', value: dashStats.totalEvents, color: '#3B82F6' },
                    { icon: '🏆', label: 'הכי עסוק', value: dashStats.busiestPerson ? (PERSON_NAMES[dashStats.busiestPerson]||dashStats.busiestPerson) : '—', color: PERSON_COLORS[dashStats.busiestPerson]||'#6B7280' },
                    { icon: '📅', label: 'יום הכי עמוס', value: dashStats.busiestDay ? HE_DAYS_FULL[DAY_NAMES[new Date(dashStats.busiestDay+'T12:00:00').getDay()]] : '—', color: '#F59E0B' },
                    { icon: '😴', label: 'ימים ריקים', value: dashStats.freeDays?.length ?? 0, color: '#10B981' },
                  ].map((card, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 text-center">
                      <div className="text-2xl mb-1">{card.icon}</div>
                      <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                      <div className="text-xl font-black" style={{ color: card.color }}>{card.value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {/* Weekly heatmap */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4">
                    <h3 className="font-black text-gray-700 text-base mb-3 text-right">🗓️ מפת חום שבועית</h3>
                    {dashStats.weekDates && (
                      <div style={{ direction: 'ltr' }}>
                        {/* Day headers */}
                        <div className="flex gap-1 mb-1">
                          <div className="w-16 flex-shrink-0" />
                          {dashStats.weekDates.map((d: string) => (
                            <div key={d} className="flex-1 text-center text-xs font-bold text-gray-400">
                              {HE_DAYS[DAY_NAMES[new Date(d+'T12:00:00').getDay()]]}
                              <div className="text-gray-300 font-normal">{new Date(d+'T12:00:00').getDate()}</div>
                            </div>
                          ))}
                        </div>
                        {/* Person rows */}
                        {['ami','alex','itan','assaf','danil'].map(personKey => {
                          const fp = FAMILY_PEOPLE.find(p => p.key===personKey)!
                          return (
                            <div key={personKey} className="flex gap-1 mb-1 items-center">
                              <div className="w-16 flex-shrink-0 flex items-center gap-1.5">
                                {fp.photo
                                  ? <img src={fp.photo} alt={fp.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                                  : <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ background: fp.color+'22' }}>{fp.emoji}</div>
                                }
                                <span className="text-xs font-bold text-gray-600 truncate">{fp.name}</span>
                              </div>
                              {dashStats.weekDates.map((d: string) => {
                                const cellEvs = dashStats.grid?.[personKey]?.[d] || []
                                const count = cellEvs.length
                                const { bg, text } = heatmapColor(personKey, count)
                                return (
                                  <div key={d} className="flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all cursor-default"
                                    style={{ background: bg, color: count > 0 ? '#fff' : text }}
                                    title={cellEvs.map((e:any) => e.title).join(', ') || 'אין אירועים'}>
                                    {count > 0 ? count : ''}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                        {/* Legend */}
                        <div className="flex items-center gap-2 mt-3 justify-end">
                          <span className="text-xs text-gray-400">מעט</span>
                          {[1,2,3,4].map(n => (
                            <div key={n} className="w-5 h-5 rounded" style={{ background: `#3B82F6${['33','66','99','cc'][n-1]}` }} />
                          ))}
                          <span className="text-xs text-gray-400">הרבה</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Per-person totals */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4">
                    <h3 className="font-black text-gray-700 text-base mb-3 text-right">👥 עומס לפי אדם</h3>
                    {dashStats.personTotals && (
                      <div className="space-y-3">
                        {FAMILY_PEOPLE.map(fp => {
                          const total = dashStats.personTotals[fp.key] || 0
                          const max = Math.max(...Object.values(dashStats.personTotals as Record<string,number>)) || 1
                          return (
                            <div key={fp.key} className="flex items-center gap-3 flex-row-reverse">
                              <div className="w-16 text-right flex-shrink-0">
                                {fp.photo
                                  ? <img src={fp.photo} alt={fp.name} className="w-8 h-8 rounded-full object-cover inline-block ml-1" />
                                  : <span className="text-lg">{fp.emoji}</span>
                                }
                                <span className="text-xs font-black" style={{ color: fp.color }}>{fp.name}</span>
                              </div>
                              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                                  style={{ width: `${(total/max)*100}%`, background: fp.color, minWidth: total>0?'32px':'0' }}>
                                  {total > 0 && <span className="text-white text-xs font-black">{total}</span>}
                                </div>
                              </div>
                              {total === 0 && <span className="text-xs text-gray-400 flex-shrink-0">חופשי</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Insights */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-5">
                  <div className="flex items-center gap-2 flex-row-reverse mb-4">
                    <h3 className="font-black text-gray-700 text-base">🤖 תובנות של Claude AI</h3>
                    {loadingDash && <span className="text-xs text-blue-500 animate-pulse">מנתח...</span>}
                  </div>
                  {dashInsights.length === 0 && !loadingDash ? (
                    <div className="text-center text-gray-400 py-4">
                      <div className="text-3xl mb-2">🔍</div>
                      <div className="text-sm">לחץ רענן כדי לקבל תובנות AI</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {dashInsights.map((insight: any, i: number) => {
                        const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info
                        return (
                          <div key={i} className="rounded-2xl p-4 border" style={{ background: style.bg, borderColor: style.border }}>
                            <div className="flex items-start gap-2 flex-row-reverse">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                                style={{ background: style.dot + '22' }}>{insight.icon}</div>
                              <div className="flex-1 text-right">
                                <div className="font-black text-sm mb-1" style={{ color: style.titleColor }}>{insight.title}</div>
                                <div className="text-xs leading-relaxed text-gray-600">{insight.text}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Conflicts */}
                {dashStats.conflicts?.length > 0 && (
                  <div className="bg-red-50 rounded-3xl border border-red-200 p-4 mb-5">
                    <h3 className="font-black text-red-700 text-base mb-3 text-right">⚠️ ניגודי זמנים שזוהו</h3>
                    <ul className="space-y-1">
                      {dashStats.conflicts.map((c: string, i: number) => (
                        <li key={i} className="text-sm text-red-600 text-right flex items-start gap-2 flex-row-reverse">
                          <span className="flex-shrink-0">🔴</span><span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STANDALONE REMINDERS — always at bottom ─────────────────── */}
        <RemindersPanel
          reminders={reminders} newVal={newReminder} loading={loadingReminders}
          onNewChange={setNewReminder} onAdd={addReminder} onDelete={deleteReminder} />

      </div>
    </>
  )
}
