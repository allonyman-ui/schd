'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const PERSON_OPTIONS = [
  { key: 'ami',   label: 'אמי 🌸' },
  { key: 'alex',  label: 'אלכס 🎵' },
  { key: 'itan',  label: 'איתן ⚽' },
  { key: 'assaf', label: 'אסף 💼' },
  { key: 'danil', label: 'דניאל 🌿' },
]

interface Calendar {
  id: string
  summary: string
  description?: string
  backgroundColor?: string
  primary?: boolean
  person: string | null
  enabled: boolean
  last_synced: string | null
}

interface SyncResult {
  calendarId: string
  calendarName: string
  synced: number
  skipped: number
  errors: number
}

function SettingsContent() {
  const params = useSearchParams()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncResults, setSyncResults] = useState<SyncResult[]>([])
  const [disconnecting, setDisconnecting] = useState(false)
  const [personMap, setPersonMap] = useState<Record<string, string>>({})
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [daysAhead, setDaysAhead] = useState(60)

  const gcalConnected = params.get('gcal_connected')
  const gcalError = params.get('gcal_error')
  const hint = params.get('hint')

  useEffect(() => { checkConnection() }, [])

  async function checkConnection() {
    setLoadingCalendars(true)
    try {
      const res = await fetch('/api/gcal/calendars')
      if (res.ok) {
        const data = await res.json()
        setConnected(true)
        setCalendars(data.calendars || [])
        const map: Record<string, string> = {}
        data.calendars?.forEach((c: Calendar) => { if (c.person) map[c.id] = c.person })
        setPersonMap(map)
      } else {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    } finally {
      setLoadingCalendars(false)
    }
  }

  async function savePersonMapping(calendarId: string, calendarName: string, person: string) {
    setSavingMap(prev => ({ ...prev, [calendarId]: true }))
    setPersonMap(prev => ({ ...prev, [calendarId]: person }))
    try {
      await fetch('/api/gcal/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, person, daysAhead: 0 }), // just save mapping, don't sync
      })
      // Update calendars list
      setCalendars(prev => prev.map(c => c.id === calendarId ? { ...c, person } : c))
    } catch {}
    setSavingMap(prev => ({ ...prev, [calendarId]: false }))
  }

  async function syncCalendar(calendarId: string, calendarName: string, person: string) {
    setSyncingAll(true)
    try {
      const res = await fetch('/api/gcal/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, person, daysAhead }),
      })
      if (res.ok) {
        const result = await res.json()
        setSyncResults(prev => [{ calendarId, calendarName, ...result }, ...prev.filter(r => r.calendarId !== calendarId)])
        setCalendars(prev => prev.map(c => c.id === calendarId ? { ...c, last_synced: new Date().toISOString() } : c))
      }
    } catch {}
    setSyncingAll(false)
  }

  async function syncAll() {
    const enabled = calendars.filter(c => c.enabled && personMap[c.id])
    if (!enabled.length) return
    setSyncingAll(true)
    setSyncResults([])
    for (const cal of enabled) {
      const person = personMap[cal.id]
      const res = await fetch('/api/gcal/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: cal.id, person, daysAhead }),
      })
      if (res.ok) {
        const result = await res.json()
        setSyncResults(prev => [...prev, { calendarId: cal.id, calendarName: cal.summary, ...result }])
        setCalendars(prev => prev.map(c => c.id === cal.id ? { ...c, last_synced: new Date().toISOString() } : c))
      }
    }
    setSyncingAll(false)
  }

  async function disconnect() {
    if (!confirm('האם לנתק את Google Calendar?')) return
    setDisconnecting(true)
    await fetch('/api/gcal/disconnect', { method: 'POST' })
    setConnected(false)
    setCalendars([])
    setDisconnecting(false)
  }

  const mappedCount = calendars.filter(c => personMap[c.id]).length

  return (
    <div className="max-w-2xl mx-auto px-3 pb-12" dir="rtl">
      <div className="text-center mb-6 pt-2">
        <h1 className="text-2xl font-black text-gray-900">⚙️ הגדרות</h1>
        <p className="text-sm text-gray-500 mt-1">חיבורים וסנכרון</p>
      </div>

      {/* Status alerts */}
      {gcalConnected && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-sm font-bold text-right">
          ✅ Google Calendar חובר בהצלחה! כעת בחר לאיזה חבר משפחה שייך כל לוח.
        </div>
      )}
      {gcalError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm text-right">
          <div className="font-bold mb-1">❌ שגיאה בחיבור: {gcalError}</div>
          {hint === 'revoke_and_retry' && (
            <div className="text-xs">
              כדי לקבל token רענון חדש, גש ל-
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="underline mx-1">Google Account Permissions</a>
              , הסר את הגישה לאפליקציה, ואז חזור לנסות שוב.
            </div>
          )}
        </div>
      )}

      {/* ── Google Calendar Section ─────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-5">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {connected === true && (
              <span className="text-xs bg-green-100 text-green-700 font-bold px-2.5 py-1 rounded-full">● מחובר</span>
            )}
            {connected === false && (
              <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2.5 py-1 rounded-full">○ לא מחובר</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-row-reverse">
            {/* Google icon + title */}
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 48 48" className="w-6 h-6 flex-shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span className="font-black text-gray-800 text-base">Google Calendar</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          {/* Not connected */}
          {connected === false && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                חבר את Google Calendar שלך כדי לסנכרן אוטומטית אירועים ישירות ללוח המשפחה.
              </p>

              {/* Setup instructions */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-right mb-5 text-sm">
                <div className="font-bold text-blue-700 mb-2">🔧 הגדרה ראשונה (5 דקות)</div>
                <ol className="space-y-1.5 text-blue-600 text-xs">
                  <li className="flex gap-2"><span className="font-black">1.</span><span>גש ל-<a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline font-bold">Google Cloud Console</a> וצור פרויקט חדש</span></li>
                  <li className="flex gap-2"><span className="font-black">2.</span><span>הפעל את <strong>Google Calendar API</strong> תחת "APIs & Services"</span></li>
                  <li className="flex gap-2"><span className="font-black">3.</span><span>צור Credentials → OAuth 2.0 Client ID → Web Application</span></li>
                  <li className="flex gap-2"><span className="font-black">4.</span><span>הוסף Authorized redirect URI: <code className="bg-blue-100 px-1 rounded text-xs">https://allonys.com/api/gcal/callback</code></span></li>
                  <li className="flex gap-2"><span className="font-black">5.</span><span>הוסף ב-Vercel את הסביבה: <code className="bg-blue-100 px-1 rounded text-xs">GOOGLE_CLIENT_ID</code> ו-<code className="bg-blue-100 px-1 rounded text-xs">GOOGLE_CLIENT_SECRET</code></span></li>
                  <li className="flex gap-2"><span className="font-black">6.</span><span>לחץ "חבר Google Calendar" למטה</span></li>
                </ol>
              </div>

              <a href="/api/gcal/auth"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-2xl transition shadow-md text-sm">
                <svg viewBox="0 0 48 48" className="w-5 h-5">
                  <path fill="#fff" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                </svg>
                חבר Google Calendar
              </a>
            </div>
          )}

          {/* Connected — show calendars */}
          {connected === true && (
            <div>
              {loadingCalendars ? (
                <div className="text-center py-6 text-gray-400">⏳ טוען לוחות שנה...</div>
              ) : (
                <>
                  {/* Controls */}
                  <div className="flex items-center justify-between mb-4 flex-row-reverse flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <label className="text-xs text-gray-500">סנכרן</label>
                      <select value={daysAhead} onChange={e => setDaysAhead(Number(e.target.value))}
                        className="border border-gray-200 rounded-xl px-2 py-1 text-xs focus:outline-none">
                        <option value={30}>30 ימים קדימה</option>
                        <option value={60}>60 ימים קדימה</option>
                        <option value={90}>90 ימים קדימה</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={syncAll} disabled={syncingAll || mappedCount === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl text-sm transition flex items-center gap-1.5">
                        {syncingAll ? <><span className="animate-spin">⏳</span> מסנכרן...</> : `🔄 סנכרן הכל (${mappedCount})`}
                      </button>
                      <button onClick={disconnect} disabled={disconnecting}
                        className="border-2 border-red-200 text-red-500 hover:bg-red-50 font-bold px-3 py-2 rounded-xl text-xs transition">
                        {disconnecting ? '...' : 'נתק'}
                      </button>
                    </div>
                  </div>

                  {/* Calendar list */}
                  <div className="space-y-2">
                    {calendars.map(cal => (
                      <div key={cal.id} className="border border-gray-100 rounded-2xl p-3 bg-gray-50">
                        <div className="flex items-center justify-between flex-row-reverse flex-wrap gap-2">
                          {/* Calendar info */}
                          <div className="flex items-center gap-2 flex-row-reverse">
                            <div className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ background: cal.backgroundColor || '#4285F4' }} />
                            <div className="text-right">
                              <div className="font-bold text-sm text-gray-800">{cal.summary}</div>
                              {cal.primary && <div className="text-xs text-blue-500">ראשי</div>}
                              {cal.last_synced && (
                                <div className="text-xs text-gray-400">
                                  סונכרן: {new Date(cal.last_synced).toLocaleString('he-IL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Person mapping + sync */}
                          <div className="flex items-center gap-2">
                            {personMap[cal.id] && (
                              <button onClick={() => syncCalendar(cal.id, cal.summary, personMap[cal.id])}
                                disabled={syncingAll}
                                className="text-blue-600 hover:text-blue-800 text-xs font-bold border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition disabled:opacity-40">
                                🔄 סנכרן
                              </button>
                            )}
                            <select value={personMap[cal.id] || ''}
                              onChange={e => {
                                const val = e.target.value
                                if (val) savePersonMapping(cal.id, cal.summary, val)
                                else setPersonMap(prev => { const n = {...prev}; delete n[cal.id]; return n })
                              }}
                              className="border-2 border-gray-200 rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white min-w-[120px]"
                              dir="rtl">
                              <option value="">— שייך ל... —</option>
                              {PERSON_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {mappedCount === 0 && (
                    <p className="text-xs text-orange-500 text-right mt-3">⚠️ שייך לפחות לוח אחד לחבר משפחה כדי לסנכרן</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sync results */}
      {syncResults.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-black text-gray-700 mb-3 text-right">📊 תוצאות סנכרון</h3>
          <div className="space-y-2">
            {syncResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between flex-row-reverse bg-gray-50 rounded-2xl p-3 border border-gray-100">
                <div className="text-right">
                  <div className="font-bold text-sm text-gray-700">{r.calendarName}</div>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-600 font-bold">✅ {r.synced} חדשים</span>
                  {r.skipped > 0 && <span className="text-gray-400">⏭️ {r.skipped} כפולים</span>}
                  {r.errors > 0 && <span className="text-red-500">❌ {r.errors} שגיאות</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-right mt-3">כל האירועים החדשים נוספו ללוח המשפחה</p>
        </div>
      )}

      {/* Other settings placeholder */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mt-4">
        <h3 className="font-black text-gray-700 mb-1 text-right">🔔 התראות (בקרוב)</h3>
        <p className="text-xs text-gray-400 text-right">שליחת תזכורות בוקר לוואטסאפ / מייל</p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">⏳ טוען...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
