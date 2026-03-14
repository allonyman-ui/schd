'use client'

import { useState, useEffect } from 'react'

const PERSON_OPTIONS = ['alex', 'itan', 'ami', 'danil', 'assaf']
const PERSON_LABELS: Record<string, string> = {
  alex: 'אלכס', itan: 'איתן', ami: 'אמי', danil: 'דניאל', assaf: 'אסף'
}
const PERSON_COLORS: Record<string, string> = {
  alex: 'bg-blue-100 text-blue-800',
  itan: 'bg-green-100 text-green-800',
  ami: 'bg-purple-100 text-purple-800',
  danil: 'bg-orange-100 text-orange-800',
  assaf: 'bg-pink-100 text-pink-800',
}

interface ExtractedEvent {
  person: string
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  notes: string | null
  is_recurring: boolean
  recurrence_days: string[] | null
  meeting_link: string | null
  action?: string
  original_title?: string | null
}

interface BatchHistory {
  id: string
  raw_text: string
  processed_events: ExtractedEvent[]
  created_at: string
}

function formatDate(d: string) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
  } catch { return d }
}

function EventPreviewCard({
  ev, index, onUpdate, onRemove, needsFix
}: {
  ev: ExtractedEvent
  index: number
  onUpdate: (idx: number, field: string, value: string) => void
  onRemove: (idx: number) => void
  needsFix: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-xl border p-4 ${needsFix ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <button
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-500 transition text-lg leading-none flex-shrink-0 mt-0.5"
          title="הסר אירוע"
        >×</button>
        <div className="flex-1 text-right">
          <div className="font-semibold text-gray-800 text-base">{ev.title}</div>
          {needsFix && (
            <div className="text-xs text-orange-600 mt-0.5">⚠️ יש להשלים פרטים חסרים</div>
          )}
        </div>
      </div>

      {/* Person + Date row */}
      <div className="flex gap-2 flex-row-reverse flex-wrap mb-3">
        {/* Person */}
        <div className="flex flex-col gap-1 min-w-[100px]">
          <label className="text-xs text-gray-500 text-right">ילד/ה {!ev.person && <span className="text-red-500">*</span>}</label>
          <select
            value={ev.person || ''}
            onChange={e => onUpdate(index, 'person', e.target.value)}
            className={`border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${!ev.person ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'}`}
            dir="rtl"
          >
            <option value="">בחר...</option>
            {PERSON_OPTIONS.map(p => (
              <option key={p} value={p}>{PERSON_LABELS[p]}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 text-right">תאריך {!ev.date && <span className="text-red-500">*</span>}</label>
          <input
            type="date"
            value={ev.date || ''}
            onChange={e => onUpdate(index, 'date', e.target.value)}
            className={`border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${!ev.date ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'}`}
          />
        </div>

        {/* Time */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 text-right">שעת התחלה</label>
          <input
            type="time"
            value={ev.start_time || ''}
            onChange={e => onUpdate(index, 'start_time', e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
        </div>

        {/* End time */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 text-right">שעת סיום</label>
          <input
            type="time"
            value={ev.end_time || ''}
            onChange={e => onUpdate(index, 'end_time', e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-1.5 flex-row-reverse mb-2">
        {ev.person && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PERSON_COLORS[ev.person] || 'bg-gray-100 text-gray-700'}`}>
            {PERSON_LABELS[ev.person] || ev.person}
          </span>
        )}
        {ev.date && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">📅 {formatDate(ev.date)}</span>
        )}
        {ev.start_time && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">⏰ {ev.start_time}{ev.end_time ? `–${ev.end_time}` : ''}</span>
        )}
        {ev.is_recurring && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🔄 קבוע</span>
        )}
        {ev.action === 'cancel' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">❌ ביטול</span>
        )}
      </div>

      {/* Location */}
      {ev.location && (
        <div className="flex items-center gap-1.5 justify-end text-sm text-gray-600 mb-1.5">
          <span>{ev.location}</span>
          <span>📍</span>
        </div>
      )}

      {/* Meeting link */}
      {ev.meeting_link && (
        <div className="flex items-center gap-1.5 justify-end text-sm mb-1.5">
          <a href={ev.meeting_link} target="_blank" rel="noreferrer" className="text-blue-600 underline truncate max-w-[200px]">
            {ev.meeting_link}
          </a>
          <span>🔗</span>
        </div>
      )}

      {/* Notes */}
      {ev.notes && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-sm text-gray-700 text-right mt-2">
          <span className="font-medium text-yellow-700">📝 הערות: </span>{ev.notes}
        </div>
      )}

      {/* Expand to edit title/location/notes */}
      <button
        onClick={() => setExpanded(x => !x)}
        className="text-xs text-gray-400 hover:text-gray-600 mt-2 block mr-auto"
      >
        {expanded ? '▲ פחות עריכה' : '▼ ערוך פרטים נוספים'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 text-right">כותרת</label>
            <input
              type="text"
              value={ev.title || ''}
              onChange={e => onUpdate(index, 'title', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              dir="rtl"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 text-right">מיקום</label>
            <input
              type="text"
              value={ev.location || ''}
              onChange={e => onUpdate(index, 'location', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              dir="rtl"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 text-right">הערות / מה להביא</label>
            <textarea
              value={ev.notes || ''}
              onChange={e => onUpdate(index, 'notes', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none h-20"
              dir="rtl"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 text-right">קישור פגישה</label>
            <input
              type="url"
              value={ev.meeting_link || ''}
              onChange={e => onUpdate(index, 'meeting_link', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              dir="ltr"
              placeholder="https://..."
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function InboxPage() {
  const [rawText, setRawText] = useState('')
  const [processing, setProcessing] = useState(false)
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([])
  const [history, setHistory] = useState<BatchHistory[]>([])
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchHistory() }, [])

  async function fetchHistory() {
    const res = await fetch('/api/process-whatsapp')
    if (res.ok) setHistory(await res.json())
  }

  async function handleProcess() {
    if (!rawText.trim()) return
    setProcessing(true)
    setError('')
    setSuccessMsg('')
    setExtractedEvents([])

    try {
      const res = await fetch('/api/process-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      })

      let data
      try { data = await res.json() } catch { data = null }
      if (!res.ok) {
        setError(data?.error || `שגיאת שרת ${res.status}`)
        return
      }

      const events: ExtractedEvent[] = (data.events || []).filter(
        (e: ExtractedEvent) => e.action !== 'cancel'
      )

      if (events.length === 0) {
        setSuccessMsg('לא נמצאו אירועים בהודעה')
        return
      }

      setExtractedEvents(events)
    } catch (err) {
      setError('שגיאת רשת — ודא שהאפליקציה פרוסה ונסה שוב')
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  async function handleSaveAll() {
    const readyEvents = extractedEvents.filter(e => e.person && e.date && e.title)
    if (readyEvents.length === 0) return

    setSaving(true)
    setError('')
    let savedCount = 0
    const errors: string[] = []

    for (const ev of readyEvents) {
      try {
        const r = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...ev, source: 'inbox' }),
        })
        if (r.ok) {
          savedCount++
        } else {
          let msg = `שגיאת שרת ${r.status}`
          try { const d = await r.json(); msg = d.error || msg } catch { /* ignore */ }
          errors.push(`"${ev.title}": ${msg}`)
        }
      } catch (err) {
        errors.push(`"${ev.title}": שגיאת רשת`)
        console.error(err)
      }
    }

    setSaving(false)

    if (savedCount > 0) {
      setSuccessMsg(`✅ נשמרו ${savedCount} אירועים בלו"ז`)
      setExtractedEvents(prev => prev.filter(e => !e.person || !e.date))
      setRawText('')
      fetchHistory()
    }
    if (errors.length > 0) {
      setError('שגיאה בשמירה: ' + errors.join(' | '))
    }
  }

  function updateEvent(idx: number, field: string, value: string) {
    setExtractedEvents(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  function removeEvent(idx: number) {
    setExtractedEvents(prev => prev.filter((_, i) => i !== idx))
  }

  const completeEvents = extractedEvents.filter(e => e.person && e.date && e.title)
  const incompleteEvents = extractedEvents.filter(e => !e.person || !e.date)
  const hasAnyReady = completeEvents.length > 0

  return (
    <div className="max-w-2xl mx-auto px-3 pb-10">
      <h1 className="text-xl font-bold text-gray-800 mb-5 text-right">📥 הכנסת מידע ללו&quot;ז</h1>

      {/* Success */}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm text-right">
          {successMsg}
        </div>
      )}

      {/* Input */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1 text-right">הדבק טקסט</h2>
        <p className="text-xs text-gray-400 mb-3 text-right">
          הדבק הודעה מוואטסאפ, מייל, סמס, או כל טקסט עם מידע על אירועים. הבינה המלאכותית תחלץ את כל הפרטים.
        </p>
        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm h-36 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder={`לדוגמה:\n"שלום הורים, יש חזרה לחג ביום רביעי 19.3 בשעה 16:00 בבית הספר. יש להביא תלבושת לבנה ולא לשכוח את הספר 'שירים לחג'"`}
          dir="rtl"
        />
        {error && <p className="text-red-500 text-sm mt-2 text-right">{error}</p>}
        <div className="flex justify-start mt-3">
          <button
            onClick={handleProcess}
            disabled={processing || !rawText.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
          >
            {processing
              ? <><span className="animate-spin inline-block">⏳</span> מנתח...</>
              : '🔍 נתח ושלוף אירועים'
            }
          </button>
        </div>
      </div>

      {/* Extracted events */}
      {extractedEvents.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {hasAnyReady && (
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {saving
                    ? <><span className="animate-spin inline-block">⏳</span> שומר...</>
                    : `💾 שמור ${completeEvents.length} אירועים ללו"ז`
                  }
                </button>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-base font-semibold text-gray-700">
                נמצאו {extractedEvents.length} אירועים
              </h2>
              {incompleteEvents.length > 0 && (
                <p className="text-xs text-orange-600">{incompleteEvents.length} זקוקים להשלמה</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {extractedEvents.map((ev, i) => (
              <EventPreviewCard
                key={i}
                ev={ev}
                index={i}
                onUpdate={updateEvent}
                onRemove={removeEvent}
                needsFix={!ev.person || !ev.date}
              />
            ))}
          </div>

          {hasAnyReady && (
            <div className="mt-4 flex justify-start">
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving
                  ? <><span className="animate-spin inline-block">⏳</span> שומר...</>
                  : `💾 שמור ${completeEvents.length} אירועים ללו"ז`
                }
              </button>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4 text-right">היסטוריה אחרונה</h2>
          <div className="space-y-3">
            {history.map(batch => (
              <div key={batch.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1 flex-row-reverse">
                  <span className="text-xs text-gray-400">
                    {new Date(batch.created_at).toLocaleString('he-IL')}
                  </span>
                  <span className="text-xs font-medium text-gray-500">
                    {batch.processed_events?.length || 0} אירועים
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 text-right">{batch.raw_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
