'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const PEOPLE = [
  { key: 'ami',    name: 'אמי',    color: '#E91E63' },
  { key: 'alex',   name: 'אלכס',   color: '#8E24AA' },
  { key: 'itan',   name: 'איתן',   color: '#43A047' },
  { key: 'assaf',  name: 'אסף',    color: '#1D4ED8' },
  { key: 'danil',  name: 'דניאל',  color: '#15803D' },
  { key: 'family', name: 'כולם',   color: '#F59E0B' },
]
const PERSON_MAP = Object.fromEntries(PEOPLE.map(p => [p.key, p]))
function getPerson(key: string) { return PERSON_MAP[key] || PERSON_MAP['family'] }

interface ExtractedEvent {
  person: string; title: string; date: string
  start_time: string | null; end_time: string | null
  location: string | null; notes: string | null
  is_recurring: boolean; recurrence_days: string[] | null
  meeting_link: string | null; action?: string
}
interface Reminder { person: string; text: string; due_date: string | null }
interface ShoppingItem { item: string; qty: string | null; notes: string | null }
interface NoteItem { person: string; content: string; category: string }
interface Question { id: string; question: string; context: string; type: string }
interface LinkItem { url: string; title: string }

type SaveStatus = 'pending' | 'saving' | 'saved' | 'dismissed'

// Per-item user override: person reassignment, type change, date range
interface ItemOverride {
  person?: string
  itemType?: 'event' | 'reminder' | 'shopping'
  dateEnd?: string   // if set, this is a date range
  dateStart?: string // override start date
}

interface ConvTurn {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  summary?: string
  timestamp: number
}

function formatDate(d: string) {
  if (!d) return ''
  try { return new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' }) }
  catch { return d }
}

// ── Per-item assignment row ────────────────────────────────────────────────
function AssignmentRow({
  itemKey, override, originalPerson, originalType, originalDate,
  onOverride,
}: {
  itemKey: string
  override: ItemOverride
  originalPerson: string
  originalType: 'event' | 'reminder' | 'shopping'
  originalDate?: string
  onOverride: (key: string, patch: Partial<ItemOverride>) => void
}) {
  const person = override.person ?? originalPerson
  const type = override.itemType ?? originalType
  const isRange = !!(override.dateEnd)
  const dateStart = override.dateStart ?? originalDate ?? ''

  return (
    <div className="mt-2 pt-2 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Person chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-white/35 ml-1">למי:</span>
        {PEOPLE.map(p => (
          <button key={p.key}
            onClick={() => onOverride(itemKey, { person: p.key })}
            className="text-xs px-2.5 py-1 rounded-full font-bold transition active:scale-95"
            style={{
              background: person === p.key ? p.color : 'rgba(255,255,255,0.07)',
              color: person === p.key ? '#fff' : 'rgba(255,255,255,0.4)',
              border: `1.5px solid ${person === p.key ? p.color : 'rgba(255,255,255,0.1)'}`,
              boxShadow: person === p.key ? `0 0 10px ${p.color}55` : 'none',
            }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Type toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-white/35 ml-1">סוג:</span>
        {[
          { k: 'event' as const,    label: '📅 אירוע',   bg: 'rgba(34,197,94,0.2)',   border: 'rgba(34,197,94,0.4)',   text: '#4ade80' },
          { k: 'reminder' as const, label: '🔔 תזכורת', bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.4)', text: '#fbbf24' },
          { k: 'shopping' as const, label: '🛒 קניות',  bg: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.4)', text: '#d8b4fe' },
        ].map(t => (
          <button key={t.k}
            onClick={() => onOverride(itemKey, { itemType: t.k })}
            className="text-xs px-2.5 py-1 rounded-full font-bold transition active:scale-95"
            style={{
              background: type === t.k ? t.bg : 'rgba(255,255,255,0.05)',
              color: type === t.k ? t.text : 'rgba(255,255,255,0.3)',
              border: `1.5px solid ${type === t.k ? t.border : 'rgba(255,255,255,0.08)'}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date scope */}
      {(type === 'event' || type === 'reminder') && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/35 ml-1">תאריך:</span>
          <input type="date" value={dateStart}
            onChange={e => onOverride(itemKey, { dateStart: e.target.value })}
            className="text-xs px-2 py-1 rounded-lg text-white/80 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }} />
          <button
            onClick={() => onOverride(itemKey, { dateEnd: isRange ? undefined : (dateStart || '') })}
            className="text-xs px-2.5 py-1 rounded-full font-bold transition"
            style={{
              background: isRange ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
              color: isRange ? '#60a5fa' : 'rgba(255,255,255,0.3)',
              border: `1.5px solid ${isRange ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            {isRange ? '📅 טווח' : '+ טווח תאריכים'}
          </button>
          {isRange && (
            <>
              <span className="text-xs text-white/30">עד</span>
              <input type="date" value={override.dateEnd || ''}
                onChange={e => onOverride(itemKey, { dateEnd: e.target.value })}
                className="text-xs px-2 py-1 rounded-lg text-white/80 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(59,130,246,0.3)' }} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Activity Log ─────────────────────────────────────────────────────────────
type LogEvent = ExtractedEvent & { _event_id?: string; _deleted?: boolean }
type BatchItem = { id: string; raw_text: string; processed_events: LogEvent[]; created_at: string }

function ActivityLog() {
  const [expanded, setExpanded] = useState(false)
  const [batches, setBatches] = useState<BatchItem[]>([])
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = () => fetch('/api/recent-batches').then(r => r.ok ? r.json() : []).then(setBatches).catch(() => {})
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [])

  async function deleteEvent(batchId: string, eventId: string) {
    setDeletingId(eventId)
    try {
      await fetch(`/api/events?id=${eventId}`, { method: 'DELETE' })
      setBatches(prev => prev.map(b => b.id !== batchId ? b : {
        ...b,
        processed_events: b.processed_events.map(e => e._event_id === eventId ? { ...e, _deleted: true } : e),
      }))
    } finally { setDeletingId(null) }
  }

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <button onClick={() => setExpanded(x => !x)} className="w-full flex items-center justify-between px-5 py-3.5 text-right">
        <span className="text-xs font-bold text-white/35">{expanded ? '▲' : '▼'} {batches.length} עיבודים אחרונים</span>
        <span className="text-sm font-black text-white/60">📋 היסטוריה</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 max-h-96 overflow-y-auto">
          {batches.length === 0 && <div className="text-center text-white/35 text-sm py-4">אין היסטוריה עדיין</div>}
          {batches.map(batch => (
            <div key={batch.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => setExpandedBatches(prev => { const n = new Set(prev); n.has(batch.id) ? n.delete(batch.id) : n.add(batch.id); return n })}
                className="w-full flex items-center justify-between px-3 py-2 text-right"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="text-xs text-white/30">{new Date(batch.created_at).toLocaleString('he-IL')}</span>
                <span className="text-xs font-bold text-white/50 truncate max-w-[200px]">{batch.raw_text.slice(0, 60)}…</span>
              </button>
              {expandedBatches.has(batch.id) && (
                <div className="p-2 space-y-1.5">
                  {batch.processed_events.map((ev, i) => (
                    <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm ${ev._deleted ? 'opacity-40 line-through' : ''}`} style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!ev._deleted && ev._event_id && (
                          <button onClick={() => deleteEvent(batch.id, ev._event_id!)} disabled={deletingId === ev._event_id}
                            className="text-red-400 hover:text-red-300 text-xs px-1.5 py-0.5 rounded-lg transition" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
                            {deletingId === ev._event_id ? '…' : '✕'}
                          </button>
                        )}
                      </div>
                      <div className="flex-1 text-right">
                        <span className="font-bold text-white/80">{ev.title}</span>
                        {ev.date && <span className="text-white/35 mr-1.5 text-xs">{formatDate(ev.date)}</span>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: getPerson(ev.person).color + '33', color: getPerson(ev.person).color }}>
                        {getPerson(ev.person).name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Save status pill ──────────────────────────────────────────────────────────
function SaveBtn({ status, onSave, onDismiss }: { status: SaveStatus; onSave: () => void; onDismiss: () => void }) {
  if (status === 'saved') return <span className="text-xs px-2 py-1 rounded-xl font-bold text-green-400" style={{ background: 'rgba(34,197,94,0.15)' }}>✓ נשמר</span>
  if (status === 'dismissed') return null
  return (
    <div className="flex gap-1 flex-shrink-0">
      <button onClick={onSave} disabled={status === 'saving'}
        className="text-xs px-2 py-1 rounded-xl font-bold text-green-400 transition active:scale-95"
        style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
        {status === 'saving' ? '…' : '💾'}
      </button>
      <button onClick={onDismiss}
        className="text-xs px-2 py-1 rounded-xl text-white/25 hover:text-red-400 transition"
        style={{ background: 'rgba(255,255,255,0.05)' }}>
        ✕
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const [rawText, setRawText] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  // Extracted data
  const [events, setEvents] = useState<ExtractedEvent[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [shopping, setShopping] = useState<ShoppingItem[]>([])
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [contextSummary, setContextSummary] = useState('')
  const [hasData, setHasData] = useState(false)
  const [extractedLinks, setExtractedLinks] = useState<LinkItem[]>([])
  const [savedLinkUrls, setSavedLinkUrls] = useState<Set<string>>(new Set())

  // Per-item save status
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})

  // Last processed images — offer to attach to events
  const [lastProcessedImages, setLastProcessedImages] = useState<string[]>([])
  const [attachImage, setAttachImage] = useState<Record<string, boolean>>({})

  // Per-item user overrides (person, type, date range)
  const [itemOverrides, setItemOverrides] = useState<Record<string, ItemOverride>>({})
  // Which items have the assignment panel open
  const [assignOpen, setAssignOpen] = useState<Set<string>>(new Set())

  // Conversation memory
  const [convTurns, setConvTurns] = useState<ConvTurn[]>([])
  const [apiHistory, setApiHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Override helpers ──────────────────────────────────────────────────────
  function applyOverride(key: string, patch: Partial<ItemOverride>) {
    setItemOverrides(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }
  function toggleAssign(key: string) {
    setAssignOpen(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  // ── Image helpers ────────────────────────────────────────────────────────
  function addImages(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    arr.forEach(file => {
      const reader = new FileReader()
      reader.onload = e => { const r = e.target?.result as string; if (r) setPendingImages(prev => [...prev, r]) }
      reader.readAsDataURL(file)
    })
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(i => i.type.startsWith('image/'))
    if (imageItems.length > 0) {
      e.preventDefault()
      imageItems.forEach(item => { const file = item.getAsFile(); if (file) addImages([file]) })
    }
  }, [])

  function removeImage(idx: number) { setPendingImages(prev => prev.filter((_, i) => i !== idx)) }

  // ── Process ──────────────────────────────────────────────────────────────
  async function handleProcess(withAnswers = false) {
    const hasText = !!rawText.trim()
    const hasImages = pendingImages.length > 0
    if (!hasText && !hasImages) return

    setProcessing(true); setError('')
    if (!withAnswers) {
      setEvents([]); setReminders([]); setShopping([]); setNotes([])
      setQuestions([]); setContextSummary(''); setAnswers({}); setHasData(false)
      setSaveStatus({}); setItemOverrides({}); setAssignOpen(new Set())
    }

    try {
      const body: { rawText?: string; images?: string[]; answers?: Array<{ question: string; answer: string }>; history?: Array<{ role: 'user' | 'assistant'; content: string }> } = {}
      if (hasText) body.rawText = rawText
      if (hasImages) body.images = pendingImages
      if (withAnswers && questions.length > 0) {
        body.answers = questions.map(q => ({ question: q.question, answer: answers[q.id] || '' })).filter(a => a.answer)
      }
      if (apiHistory.length > 0) body.history = apiHistory

      const res = await fetch('/api/process-whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error || `שגיאה ${res.status}`); return }

      const extractedEvents = (data.events || []).filter((e: ExtractedEvent) => e.action !== 'cancel')
      setEvents(extractedEvents)
      setReminders(data.reminders || [])
      setShopping(data.shopping || [])
      setNotes(data.notes || [])
      setQuestions(withAnswers ? [] : (data.questions || []))
      setContextSummary(data.context_summary || '')
      setHasData(true)

      // Auto-save extracted links as family links
      const newLinks: LinkItem[] = data.links || []
      if (newLinks.length > 0) {
        setExtractedLinks(prev => {
          const existing = new Set(prev.map(l => l.url))
          return [...prev, ...newLinks.filter(l => !existing.has(l.url))]
        })
        for (const link of newLinks) {
          try {
            await fetch('/api/reminders', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: `${link.title}||${link.url}`, person: '__link__', date: new Date().toISOString().split('T')[0], completed: false }),
            })
            setSavedLinkUrls(prev => new Set([...prev, link.url]))
          } catch { /* ignore */ }
        }
      }

      // Auto-open assignment panel for items assigned to "family" (likely needs clarification)
      const autoOpen = new Set<string>()
      extractedEvents.forEach((_: ExtractedEvent, i: number) => {
        if (extractedEvents[i].person === 'family') autoOpen.add(`ev-${i}`)
      })
      ;(data.reminders || []).forEach((_: Reminder, i: number) => {
        if ((data.reminders || [])[i].person === 'family') autoOpen.add(`rem-${i}`)
      })
      if (autoOpen.size > 0) setAssignOpen(autoOpen)

      // Conversation tracking
      const userTurn: ConvTurn = { role: 'user', content: rawText, images: pendingImages.length > 0 ? [...pendingImages] : undefined, timestamp: Date.now() }
      const assistantTurn: ConvTurn = { role: 'assistant', content: data.assistantSummary || data.context_summary || 'עובד', summary: data.context_summary, timestamp: Date.now() }
      setConvTurns(prev => [...prev, userTurn, assistantTurn])
      setApiHistory(prev => [...prev, { role: 'user', content: rawText || '(תמונה)' }, { role: 'assistant', content: data.assistantSummary || data.context_summary || 'עובד' }])

        // Track images used in this turn so we can offer to attach them to events
      if (pendingImages.length > 0) setLastProcessedImages([...pendingImages])

      setRawText(''); setPendingImages([])
    } catch { setError('שגיאת רשת — נסה שוב')
    } finally { setProcessing(false) }
  }

  // ── Upload image helper ───────────────────────────────────────────────────
  async function uploadDataUrl(dataUrl: string): Promise<string | null> {
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const ext = blob.type.split('/')[1] || 'jpg'
      const file = new File([blob], `event-img.${ext}`, { type: blob.type })
      const form = new FormData(); form.append('file', file)
      const r = await fetch('/api/upload', { method: 'POST', body: form })
      if (!r.ok) return null
      const { url } = await r.json()
      return url || null
    } catch { return null }
  }

  // ── Per-item save ────────────────────────────────────────────────────────
  async function saveEvent(ev: ExtractedEvent, key: string) {
    const ov = itemOverrides[key] || {}
    const person = ov.person ?? ev.person
    const date = ov.dateStart ?? ev.date
    const type = ov.itemType ?? 'event'

    setSaveStatus(p => ({ ...p, [key]: 'saving' }))

    // If reassigned to reminder type
    if (type === 'reminder') {
      const r = await fetch('/api/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ev.title + (ev.notes ? ` — ${ev.notes}` : ''), person: person === 'family' ? null : person, date, completed: false }),
      })
      setSaveStatus(p => ({ ...p, [key]: r.ok ? 'saved' : 'pending' }))
      return
    }
    if (type === 'shopping') {
      const r = await fetch('/api/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ev.title, person: '__grocery__', date, completed: false }),
      })
      setSaveStatus(p => ({ ...p, [key]: r.ok ? 'saved' : 'pending' }))
      return
    }

    // Upload image if user opted in
    let attachmentUrl: string | null = null
    if (attachImage[key] && lastProcessedImages.length > 0) {
      attachmentUrl = await uploadDataUrl(lastProcessedImages[0])
    }

    // Save as event
    const saveData = { ...ev, person, date, source: 'inbox', attachment_url: attachmentUrl || undefined }

    // If date range → save recurring or multiple events
    if (ov.dateEnd && ov.dateEnd > (date || '')) {
      // Save event from dateStart to dateEnd
      const r = await fetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...saveData, notes: (ev.notes || '') + ` (עד ${formatDate(ov.dateEnd)})` }),
      })
      setSaveStatus(p => ({ ...p, [key]: r.ok ? 'saved' : 'pending' }))
    } else {
      const r = await fetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveData),
      })
      setSaveStatus(p => ({ ...p, [key]: r.ok ? 'saved' : 'pending' }))
      if (!r.ok) setError(`שגיאה בשמירת "${ev.title}"`)
    }
  }

  async function saveReminder(rem: Reminder, key: string) {
    const ov = itemOverrides[key] || {}
    const person = ov.person ?? rem.person
    const date = ov.dateStart ?? rem.due_date ?? new Date().toISOString().split('T')[0]
    const type = ov.itemType ?? 'reminder'

    setSaveStatus(p => ({ ...p, [key]: 'saving' }))

    if (type === 'event') {
      const r = await fetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person: person === 'family' ? 'family' : person, title: rem.text, date, start_time: null, end_time: null, location: null, notes: null, is_recurring: false, recurrence_days: null, meeting_link: null, source: 'inbox' }),
      })
      setSaveStatus(p => ({ ...p, [key]: r.ok ? 'saved' : 'pending' }))
      return
    }
    const r = await fetch('/api/reminders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rem.text, person: person === 'family' ? null : person, date, completed: false }),
    })
    setSaveStatus(p => ({ ...p, [key]: r.ok ? 'saved' : 'pending' }))
  }

  async function saveShopping(item: ShoppingItem, key: string) {
    const ov = itemOverrides[key] || {}
    const type = ov.itemType ?? 'shopping'
    setSaveStatus(p => ({ ...p, [key]: 'saving' }))

    if (type === 'reminder') {
      const person = ov.person ?? 'family'
      const r = await fetch('/api/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: item.item, person: person === 'family' ? null : person, date: new Date().toISOString().split('T')[0], completed: false }),
      })
      setSaveStatus(p => ({ ...p, [key]: r.ok ? 'saved' : 'pending' }))
      return
    }
    const text = item.qty ? `${item.qty} ${item.item}` : item.item
    const r = await fetch('/api/reminders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.notes ? `${text} (${item.notes})` : text, person: '__grocery__', date: new Date().toISOString().split('T')[0], completed: false }),
    })
    setSaveStatus(p => ({ ...p, [key]: r.ok ? 'saved' : 'pending' }))
  }

  async function saveAllVisible() {
    const saves: Promise<void>[] = []
    events.forEach((ev, i) => {
      const key = `ev-${i}`
      if (saveStatus[key] !== 'saved' && saveStatus[key] !== 'dismissed')
        saves.push(saveEvent(ev, key))
    })
    reminders.forEach((rem, i) => {
      const key = `rem-${i}`
      if (saveStatus[key] !== 'saved' && saveStatus[key] !== 'dismissed')
        saves.push(saveReminder(rem, key))
    })
    shopping.forEach((item, i) => {
      const key = `shop-${i}`
      if (saveStatus[key] !== 'saved' && saveStatus[key] !== 'dismissed')
        saves.push(saveShopping(item, key))
    })
    await Promise.all(saves)
  }

  function dismissItem(key: string) { setSaveStatus(p => ({ ...p, [key]: 'dismissed' })) }

  // ── Group by person ──────────────────────────────────────────────────────
  const personKeys = ['ami', 'alex', 'itan', 'assaf', 'danil', 'family']
  const eventsByPerson   = Object.fromEntries(personKeys.map(k => [k, events.map((e, i) => ({ ...e, _idx: i })).filter(e => (itemOverrides[`ev-${e._idx}`]?.person ?? e.person) === k)]))
  const remindersByPerson = Object.fromEntries(personKeys.map(k => [k, reminders.map((r, i) => ({ ...r, _idx: i })).filter(r => (itemOverrides[`rem-${r._idx}`]?.person ?? r.person) === k)]))
  const notesByPerson    = Object.fromEntries(personKeys.map(k => [k, notes.map((n, i) => ({ ...n, _idx: i })).filter(n => n.person === k)]))
  const activePersons = personKeys.filter(k =>
    (eventsByPerson[k]?.length || 0) + (remindersByPerson[k]?.length || 0) + (notesByPerson[k]?.length || 0) > 0
  )

  const totalItems = events.length + reminders.length + shopping.length + notes.length
  const visibleItems = events.filter((_, i) => saveStatus[`ev-${i}`] !== 'dismissed').length
    + reminders.filter((_, i) => saveStatus[`rem-${i}`] !== 'dismissed').length
    + shopping.filter((_, i) => saveStatus[`shop-${i}`] !== 'dismissed').length

  const hasConv = convTurns.length > 0

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#05101f 0%,#0b1a34 35%,#0d1f3a 60%,#08111f 100%)', backgroundAttachment: 'fixed' }} dir="rtl">
      <div className="max-w-2xl mx-auto px-3 pb-16 pt-2">

        {/* Header */}
        <div className="mb-4 rounded-3xl overflow-hidden shadow-xl" style={{ background: 'linear-gradient(135deg,#0a0f1e 0%,#0f2744 60%,#1a3a6e 100%)' }}>
          <div className="px-4 pt-4 pb-4 flex items-center justify-between gap-3">
            <a href="/kids" className="text-white/60 hover:text-white text-sm px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 transition flex items-center gap-1 whitespace-nowrap flex-shrink-0">
              ← חזור
            </a>
            <div className="text-right flex-1 min-w-0">
              <h1 className="text-xl font-black text-white">📥 עוזר משפחתי חכם</h1>
              <p className="text-xs text-white/45 mt-0.5">שלח טקסט, תמונות, WhatsApp — Claude ישאל ויבין</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <div className="mb-3 p-3 rounded-2xl text-red-300 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>{error}</div>}

        {/* Conversation history */}
        {hasConv && (
          <div className="mb-4 rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button onClick={() => setHistoryExpanded(x => !x)} className="w-full flex items-center justify-between px-4 py-3">
              <span className="text-xs text-white/35">{historyExpanded ? '▲' : '▼'} {convTurns.length / 2} תורות שיחה</span>
              <span className="text-sm font-black text-white/60">💬 שיחה</span>
            </button>
            {historyExpanded && (
              <div className="px-3 pb-3 space-y-2 max-h-72 overflow-y-auto">
                {convTurns.map((turn, i) => (
                  <div key={i} className="rounded-2xl px-3 py-2.5 text-sm"
                    style={{ background: turn.role === 'user' ? 'rgba(255,255,255,0.07)' : 'rgba(245,158,11,0.1)', border: `1px solid ${turn.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.2)'}` }}>
                    <div className="text-xs font-bold mb-1" style={{ color: turn.role === 'user' ? 'rgba(255,255,255,0.4)' : '#F59E0B' }}>
                      {turn.role === 'user' ? '👤 את/ה' : '🤖 Claude'}
                    </div>
                    {turn.images && turn.images.length > 0 && (
                      <div className="flex gap-1.5 mb-1.5 flex-wrap">
                        {turn.images.map((img, j) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={j} src={img} alt="" className="h-12 w-12 object-cover rounded-lg opacity-70" />
                        ))}
                      </div>
                    )}
                    <div className="text-white/70 text-xs leading-relaxed">{turn.role === 'user' ? (turn.content || '(תמונה)') : (turn.summary || turn.content)}</div>
                    <div className="text-white/20 text-xs mt-1">{new Date(turn.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="rounded-3xl mb-4 p-4" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          {pendingImages.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-16 w-16 object-cover rounded-xl" style={{ border: '2px solid rgba(245,158,11,0.4)' }} />
                  <button onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'rgba(239,68,68,0.9)' }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleProcess(false) } }}
            className="w-full rounded-2xl p-4 text-sm resize-none focus:outline-none leading-relaxed text-white/90 placeholder-white/30"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', minHeight: '120px' }}
            placeholder={hasConv ? 'המשך — ענה לשאלות, תקן, או הוסף מידע...' : 'הדבק כאן:\n• הודעת WhatsApp / מייל\n• "אמי — שיעור שחייה יום ב׳ 14:00"\n• רשימת קניות, תזכורות\n• תמונות: Ctrl+V / Cmd+V'}
            dir="rtl"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={() => fileInputRef.current?.click()}
              className="text-white/60 hover:text-white text-sm px-3 py-3 rounded-2xl transition active:scale-95"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }} title="העלה תמונה">📎</button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { if (e.target.files) { addImages(e.target.files); e.target.value = '' } }} />
            <button onClick={() => handleProcess(false)} disabled={processing || (!rawText.trim() && pendingImages.length === 0)}
              className="text-white font-black px-5 py-3 rounded-2xl transition disabled:opacity-40 flex items-center gap-2 text-sm flex-1 justify-center shadow-md active:scale-95"
              style={{ background: processing ? '#F59E0B' : 'linear-gradient(135deg,#F59E0B,#F97316)', boxShadow: '0 4px 14px rgba(245,158,11,0.4)' }}>
              {processing ? <><span className="animate-spin inline-block">⏳</span> מנתח…</> : hasConv ? '🤖 שלח' : '🤖 נתח'}
            </button>
            {hasConv && (
              <button onClick={() => { setConvTurns([]); setApiHistory([]); setRawText(''); setPendingImages([]); setEvents([]); setReminders([]); setShopping([]); setNotes([]); setQuestions([]); setContextSummary(''); setHasData(false); setSaveStatus({}); setItemOverrides({}); setAssignOpen(new Set()) }}
                className="text-white/40 hover:text-white/70 text-xs px-3 py-3 rounded-2xl transition active:scale-95"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} title="אפס שיחה">🗑</button>
            )}
          </div>
          <div className="mt-1.5 text-xs text-white/20 text-right">⌘↵ לשליחה • Ctrl+V להדבקת תמונות</div>
        </div>

        {/* Clarifying questions — Claude asks */}
        {questions.length > 0 && (
          <div className="mb-4 rounded-3xl p-4" style={{ background: 'rgba(59,130,246,0.1)', border: '2px solid rgba(59,130,246,0.3)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🤔</span>
              <div>
                <div className="font-black text-blue-200 text-base">Claude שואל:</div>
                <div className="text-xs text-blue-400/70">ענה כדי לשפר את הדיוק</div>
              </div>
            </div>
            <div className="space-y-3">
              {questions.map(q => (
                <div key={q.id} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div className="text-sm font-bold text-white/90 mb-1">{q.question}</div>
                  {q.context && <div className="text-xs text-white/35 mb-2">({q.context})</div>}
                  <input type="text" value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleProcess(true) }}
                    placeholder="תשובתך..." className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none text-white/90 placeholder-white/30"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>
              ))}
            </div>
            <button onClick={() => handleProcess(true)} disabled={processing}
              className="mt-3 w-full text-white font-black py-3 rounded-2xl transition disabled:opacity-40 text-sm active:scale-95"
              style={{ background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}>
              {processing ? '⏳ שולח…' : '✅ שלח תשובות'}
            </button>
            <button onClick={() => setQuestions([])} className="mt-2 w-full text-blue-400/60 text-xs hover:text-blue-300 transition">
              דלג ✕
            </button>
          </div>
        )}

        {/* Context summary */}
        {contextSummary && (
          <div className="mb-4 px-4 py-2.5 rounded-2xl text-sm text-amber-300 font-medium flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <span className="flex-shrink-0">💡</span>
            <span>{contextSummary}</span>
          </div>
        )}

        {/* Extracted data */}
        {hasData && totalItems > 0 && (
          <div className="space-y-4 mb-4">

            {/* Save All */}
            {visibleItems > 0 && (
              <button onClick={saveAllVisible}
                className="w-full text-white font-black py-3 rounded-2xl transition flex items-center justify-center gap-2 shadow-md active:scale-95 text-sm"
                style={{ background: 'linear-gradient(135deg,#22C55E,#16A34A)', boxShadow: '0 4px 14px rgba(34,197,94,0.4)' }}>
                💾 שמור הכל ({visibleItems} פריטים)
              </button>
            )}

            {/* Per-person boxes */}
            {activePersons.map(personKey => {
              const p = getPerson(personKey)
              const pEvents    = eventsByPerson[personKey] || []
              const pReminders = remindersByPerson[personKey] || []
              const pNotes     = notesByPerson[personKey] || []

              const visibleEvs  = pEvents.filter(ev => saveStatus[`ev-${ev._idx}`] !== 'dismissed')
              const visibleRems = pReminders.filter(rem => saveStatus[`rem-${rem._idx}`] !== 'dismissed')
              if (visibleEvs.length === 0 && visibleRems.length === 0 && pNotes.length === 0) return null

              return (
                <div key={personKey} className="rounded-3xl overflow-hidden" style={{ border: `2px solid ${p.color}33` }}>
                  <div className="px-4 py-3 flex items-center gap-3" style={{ background: `linear-gradient(135deg,${p.color}22,${p.color}10)`, borderBottom: `1px solid ${p.color}20` }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0" style={{ background: p.color }}>{p.name.slice(0, 1)}</div>
                    <div className="font-black text-white text-base flex-1">{p.name}</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {visibleEvs.length > 0 && <span className="text-xs px-2 py-1 rounded-xl font-bold" style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>{visibleEvs.length} אירועים</span>}
                      {visibleRems.length > 0 && <span className="text-xs px-2 py-1 rounded-xl font-bold" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>{visibleRems.length} תזכורות</span>}
                      {pNotes.length > 0 && <span className="text-xs px-2 py-1 rounded-xl font-bold" style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>{pNotes.length} הערות</span>}
                    </div>
                  </div>

                  <div className="p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {/* Events */}
                    {visibleEvs.map(ev => {
                      const key = `ev-${ev._idx}`
                      const ov = itemOverrides[key] || {}
                      const effectivePerson = ov.person ?? ev.person
                      const effectiveType = ov.itemType ?? 'event'
                      const isOpen = assignOpen.has(key)

                      return (
                        <div key={key} className="rounded-2xl p-3" style={{ background: !ev.person || !ev.date ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.07)', border: `1px solid ${!ev.person || !ev.date ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                          <div className="flex items-start justify-between gap-2">
                            <SaveBtn status={saveStatus[key] || 'pending'} onSave={() => saveEvent(ev, key)} onDismiss={() => dismissItem(key)} />
                            <div className="flex-1 text-right min-w-0">
                              <div className="font-bold text-white/90 text-sm">{ev.title}</div>
                              {(!ev.person || !ev.date) && <div className="text-xs text-orange-400">⚠️ יש להשלים פרטים</div>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Type badge */}
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: effectiveType === 'event' ? 'rgba(34,197,94,0.2)' : effectiveType === 'reminder' ? 'rgba(245,158,11,0.2)' : 'rgba(168,85,247,0.2)', color: effectiveType === 'event' ? '#4ade80' : effectiveType === 'reminder' ? '#fbbf24' : '#d8b4fe' }}>
                                {effectiveType === 'event' ? '📅' : effectiveType === 'reminder' ? '🔔' : '🛒'}
                              </span>
                              {/* Assign button */}
                              <button onClick={() => toggleAssign(key)}
                                className="text-xs px-2 py-0.5 rounded-full font-bold transition"
                                style={{ background: isOpen ? `${getPerson(effectivePerson).color}33` : 'rgba(255,255,255,0.07)', color: isOpen ? getPerson(effectivePerson).color : 'rgba(255,255,255,0.4)', border: `1px solid ${isOpen ? getPerson(effectivePerson).color + '44' : 'rgba(255,255,255,0.1)'}` }}>
                                {getPerson(effectivePerson).name} {isOpen ? '▲' : '▾'}
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {ev.date && <span className="text-xs px-2 py-0.5 rounded-full text-blue-300" style={{ background: 'rgba(59,130,246,0.2)' }}>📅 {formatDate(ov.dateStart ?? ev.date)}</span>}
                            {ov.dateEnd && <span className="text-xs px-2 py-0.5 rounded-full text-blue-400" style={{ background: 'rgba(59,130,246,0.15)' }}>↔ עד {formatDate(ov.dateEnd)}</span>}
                            {ev.start_time && <span className="text-xs px-2 py-0.5 rounded-full text-white/60" style={{ background: 'rgba(255,255,255,0.08)' }}>⏰ {ev.start_time}{ev.end_time ? `–${ev.end_time}` : ''}</span>}
                            {ev.location && <span className="text-xs px-2 py-0.5 rounded-full text-white/60" style={{ background: 'rgba(255,255,255,0.08)' }}>📍 {ev.location}</span>}
                          </div>
                          {ev.notes && <div className="mt-1.5 text-xs text-white/50 rounded-lg px-2.5 py-1.5 text-right" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>📝 {ev.notes}</div>}
                          {/* Offer image attachment if images were processed */}
                          {lastProcessedImages.length > 0 && saveStatus[key] !== 'saved' && (
                            <button onClick={() => setAttachImage(p => ({ ...p, [key]: !p[key] }))}
                              className="mt-1.5 text-xs px-2.5 py-1 rounded-full font-bold transition flex items-center gap-1.5"
                              style={{ background: attachImage[key] ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', color: attachImage[key] ? '#fbbf24' : 'rgba(255,255,255,0.3)', border: `1px solid ${attachImage[key] ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                              📎 {attachImage[key] ? 'תמונה תצורף לאירוע ✓' : 'צרף תמונה לאירוע?'}
                            </button>
                          )}
                          {isOpen && (
                            <AssignmentRow itemKey={key} override={ov} originalPerson={ev.person} originalType="event" originalDate={ev.date} onOverride={applyOverride} />
                          )}
                        </div>
                      )
                    })}

                    {/* Reminders */}
                    {visibleRems.map(rem => {
                      const key = `rem-${rem._idx}`
                      const ov = itemOverrides[key] || {}
                      const effectivePerson = ov.person ?? rem.person
                      const effectiveType = ov.itemType ?? 'reminder'
                      const isOpen = assignOpen.has(key)

                      return (
                        <div key={key} className="rounded-2xl p-2.5" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <div className="flex items-center gap-2">
                            <SaveBtn status={saveStatus[key] || 'pending'} onSave={() => saveReminder(rem, key)} onDismiss={() => dismissItem(key)} />
                            <div className="flex-1 text-right text-sm text-white/80">{rem.text}</div>
                            {rem.due_date && !ov.dateStart && <span className="text-xs px-1.5 py-0.5 rounded-full text-amber-300 flex-shrink-0" style={{ background: 'rgba(245,158,11,0.2)' }}>{formatDate(rem.due_date)}</span>}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-base">{effectiveType === 'event' ? '📅' : effectiveType === 'shopping' ? '🛒' : '🔔'}</span>
                              <button onClick={() => toggleAssign(key)}
                                className="text-xs px-2 py-0.5 rounded-full font-bold transition"
                                style={{ background: isOpen ? `${getPerson(effectivePerson).color}33` : 'rgba(255,255,255,0.07)', color: isOpen ? getPerson(effectivePerson).color : 'rgba(255,255,255,0.4)', border: `1px solid ${isOpen ? getPerson(effectivePerson).color + '44' : 'rgba(255,255,255,0.1)'}` }}>
                                {getPerson(effectivePerson).name} {isOpen ? '▲' : '▾'}
                              </button>
                            </div>
                          </div>
                          {isOpen && (
                            <AssignmentRow itemKey={key} override={ov} originalPerson={rem.person} originalType="reminder" originalDate={rem.due_date || undefined} onOverride={applyOverride} />
                          )}
                        </div>
                      )
                    })}

                    {/* Notes */}
                    {pNotes.map((note, i) => (
                      <div key={i} className="rounded-2xl p-2.5 flex items-start gap-2" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <button onClick={() => setNotes(prev => prev.filter((_, j) => j !== note._idx))} className="text-white/25 hover:text-red-400 flex-shrink-0 mt-0.5">×</button>
                        <div className="flex-1 text-right">
                          <div className="text-xs text-blue-400 font-bold mb-0.5">{note.category}</div>
                          <div className="text-sm text-white/70">{note.content}</div>
                        </div>
                        <span className="text-base flex-shrink-0">📝</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Shopping */}
            {shopping.filter((_, i) => saveStatus[`shop-${i}`] !== 'dismissed').length > 0 && (
              <div className="rounded-3xl overflow-hidden" style={{ border: '2px solid rgba(168,85,247,0.25)' }}>
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(168,85,247,0.1))', borderBottom: '1px solid rgba(168,85,247,0.2)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: '#a855f7' }}>🛒</div>
                  <div className="font-black text-white text-base flex-1">רשימת קניות</div>
                  <span className="text-xs px-2 py-1 rounded-xl font-bold" style={{ background: 'rgba(168,85,247,0.2)', color: '#d8b4fe' }}>{shopping.filter((_, i) => saveStatus[`shop-${i}`] !== 'dismissed').length} פריטים</span>
                </div>
                <div className="p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {shopping.map((item, i) => {
                    const key = `shop-${i}`
                    if (saveStatus[key] === 'dismissed') return null
                    const ov = itemOverrides[key] || {}
                    const isOpen = assignOpen.has(key)
                    const effectiveType = ov.itemType ?? 'shopping'
                    return (
                      <div key={i} className="rounded-2xl px-3 py-2.5" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
                        <div className="flex items-center gap-2">
                          <SaveBtn status={saveStatus[key] || 'pending'} onSave={() => saveShopping(item, key)} onDismiss={() => dismissItem(key)} />
                          <div className="flex-1 text-right text-sm font-medium text-white/80">
                            {item.qty && <span className="text-purple-400 font-bold ml-1.5 text-xs">{item.qty}</span>}
                            {item.item}
                            {item.notes && <span className="text-white/40 text-xs mr-1.5"> — {item.notes}</span>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-base">{effectiveType === 'event' ? '📅' : effectiveType === 'reminder' ? '🔔' : '🛒'}</span>
                            <button onClick={() => toggleAssign(key)}
                              className="text-xs px-2 py-0.5 rounded-full font-bold text-white/40 transition"
                              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                              ✎ {isOpen ? '▲' : '▾'}
                            </button>
                          </div>
                        </div>
                        {isOpen && (
                          <AssignmentRow itemKey={key} override={ov} originalPerson="family" originalType="shopping" onOverride={applyOverride} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {hasData && totalItems === 0 && !processing && (
          <div className="rounded-3xl p-10 text-center mb-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-5xl mb-3">🔍</div>
            <div className="text-white/70 font-black text-lg">לא נמצא מידע לחילוץ</div>
            <div className="text-sm text-white/35 mt-1.5">נסה טקסט עם אירועים, תאריכים, או פעולות</div>
          </div>
        )}

        {/* Extracted links — auto-saved to family links */}
        {extractedLinks.length > 0 && (
          <div className="mb-4 rounded-3xl overflow-hidden" style={{ border: '2px solid rgba(14,165,233,0.3)' }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.2),rgba(14,165,233,0.1))', borderBottom: '1px solid rgba(14,165,233,0.2)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: '#0ea5e9' }}>🔗</div>
              <div className="font-black text-white text-base flex-1">קישורים שנשמרו</div>
              <span className="text-xs px-2 py-1 rounded-xl font-bold" style={{ background: 'rgba(14,165,233,0.2)', color: '#38bdf8' }}>נשמר אוטומטית ✓</span>
            </div>
            <div className="p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {extractedLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <span className="text-sky-400 flex-shrink-0">🔗</span>
                  <div className="flex-1 text-right min-w-0">
                    <div className="text-sm font-bold text-white/85 truncate">{link.title}</div>
                    <a href={link.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300 truncate block transition">
                      {link.url.length > 50 ? link.url.slice(0, 50) + '…' : link.url}
                    </a>
                  </div>
                  {savedLinkUrls.has(link.url)
                    ? <span className="text-xs text-green-400 flex-shrink-0 font-bold">✓</span>
                    : <span className="text-xs text-white/30 flex-shrink-0">…</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Log */}
        <ActivityLog />
      </div>
    </div>
  )
}
