'use client'

import { useState, useEffect } from 'react'
import { ExtractedEvent, FAMILY_MEMBERS, getMemberInfo } from '@/lib/types'
import PersonBadge from '@/components/PersonBadge'

interface BatchHistory {
  id: string
  raw_text: string
  processed_events: ExtractedEvent[]
  created_at: string
}

export default function InboxPage() {
  const [rawText, setRawText] = useState('')
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([])
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<BatchHistory[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [step, setStep] = useState<'input' | 'review'>('input')

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
    const res = await fetch('/api/process-whatsapp')
    if (res.ok) {
      const data = await res.json()
      setHistory(data)
    }
  }

  async function handleProcess() {
    if (!rawText.trim()) return
    setProcessing(true)
    setError('')

    const res = await fetch('/api/process-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'שגיאה בעיבוד ההודעות')
      setProcessing(false)
      return
    }

    setExtractedEvents(data.events)
    setSelectedEvents(new Set(data.events.map((_: ExtractedEvent, i: number) => i)))
    setStep('review')
    setProcessing(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const eventsToSave = extractedEvents
      .filter((_, i) => selectedEvents.has(i))
      .filter(e => !e.action || e.action === 'add')
      .map(e => ({
        title: e.title,
        person: e.person,
        date: e.date,
        start_time: e.start_time,
        end_time: e.end_time,
        location: e.location,
        notes: e.notes,
        is_recurring: e.is_recurring,
        recurrence_days: e.recurrence_days,
        source: 'whatsapp',
      }))

    const results = await Promise.all(
      eventsToSave.map(event =>
        fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        })
      )
    )

    const failed = results.filter(r => !r.ok).length
    if (failed > 0) {
      setError(`נכשל לשמור ${failed} אירועים`)
    } else {
      setSuccess(`${eventsToSave.length} אירועים נשמרו בהצלחה!`)
      setRawText('')
      setExtractedEvents([])
      setStep('input')
      fetchHistory()
    }
    setSaving(false)
  }

  function toggleEvent(index: number) {
    const next = new Set(selectedEvents)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelectedEvents(next)
  }

  function updateEvent(index: number, field: keyof ExtractedEvent, value: string) {
    const updated = [...extractedEvents]
    updated[index] = { ...updated[index], [field]: value }
    setExtractedEvents(updated)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📱 תיבת הודעות וואטסאפ</h1>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
          {success}
        </div>
      )}

      {step === 'input' && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">הדבק הודעות וואטסאפ</h2>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-4 text-sm h-48 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 direction-rtl"
            placeholder="הדבק כאן את ההודעות מהוואטסאפ...

לדוגמה:
אלכס יש לו אימון כדורסל ביום שלישי ב-17:00
Ami - swimming canceled this week
הסעה לאיתן ביום ראשון ב-15:30"
            dir="rtl"
          />
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
          <div className="flex justify-end mt-4">
            <button
              onClick={handleProcess}
              disabled={processing || !rawText.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-2 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  מעבד...
                </>
              ) : (
                <>עבד הודעות</>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'review' && extractedEvents.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">
              אירועים שזוהו ({extractedEvents.length})
            </h2>
            <button
              onClick={() => { setStep('input'); setExtractedEvents([]) }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              חזור
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {extractedEvents.map((event, i) => {
              const member = getMemberInfo(event.person)
              const isSelected = selectedEvents.has(i)

              return (
                <div
                  key={i}
                  className={`border rounded-xl p-4 transition cursor-pointer ${
                    isSelected ? `border-${member.color}-300 ${member.bgColor}` : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                  onClick={() => toggleEvent(i)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEvent(i)}
                      className="mt-1 flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <PersonBadge name={event.person} />
                        {event.action === 'cancel' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">ביטול</span>
                        )}
                        {event.action === 'update' && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">עדכון</span>
                        )}
                        {event.is_recurring && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">🔄 חוזר</span>
                        )}
                      </div>

                      <input
                        type="text"
                        value={event.title}
                        onChange={e => updateEvent(i, 'title', e.target.value)}
                        className="w-full font-medium text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-400 focus:outline-none mb-1"
                        onClick={e => e.stopPropagation()}
                        dir="rtl"
                      />

                      <div className="flex gap-3 text-sm text-gray-600 flex-wrap">
                        <span>📅 {event.date}</span>
                        {event.start_time && (
                          <span>🕐 {event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}</span>
                        )}
                        {event.location && <span>📍 {event.location}</span>}
                      </div>

                      {event.notes && (
                        <p className="text-xs text-gray-400 mt-1">{event.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setSelectedEvents(new Set(extractedEvents.map((_, i) => i)))}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              בחר הכל
            </button>
            <button
              onClick={() => setSelectedEvents(new Set())}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              בטל הכל
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedEvents.size === 0}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'שומר...' : `שמור ${selectedEvents.size} אירועים`}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">היסטוריה</h2>
          <div className="space-y-3">
            {history.map(batch => (
              <div key={batch.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
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
