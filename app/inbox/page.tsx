'use client'

import { useState, useEffect } from 'react'

const PERSON_OPTIONS = ['ami', 'alex', 'itan', 'danil', 'assaf']
const PERSON_LABELS: Record<string, string> = { alex:'אלכס', itan:'איתן', ami:'אמי', danil:'דניאל', assaf:'אסף' }
const PERSON_COLORS: Record<string, string> = {
  alex:'bg-purple-100 text-purple-800', itan:'bg-green-100 text-green-800',
  ami:'bg-pink-100 text-pink-800', danil:'bg-emerald-100 text-emerald-800', assaf:'bg-blue-100 text-blue-800',
}

interface ExtractedEvent {
  person: string; title: string; date: string
  start_time: string | null; end_time: string | null
  location: string | null; notes: string | null
  is_recurring: boolean; recurrence_days: string[] | null
  meeting_link: string | null; action?: string
}


function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('he-IL', { weekday:'short', day:'numeric', month:'short' }) }
  catch { return d }
}

function EventPreviewCard({ ev, index, onUpdate, onRemove, needsFix }: {
  ev: ExtractedEvent; index: number
  onUpdate: (i: number, f: string, v: string) => void
  onRemove: (i: number) => void; needsFix: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`rounded-2xl border p-4 transition-all ${needsFix ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <button onClick={() => onRemove(index)} className="text-gray-400 hover:text-red-500 text-lg leading-none flex-shrink-0">×</button>
        <div className="flex-1 text-right">
          <div className="font-bold text-gray-800 text-base leading-snug">{ev.title}</div>
          {needsFix && <div className="text-xs text-orange-600 mt-0.5">⚠️ יש להשלים פרטים חסרים</div>}
        </div>
      </div>

      {/* Core fields */}
      <div className="flex gap-2 flex-row-reverse flex-wrap mb-3">
        <div className="flex flex-col gap-1 min-w-[100px]">
          <label className="text-xs text-gray-500 text-right">ל{!ev.person && <span className="text-red-400">*</span>}</label>
          <select value={ev.person||''} onChange={e => onUpdate(index,'person',e.target.value)}
            className={`border rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${!ev.person?'border-orange-400 bg-orange-50':'border-gray-200 bg-white'}`} dir="rtl">
            <option value="">בחר...</option>
            {PERSON_OPTIONS.map(p => <option key={p} value={p}>{PERSON_LABELS[p]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 text-right">תאריך{!ev.date && <span className="text-red-400">*</span>}</label>
          <input type="date" value={ev.date||''} onChange={e => onUpdate(index,'date',e.target.value)}
            className={`border rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${!ev.date?'border-orange-400 bg-orange-50':'border-gray-200 bg-white'}`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 text-right">שעה</label>
          <input type="time" value={ev.start_time||''} onChange={e => onUpdate(index,'start_time',e.target.value)}
            className="border border-gray-200 rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 text-right">סיום</label>
          <input type="time" value={ev.end_time||''} onChange={e => onUpdate(index,'end_time',e.target.value)}
            className="border border-gray-200 rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-1.5 flex-row-reverse mb-2">
        {ev.person && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PERSON_COLORS[ev.person]||'bg-gray-100 text-gray-700'}`}>{PERSON_LABELS[ev.person]||ev.person}</span>}
        {ev.date && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">📅 {formatDate(ev.date)}</span>}
        {ev.start_time && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">⏰ {ev.start_time}{ev.end_time?`–${ev.end_time}`:''}</span>}
        {ev.is_recurring && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🔄 קבוע</span>}
      </div>

      {ev.location && <div className="flex items-center gap-1.5 justify-end text-sm text-gray-600 mb-1.5"><span>{ev.location}</span><span>📍</span></div>}
      {ev.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-sm text-gray-700 text-right mt-2">
          <span className="font-medium text-amber-700">📝 </span>{ev.notes}
        </div>
      )}
      {ev.meeting_link && (
        <div className="flex items-center gap-1.5 justify-end text-sm mt-1.5">
          <a href={ev.meeting_link} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs truncate max-w-[200px]">{ev.meeting_link}</a>
          <span>🔗</span>
        </div>
      )}

      <button onClick={() => setExpanded(x => !x)} className="text-xs text-gray-400 hover:text-gray-600 mt-2 block mr-auto">
        {expanded ? '▲ פחות' : '▼ ערוך פרטים'}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          {[['title','כותרת','text'],['location','מיקום','text'],['notes','הערות / מה להביא','text'],['meeting_link','קישור לפגישה','url']].map(([field, label, type]) => (
            <div key={field} className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 text-right">{label}</label>
              <input type={type} value={(ev as any)[field]||''} onChange={e => onUpdate(index, field, e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" dir={type==='url'?'ltr':'rtl'} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InboxPage() {
  const [rawText, setRawText] = useState('')
  const [processing, setProcessing] = useState(false)
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([])
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // Activity log (always visible at bottom)
  type LogEvent = ExtractedEvent & { _event_id?: string; _deleted?: boolean }
  type BatchItem = {id:string; raw_text:string; processed_events:LogEvent[]; created_at:string}
  const [activityLog, setActivityLog]   = useState<BatchItem[]>([])
  const [logExpanded, setLogExpanded]   = useState(false)
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
  const [editingLogEvent, setEditingLogEvent] = useState<{ batchId: string; evIdx: number; draft: LogEvent } | null>(null)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [logSaving, setLogSaving] = useState(false)

  const loadActivityLog = () => {
    fetch('/api/recent-batches')
      .then(r => r.ok ? r.json() : [])
      .then(d => setActivityLog(d))
      .catch(() => {})
  }

  useEffect(() => { loadActivityLog() }, [])

  async function handleProcess(text: string) {
    if (!text.trim()) return
    setProcessing(true); setError(''); setSuccessMsg(''); setExtractedEvents([])
    try {
      const res = await fetch('/api/process-whatsapp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ rawText: text }),
      })
      let data; try { data = await res.json() } catch { data = null }
      if (!res.ok) { setError(data?.error || `שגיאת שרת ${res.status}`); return }
      const events: ExtractedEvent[] = (data.events||[]).filter((e: ExtractedEvent) => e.action !== 'cancel')
      if (events.length === 0) { setSuccessMsg('לא נמצאו אירועים בטקסט'); return }
      setExtractedEvents(events)
    } catch { setError('שגיאת רשת — ודא שהאפליקציה פרוסה ונסה שוב')
    } finally { setProcessing(false) }
  }

  async function handleSaveAll() {
    const ready = extractedEvents.filter(e => e.person && e.date && e.title)
    if (ready.length===0) return
    setSaving(true); setError('')
    let saved=0; const errs: string[] = []
    for (const ev of ready) {
      try {
        const r = await fetch('/api/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...ev, source:'inbox'}) })
        if (r.ok) {
          const d = await r.json().catch(()=>({}))
          d.duplicate ? errs.push(`"${ev.title}": כבר קיים`) : saved++
        } else {
          let msg = `שגיאת שרת ${r.status}`
          try { const d = await r.json(); msg = d.error||msg } catch {}
          errs.push(`"${ev.title}": ${msg}`)
        }
      } catch { errs.push(`"${ev.title}": שגיאת רשת`) }
    }
    setSaving(false)
    if (saved>0) { setSuccessMsg(`✅ נשמרו ${saved} אירועים בלו"ז!`); setExtractedEvents(prev=>prev.filter(e=>!e.person||!e.date)); setRawText('') }
    if (errs.length>0) setError('שגיאות: '+errs.join(' | '))
  }

  function updateEvent(idx: number, field: string, value: string) {
    setExtractedEvents(prev => prev.map((e,i) => i===idx ? {...e,[field]:value} : e))
  }
  function removeEvent(idx: number) {
    setExtractedEvents(prev => prev.filter((_,i) => i!==idx))
  }

  async function handleLogEventSave(batchId: string, ev: LogEvent) {
    if (!ev._event_id) return
    setLogSaving(true)
    try {
      await fetch(`/api/events?id=${ev._event_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ev.title, person: ev.person, date: ev.date,
          start_time: ev.start_time || null, end_time: ev.end_time || null,
          location: ev.location || null, notes: ev.notes || null,
          is_recurring: ev.is_recurring, recurrence_days: ev.recurrence_days || null,
        }),
      })
      setActivityLog(prev => prev.map(b => b.id !== batchId ? b : {
        ...b,
        processed_events: b.processed_events.map(e =>
          e._event_id === ev._event_id ? ev : e
        ),
      }))
      setEditingLogEvent(null)
    } finally { setLogSaving(false) }
  }

  async function handleLogEventDelete(batchId: string, eventId: string) {
    setDeletingEventId(eventId)
    try {
      await fetch(`/api/events?id=${eventId}`, { method: 'DELETE' })
      setActivityLog(prev => prev.map(b => b.id !== batchId ? b : {
        ...b,
        processed_events: b.processed_events.map(e =>
          e._event_id === eventId ? { ...e, _deleted: true } as LogEvent : e
        ),
      }))
    } finally { setDeletingEventId(null) }
  }

  const complete = extractedEvents.filter(e => e.person && e.date && e.title)
  const incomplete = extractedEvents.filter(e => !e.person || !e.date)

  return (
    <div className="max-w-2xl mx-auto px-3 pb-12" dir="rtl">
      {/* Header */}
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-black text-gray-900">📥 הכנסת מידע ללוח</h1>
        <p className="text-xs text-gray-400 mt-0.5">הדבק כל טקסט — הודעה, מייל, לוח חוגים — Claude יחלץ אירועים</p>
      </div>

      {/* Success / Error */}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-sm text-right font-bold">{successMsg}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm text-right">{error}</div>
      )}

      {/* Input box */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 p-4">
        <textarea value={rawText} onChange={e => setRawText(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm h-36 resize-none focus:outline-none focus:border-amber-400 bg-gray-50"
          placeholder={'הדבק כאן:\n• הודעת WhatsApp מבית ספר\n• מייל עם תאריכים\n• "אמי — שיעור שחייה יום ב׳ 14:00"\n• כל טקסט שמכיל מידע על אירוע'} dir="rtl" />
        <div className="flex gap-2 mt-3">
          <button onClick={() => handleProcess(rawText)} disabled={processing||!rawText.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-40 flex items-center gap-2 text-sm">
            {processing ? <><span className="animate-spin">⏳</span> מנתח...</> : '🤖 חלץ אירועים'}
          </button>
          {rawText && (
            <button onClick={() => { setRawText(''); setExtractedEvents([]); setError(''); setSuccessMsg('') }}
              className="text-gray-400 hover:text-gray-600 text-sm px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-300 transition">
              נקה
            </button>
          )}
        </div>
      </div>

      {/* Extracted events */}
      {extractedEvents.length > 0 && (
        <div className="mb-6">
          {/* Save bar */}
          <div className="flex items-center justify-between mb-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
            <button onClick={handleSaveAll} disabled={saving||complete.length===0}
              className="bg-green-500 hover:bg-green-600 text-white font-bold px-5 py-2 rounded-xl transition disabled:opacity-40 flex items-center gap-2 text-sm">
              {saving ? <><span className="animate-spin">⏳</span> שומר...</> : `💾 שמור ${complete.length} אירועים`}
            </button>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-700">נמצאו {extractedEvents.length} אירועים</div>
              {incomplete.length > 0 && <div className="text-xs text-orange-500">{incomplete.length} זקוקים להשלמה</div>}
            </div>
          </div>

          <div className="space-y-3">
            {extractedEvents.map((ev, i) => (
              <EventPreviewCard key={i} ev={ev} index={i} onUpdate={updateEvent} onRemove={removeEvent} needsFix={!ev.person||!ev.date} />
            ))}
          </div>

          {complete.length > 0 && (
            <button onClick={handleSaveAll} disabled={saving}
              className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl transition disabled:opacity-40 flex items-center justify-center gap-2">
              {saving ? <><span className="animate-spin">⏳</span> שומר...</> : `💾 שמור ${complete.length} אירועים ללו"ז`}
            </button>
          )}
        </div>
      )}

      {/* ── Activity Log ── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 mb-5">
        <button
          onClick={() => { setLogExpanded(x => !x); if (!logExpanded) loadActivityLog() }}
          className="w-full flex items-center justify-between px-5 py-3.5 text-right"
        >
          <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
            {logExpanded ? '▲' : '▼'}
            {activityLog.length > 0 ? `${activityLog.length} פריטים` : ''}
          </span>
          <span className="font-black text-gray-700 text-sm">📋 פעילות אחרונה</span>
        </button>

        {logExpanded && (
          <div className="border-t border-gray-100 px-4 pb-4">
            {activityLog.length === 0 ? (
              <div className="text-center py-4 text-gray-300 text-sm">אין פעילות עדיין</div>
            ) : (
              <div className="space-y-3 mt-3">
                {activityLog.map(batch => {
                  const isWA    = batch.raw_text.startsWith('[WHATSAPP')
                  const isEmail = batch.raw_text.startsWith('[EMAIL')
                  const icon    = isWA ? '💬' : isEmail ? '📧' : '✏️'
                  const source  = isWA ? 'WhatsApp' : isEmail ? 'מייל' : 'ידני'
                  const lines   = batch.raw_text.split('\n').filter(Boolean)
                  // Strip header line for preview
                  const msgLines = lines.slice(isWA || isEmail ? 1 : 0)
                  const preview = msgLines.slice(0, 2).join(' ').slice(0, 90) || '(ללא תוכן)'
                  const fullMsg = (isWA || isEmail) ? lines.slice(1).join('\n').trim() : batch.raw_text
                  const events  = Array.isArray(batch.processed_events) ? batch.processed_events as LogEvent[] : []
                  const activeEvents = events.filter(e => !e._deleted)
                  const dateStr = new Date(batch.created_at).toLocaleDateString('he-IL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
                  const isOpen  = expandedBatches.has(batch.id)

                  return (
                    <div key={batch.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                      {/* Batch header */}
                      <button
                        className="w-full flex items-start gap-3 flex-row-reverse px-3 py-2.5 hover:bg-gray-50 transition text-right"
                        onClick={() => setExpandedBatches(prev => {
                          const next = new Set(prev)
                          next.has(batch.id) ? next.delete(batch.id) : next.add(batch.id)
                          return next
                        })}
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-700 leading-snug line-clamp-2 text-right">{preview}</div>
                          <div className="flex items-center gap-2 justify-end mt-1 flex-wrap">
                            {activeEvents.length > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                                {activeEvents.length} אירועים
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">{source} · {dateStr}</span>
                            <span className="text-[10px] text-gray-300">{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isOpen && (
                        <div className="border-t border-gray-100 bg-gray-50">
                          {/* Full message */}
                          <div className="px-3 pt-3 pb-2">
                            <div className="text-[10px] font-bold text-gray-400 mb-1 text-right">ההודעה המקורית</div>
                            <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto text-right leading-relaxed">
                              {fullMsg}
                            </div>
                          </div>

                          {/* Events list */}
                          {events.length > 0 ? (
                            <div className="px-3 pb-3 space-y-2">
                              <div className="text-[10px] font-bold text-gray-400 text-right">אירועים שנוצרו/עודכנו</div>
                              {events.map((ev, evIdx) => {
                                const isEditingThis = editingLogEvent?.batchId === batch.id && editingLogEvent.evIdx === evIdx
                                const draft = isEditingThis ? editingLogEvent.draft : ev

                                if (ev._deleted) return (
                                  <div key={evIdx} className="flex items-center justify-end gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                                    <span className="text-xs text-red-400 line-through">{ev.title}</span>
                                    <span className="text-[10px] text-red-300">נמחק</span>
                                  </div>
                                )

                                return (
                                  <div key={evIdx} className={`rounded-xl border px-3 py-2.5 ${isEditingThis ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                                    {isEditingThis ? (
                                      /* ── Inline edit form ── */
                                      <div className="space-y-2">
                                        <div className="flex gap-2 flex-row-reverse flex-wrap">
                                          <div className="flex flex-col gap-1 min-w-[90px]">
                                            <label className="text-[10px] text-gray-400 text-right">שם</label>
                                            <input value={draft.title} onChange={e => setEditingLogEvent(p => p && ({ ...p, draft: { ...p.draft, title: e.target.value } }))}
                                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" dir="rtl" />
                                          </div>
                                          <div className="flex flex-col gap-1 min-w-[80px]">
                                            <label className="text-[10px] text-gray-400 text-right">מי</label>
                                            <select value={draft.person} onChange={e => setEditingLogEvent(p => p && ({ ...p, draft: { ...p.draft, person: e.target.value } }))}
                                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" dir="rtl">
                                              {PERSON_OPTIONS.map(p => <option key={p} value={p}>{PERSON_LABELS[p]}</option>)}
                                            </select>
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <label className="text-[10px] text-gray-400 text-right">תאריך</label>
                                            <input type="date" value={draft.date} onChange={e => setEditingLogEvent(p => p && ({ ...p, draft: { ...p.draft, date: e.target.value } }))}
                                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <label className="text-[10px] text-gray-400 text-right">שעה</label>
                                            <input type="time" value={draft.start_time || ''} onChange={e => setEditingLogEvent(p => p && ({ ...p, draft: { ...p.draft, start_time: e.target.value } }))}
                                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                          </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[10px] text-gray-400 text-right">מיקום</label>
                                          <input value={draft.location || ''} onChange={e => setEditingLogEvent(p => p && ({ ...p, draft: { ...p.draft, location: e.target.value } }))}
                                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 w-full" dir="rtl" />
                                        </div>
                                        <div className="flex gap-2 justify-end mt-1">
                                          <button onClick={() => setEditingLogEvent(null)}
                                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg border border-gray-200">ביטול</button>
                                          {draft._event_id && (
                                            <button onClick={() => handleLogEventSave(batch.id, draft)} disabled={logSaving}
                                              className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1 rounded-lg transition disabled:opacity-40">
                                              {logSaving ? '...' : '💾 שמור'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      /* ── Event display row ── */
                                      <div className="flex items-start gap-2 flex-row-reverse">
                                        <div className="flex-1 text-right min-w-0">
                                          <div className="flex items-center gap-1.5 justify-end flex-wrap">
                                            <span className="font-bold text-xs text-gray-800">{ev.title}</span>
                                            {ev.person && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PERSON_COLORS[ev.person] || 'bg-gray-100 text-gray-600'}`}>{PERSON_LABELS[ev.person] || ev.person}</span>}
                                          </div>
                                          <div className="flex items-center gap-2 justify-end mt-0.5 flex-wrap">
                                            {ev.date && <span className="text-[10px] text-gray-400">📅 {formatDate(ev.date)}</span>}
                                            {ev.start_time && <span className="text-[10px] text-gray-400">⏰ {ev.start_time}{ev.end_time ? `–${ev.end_time}` : ''}</span>}
                                            {ev.location && <span className="text-[10px] text-gray-400">📍 {ev.location}</span>}
                                          </div>
                                          {ev.notes && <div className="text-[10px] text-amber-700 mt-0.5 text-right">📝 {ev.notes.slice(0, 60)}</div>}
                                        </div>
                                        {/* Action buttons */}
                                        <div className="flex gap-1 flex-shrink-0 mt-0.5">
                                          <button
                                            onClick={() => setEditingLogEvent({ batchId: batch.id, evIdx, draft: { ...ev } })}
                                            className="text-[10px] bg-gray-100 hover:bg-amber-100 hover:text-amber-700 text-gray-500 px-2 py-1 rounded-lg transition font-bold"
                                            title="ערוך"
                                          >✏️</button>
                                          {ev._event_id && (
                                            <button
                                              onClick={() => handleLogEventDelete(batch.id, ev._event_id!)}
                                              disabled={deletingEventId === ev._event_id}
                                              className="text-[10px] bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-500 px-2 py-1 rounded-lg transition font-bold disabled:opacity-40"
                                              title="מחק"
                                            >{deletingEventId === ev._event_id ? '...' : '🗑️'}</button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="px-3 pb-3 text-center text-[10px] text-gray-300">לא נוצרו אירועים מהודעה זו</div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
