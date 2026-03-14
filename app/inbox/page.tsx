'use client'

import { useState, useEffect } from 'react'
import PersonBadge from '@/components/PersonBadge'
import { FAMILY_MEMBERS } from '@/lib/types'

const PERSON_OPTIONS = ['alex', 'itan', 'ami', 'danil', 'assaf']
const PERSON_LABELS: Record<string, string> = {
  alex: 'אלכס', itan: 'איתן', ami: 'אמי', danil: 'דניאל', assaf: 'אסף'
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
  action?: string
  original_title?: string
}

interface BatchHistory {
  id: string
  raw_text: string
  processed_events: ExtractedEvent[]
  created_at: string
}

export default function InboxPage() {
  const [rawText, setRawText] = useState('')
  const [processing, setProcessing] = useState(false)
  const [incompleteEvents, setIncompleteEvents] = useState<ExtractedEvent[]>([])
  const [history, setHistory] = useState<BatchHistory[]>([])
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

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
    setIncompleteEvents([])

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

      const events: ExtractedEvent[] = data.events || []

      // Split into complete and incomplete
      const complete = events.filter(e => e.person && e.date && (!e.action || e.action === 'add'))
      const incomplete = events.filter(e => !e.person || !e.date)

      // Auto-save complete events
      let savedCount = 0
      for (const ev of complete) {
        const r = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...ev, source: 'whatsapp' }),
        })
        if (r.ok) savedCount++
      }

      if (savedCount > 0) {
        setSuccessMsg(`✅ נשמרו ${savedCount} אירועים אוטומטית`)
        setRawText('')
        fetchHistory()
      }

      if (incomplete.length > 0) {
        setIncompleteEvents(incomplete)
      }

      if (savedCount === 0 && incomplete.length === 0) {
        setSuccessMsg('לא נמצאו אירועים בהודעה')
      }
    } catch (err) {
      setError('שגיאת רשת — ודא שהאפליקציה פרוסה ונסה שוב')
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  async function saveIncomplete() {
    let savedCount = 0
    for (const ev of incompleteEvents) {
      if (!ev.person || !ev.date) continue
      const r = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ev, source: 'whatsapp' }),
      })
      if (r.ok) savedCount++
    }
    if (savedCount > 0) {
      setSuccessMsg(prev => prev + ` + עוד ${savedCount} אירועים`)
      setIncompleteEvents([])
      fetchHistory()
    }
  }

  function updateIncomplete(idx: number, field: string, value: string) {
    setIncompleteEvents(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const allIncompleteReady = incompleteEvents.length > 0 && incompleteEvents.every(e => e.person && e.date)

  return (
    <div className="max-w-2xl mx-auto px-3">
      <h1 className="text-xl font-bold text-gray-800 mb-5 text-right">📥 הכנסת מידע</h1>

      {/* Success */}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm text-right">
          {successMsg}
        </div>
      )}

      {/* Input */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3 text-right">הדבק הודעות וואטסאפ</h2>
        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm h-36 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="הדבק כאן את ההודעות מהוואטסאפ..."
          dir="rtl"
        />
        {error && <p className="text-red-500 text-sm mt-2 text-right">{error}</p>}
        <div className="flex justify-start mt-3">
          <button
            onClick={handleProcess}
            disabled={processing || !rawText.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? <><span className="animate-spin inline-block">⏳</span> מעבד...</> : 'עבד ושמור'}
          </button>
        </div>
      </div>

      {/* Missing info form */}
      {incompleteEvents.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
          <h2 className="text-base font-semibold text-orange-800 mb-4 text-right">
            ⚠️ חסר מידע — יש להשלים ({incompleteEvents.length} אירועים)
          </h2>
          <div className="space-y-4">
            {incompleteEvents.map((ev, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-orange-100">
                <div className="font-semibold text-gray-800 text-right mb-3">{ev.title}</div>
                <div className="flex gap-3 flex-row-reverse flex-wrap">
                  {!ev.person && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500 text-right">ילד/ה *</label>
                      <select
                        value={ev.person || ''}
                        onChange={e => updateIncomplete(i, 'person', e.target.value)}
                        className="border border-orange-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        dir="rtl"
                      >
                        <option value="">בחר...</option>
                        {PERSON_OPTIONS.map(p => (
                          <option key={p} value={p}>{PERSON_LABELS[p]}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {!ev.date && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500 text-right">תאריך *</label>
                      <input
                        type="date"
                        value={ev.date || ''}
                        onChange={e => updateIncomplete(i, 'date', e.target.value)}
                        className="border border-orange-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-start mt-4">
            <button
              onClick={saveIncomplete}
              disabled={!allIncompleteReady}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50"
            >
              שמור אירועים חסרים
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4 text-right">היסטוריה</h2>
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
