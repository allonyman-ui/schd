'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'

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

type InputTab = 'text' | 'email' | 'calendar' | 'quick' | 'automail'

const INPUT_TABS = [
  { key: 'text'      as InputTab, icon: '📋', label: 'הדבק טקסט' },
  { key: 'email'     as InputTab, icon: '📧', label: 'מייל' },
  { key: 'calendar'  as InputTab, icon: '📅', label: 'Google Calendar' },
  { key: 'quick'     as InputTab, icon: '⚡', label: 'פקודה מהירה' },
  { key: 'automail'  as InputTab, icon: '📨', label: 'פורוורד אוטומטי' },
]

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
  const [inputTab, setInputTab] = useState<InputTab>('text')
  const [rawText, setRawText] = useState('')
  const [quickCmd, setQuickCmd] = useState('')
  const [processing, setProcessing] = useState(false)
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([])
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // Auto-mail tab
  const [emailBatches, setEmailBatches] = useState<Array<{id:string; raw_text:string; processed_events:ExtractedEvent[]; created_at:string}>>([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  const inboundAddress = process.env.NEXT_PUBLIC_POSTMARK_INBOUND_EMAIL || ''

  useEffect(() => {
    if (inputTab === 'automail') {
      setLoadingBatches(true)
      fetch('/api/email-inbound')
        .then(r => r.ok ? r.json() : [])
        .then(d => setEmailBatches(d))
        .finally(() => setLoadingBatches(false))
    }
  }, [inputTab])

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
    if (saved>0) { setSuccessMsg(`✅ נשמרו ${saved} אירועים בלו"ז!`); setExtractedEvents(prev=>prev.filter(e=>!e.person||!e.date)); setRawText(''); setQuickCmd('') }
    if (errs.length>0) setError('שגיאות: '+errs.join(' | '))
  }

  function updateEvent(idx: number, field: string, value: string) {
    setExtractedEvents(prev => prev.map((e,i) => i===idx ? {...e,[field]:value} : e))
  }
  function removeEvent(idx: number) {
    setExtractedEvents(prev => prev.filter((_,i) => i!==idx))
  }

  const complete = extractedEvents.filter(e => e.person && e.date && e.title)
  const incomplete = extractedEvents.filter(e => !e.person || !e.date)

  const placeholders: Record<InputTab, string> = {
    text: `דוגמה:\n"שלום הורים, חזרה לחג ביום רביעי 19.3 שעה 16:00 בבית הספר. יש להביא תלבושת לבנה ולא לשכוח את הספר 'שירים לחג'"`,
    email: `הדבק כאן את תוכן המייל כפי שקיבלת אותו — כולל שורת הנושא, שם השולח, התאריך, וכל הפרטים. Claude יזהה אוטומטית את כל האירועים.`,
    calendar: `הדבק כאן תוכן מיצוא Google Calendar (.ics):\n\nBEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:כדורגל — איתן\nDTSTART:20260320T160000\nDTEND:20260320T180000\nLOCATION:מגרש ספורט\nDESCRIPTION:אימון שבועי\nEND:VEVENT\nEND:VCALENDAR\n\nאו פשוט הדבק טקסט שהעתקת מ-Google Calendar.`,
    quick: ``,
    automail: ``,
  }

  const hints: Record<InputTab, { title: string; steps: string[] }> = {
    email: {
      title: '📧 איך להעביר מייל',
      steps: [
        'פתח את המייל שברצונך להוסיף ללוח',
        'העתק את כל תוכן המייל (Ctrl+A, Ctrl+C)',
        'הדבק כאן — Claude יזהה תאריכים, שעות ואת כל הפרטים',
        'בדוק ותקן אם נדרש, לאחר מכן שמור',
      ]
    },
    calendar: {
      title: '📅 ייצוא מ-Google Calendar',
      steps: [
        'ב-Google Calendar: לחץ ⚙️ → הגדרות → ייצוא',
        'הורד קובץ .ics, פתח אותו בעורך טקסט',
        'העתק והדבק את התוכן כאן',
        'לחלופין: פתח אירוע ב-Calendar, העתק את הטקסט מהחלון',
      ]
    },
    text: { title: '', steps: [] },
    quick: { title: '', steps: [] },
    automail: { title: '', steps: [] },
  }

  return (
    <div className="max-w-2xl mx-auto px-3 pb-12" dir="rtl">
      {/* Header */}
      <div className="text-center mb-6 pt-2">
        <h1 className="text-2xl font-black text-gray-900">📥 הכנסת מידע ללוח</h1>
        <p className="text-sm text-gray-500 mt-1">הדבק כל סוג של טקסט — Claude יחלץ את האירועים</p>
      </div>

      {/* Success / Error */}
      {successMsg && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-sm text-right font-bold">{successMsg}</div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm text-right">{error}</div>
      )}

      {/* Input source tabs */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 mb-5 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100">
          {INPUT_TABS.map(tab => (
            <button key={tab.key} onClick={() => { setInputTab(tab.key); setError(''); setSuccessMsg('') }}
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${inputTab===tab.key ? 'border-amber-400 text-amber-600 bg-amber-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>
              <div className="text-lg mb-0.5">{tab.icon}</div>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Hint box for email / calendar */}
          {hints[inputTab]?.steps.length > 0 && (
            <div className="mb-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <div className="font-bold text-blue-700 text-sm mb-2">{hints[inputTab].title}</div>
              <ol className="space-y-1">
                {hints[inputTab].steps.map((s, i) => (
                  <li key={i} className="text-xs text-blue-600 flex gap-2">
                    <span className="font-black flex-shrink-0">{i+1}.</span><span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Quick command tab */}
          {inputTab === 'quick' ? (
            <div>
              <div className="text-sm font-bold text-gray-700 mb-2">⚡ הוסף אירוע בפקודה מהירה</div>
              <p className="text-xs text-gray-400 mb-3">כתוב בחופשיות — לדוגמה: "תוסיף לאמי יום ב׳ שעה 14:00 שיעור שחייה בבריכה" או "איתן יש אימון כדורגל כל חמישי 16:00"</p>
              <div className="flex gap-2">
                <button onClick={() => handleProcess(quickCmd)} disabled={processing||!quickCmd.trim()}
                  className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-3 rounded-2xl transition disabled:opacity-40 flex items-center gap-2 text-sm">
                  {processing ? <span className="animate-spin">⏳</span> : '🤖'} נתח
                </button>
                <input type="text" value={quickCmd} onChange={e => setQuickCmd(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && handleProcess(quickCmd)}
                  placeholder='לדוגמה: "איתן — שיעור מתמטיקה יום ג׳ 16:00"'
                  className="flex-1 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 bg-gray-50" dir="rtl" />
              </div>
              {/* Quick examples */}
              <div className="mt-3">
                <div className="text-xs text-gray-400 mb-2">דוגמאות מהירות — לחץ להכניס:</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'אמי — גן שעשועים מחר 10:00',
                    'איתן כדורגל כל שני 16:00',
                    'אלכס חוג גיטרה יום ג׳ 15:30',
                    'אסף פגישה ראשון הבא 09:00 בזום',
                  ].map(ex => (
                    <button key={ex} onClick={() => setQuickCmd(ex)}
                      className="text-xs bg-gray-100 hover:bg-amber-100 hover:text-amber-700 text-gray-600 px-2.5 py-1 rounded-full transition border border-gray-200">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : inputTab === 'automail' ? (
            /* ── Auto-mail forwarding tab ── */
            <div>
              {/* Address box */}
              <div className="mb-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-4 text-right">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📨</span>
                  <span className="font-black text-emerald-800 text-sm">כתובת הפורוורד שלך</span>
                </div>
                {inboundAddress ? (
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <code className="flex-1 bg-white rounded-xl px-3 py-2 text-sm font-mono text-emerald-700 border border-emerald-200 text-left" dir="ltr">{inboundAddress}</code>
                    <button onClick={() => navigator.clipboard.writeText(inboundAddress)}
                      className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-700 transition font-bold flex-shrink-0">
                      העתק
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700">הגדר <code className="bg-white px-1 rounded">NEXT_PUBLIC_POSTMARK_INBOUND_EMAIL</code> ב-Vercel לאחר הגדרת Postmark</p>
                )}
                <p className="text-xs text-emerald-600 mt-2">
                  פשוט העבר כל מייל, הזמנה לפגישה, או אישור תור לכתובת הזו — אירועים יתווספו אוטומטית ללוח 🪄
                </p>
              </div>

              {/* Setup steps */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
                <div className="font-black text-blue-700 text-sm mb-2">⚡ הגדרה ב-5 דקות (חד-פעמי)</div>
                <ol className="space-y-1.5">
                  {[
                    <>הירשם בחינם ל-<a href="https://postmarkapp.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">postmarkapp.com</a></>,
                    'צור "Inbound Server" חדש',
                    <>הגדר Webhook URL: <code className="bg-blue-100 px-1 rounded text-xs">https://allonys.com/api/email-inbound</code></>,
                    'קבל כתובת אימייל בפורמט @inbound.postmarkapp.com (או הגדר דומיין משלך)',
                    'הוסף את הכתובת ל-Vercel כ-NEXT_PUBLIC_POSTMARK_INBOUND_EMAIL',
                    '✅ הכל מוכן — תעביר מיילים ואירועים יופיעו אוטומטית',
                  ].map((s, i) => (
                    <li key={i} className="text-xs text-blue-600 flex gap-2">
                      <span className="font-black flex-shrink-0 text-blue-400">{i+1}.</span><span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Recent imports */}
              <div className="font-black text-gray-700 text-sm mb-2">📬 מיילים שעובדו לאחרונה</div>
              {loadingBatches ? (
                <div className="text-center py-6 text-gray-400 text-sm">⏳ טוען...</div>
              ) : emailBatches.length === 0 ? (
                <div className="text-center py-6 text-gray-300 text-sm">עדיין לא התקבלו מיילים אוטומטיים</div>
              ) : (
                <div className="space-y-2">
                  {emailBatches.map(batch => {
                    const subjectMatch = batch.raw_text.match(/subject: (.+)/i)
                    const fromMatch    = batch.raw_text.match(/from: (.+)/i)
                    const subject = subjectMatch?.[1]?.trim() || '(ללא נושא)'
                    const from    = fromMatch?.[1]?.trim() || ''
                    const evCount = batch.processed_events?.length ?? 0
                    const dateStr = new Date(batch.created_at).toLocaleDateString('he-IL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
                    return (
                      <div key={batch.id} className="flex items-center gap-3 flex-row-reverse bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-base flex-shrink-0">📧</div>
                        <div className="flex-1 text-right min-w-0">
                          <div className="font-bold text-sm text-gray-800 truncate">{subject}</div>
                          {from && <div className="text-xs text-gray-400 truncate">{from}</div>}
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${evCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {evCount > 0 ? `✅ ${evCount} אירועים` : '—'}
                          </span>
                          <span className="text-[10px] text-gray-300">{dateStr}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Text / Email / Calendar — all go through same textarea */
            <div>
              <textarea value={rawText} onChange={e => setRawText(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-2xl p-4 text-sm h-40 resize-none focus:outline-none focus:border-amber-400 bg-gray-50"
                placeholder={placeholders[inputTab]} dir="rtl" />
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleProcess(rawText)} disabled={processing||!rawText.trim()}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-2xl transition disabled:opacity-40 flex items-center gap-2 text-sm">
                  {processing ? <><span className="animate-spin">⏳</span> מנתח...</> : '🤖 חלץ אירועים עם AI'}
                </button>
                {rawText && (
                  <button onClick={() => { setRawText(''); setExtractedEvents([]); setError(''); setSuccessMsg('') }}
                    className="text-gray-400 hover:text-gray-600 text-sm px-3 py-2 rounded-2xl border-2 border-gray-200 hover:border-gray-300 transition">
                    נקה
                  </button>
                )}
              </div>
            </div>
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

      {/* Tips */}
      {extractedEvents.length === 0 && !processing && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <div className="font-black text-gray-700 text-sm mb-3 text-right">💡 מה אפשר להכניס?</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '💬', title: 'הודעות WhatsApp', desc: 'העתק/הדבק ישירות מהשיחה' },
              { icon: '📧', title: 'מיילים מבית הספר', desc: 'הדבק את תוכן המייל המלא' },
              { icon: '📅', title: 'Google Calendar', desc: 'יצא .ics או העתק טקסט' },
              { icon: '📄', title: 'עלון בית ספר', desc: 'צלם, העבר OCR, הדבק' },
              { icon: '🗓️', title: 'לוח חוגים', desc: 'כל פורמט טקסט עובד' },
              { icon: '⚡', title: 'פקודה מהירה', desc: 'הוסף ידנית בשפה חופשית' },
            ].map(tip => (
              <div key={tip.title} className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <span className="text-xl flex-shrink-0">{tip.icon}</span>
                <div>
                  <div className="text-xs font-bold text-gray-700">{tip.title}</div>
                  <div className="text-xs text-gray-400">{tip.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
