'use client'

import { useState, useRef, useCallback } from 'react'
import { format, addDays } from 'date-fns'
import { he } from 'date-fns/locale'

interface FetchedEvent {
  id: string; title: string; person: string; date: string
  start_time: string | null; location: string | null
  is_recurring: boolean; recurrence_days: string[] | null
}

const PEOPLE_ORDER = ['ami', 'alex', 'itan', 'assaf', 'danil']
const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

const PERSON_COLORS: Record<string, [string, string]> = {
  ami:   ['#C2185B', '#E91E63'],
  alex:  ['#6A1B9A', '#AB47BC'],
  itan:  ['#1B5E20', '#43A047'],
  assaf: ['#0D47A1', '#1E88E5'],
  danil: ['#004D40', '#26A69A'],
}
const PERSON_NAMES: Record<string, string> = {
  ami: 'אמי', alex: 'אלכס', itan: 'איתן', assaf: 'אסף', danil: 'דניאל',
}
const PERSON_EMOJI: Record<string, string> = {
  ami: '🌸', alex: '🎵', itan: '⚽', assaf: '💼', danil: '🌿',
}

function easeOut(t: number) { return 1 - Math.pow(1 - t, 3) }

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ── Canvas render functions ──────────────────────────────────────────────

function renderIntro(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, date: Date) {
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#0a0f1e')
  grad.addColorStop(0.5, '#0f2744')
  grad.addColorStop(1, '#1a3a6e')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Decorative circles
  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.fillStyle = '#4FC3F7'
  ctx.beginPath(); ctx.arc(W * 0.8, H * 0.15, W * 0.35, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(W * 0.1, H * 0.85, W * 0.3, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  const alpha = Math.min(t * 2.5, 1)
  ctx.globalAlpha = alpha

  ctx.font = `${W * 0.22}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🏠', W / 2, H * 0.28)

  ctx.font = `900 ${W * 0.11}px Arial`
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText('משפחת אלוני', W / 2, H * 0.43)

  // Day name (big)
  ctx.font = `bold ${W * 0.08}px Arial`
  ctx.fillStyle = '#94A3B8'
  ctx.fillText(format(date, 'EEEE', { locale: he }), W / 2, H * 0.52)

  // Full date
  ctx.font = `${W * 0.065}px Arial`
  ctx.fillStyle = '#60A5FA'
  ctx.fillText(format(date, 'd MMMM yyyy', { locale: he }), W / 2, H * 0.6)

  // Decorative line growing in
  const lineAlpha = Math.max(0, (t - 0.3) * 3)
  ctx.globalAlpha = lineAlpha * alpha
  ctx.strokeStyle = '#3B82F6'
  ctx.lineWidth = 3
  const lineW = W * 0.5 * easeOut(Math.min(1, (t - 0.3) * 3))
  ctx.beginPath()
  ctx.moveTo(W / 2 - lineW / 2, H * 0.66)
  ctx.lineTo(W / 2 + lineW / 2, H * 0.66)
  ctx.stroke()

  ctx.globalAlpha = 1
}

function renderPerson(
  ctx: CanvasRenderingContext2D, W: number, H: number, t: number,
  person: string, events: FetchedEvent[],
) {
  const [c1, c2] = PERSON_COLORS[person]

  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, c1)
  grad.addColorStop(0.5, '#111827')
  grad.addColorStop(1, '#030712')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Decorative circle
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = c2
  ctx.beginPath(); ctx.arc(W * 0.9, H * 0.08, W * 0.45, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  let alpha = 1
  if (t < 0.12) alpha = easeOut(t / 0.12)
  else if (t > 0.88) alpha = easeOut((1 - t) / 0.12)
  ctx.globalAlpha = alpha

  ctx.font = `${W * 0.22}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(PERSON_EMOJI[person], W / 2, H * 0.17)

  ctx.font = `900 ${W * 0.13}px Arial`
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText(PERSON_NAMES[person], W / 2, H * 0.3)

  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W * 0.12, H * 0.36)
  ctx.lineTo(W * 0.88, H * 0.36)
  ctx.stroke()

  if (events.length === 0) {
    ctx.font = `bold ${W * 0.075}px Arial`
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.textAlign = 'center'
    ctx.fillText('🎉 יום חופשי', W / 2, H * 0.52)
  } else {
    const MAX_SHOW = 5
    const showing = events.slice(0, MAX_SHOW)
    const CARD_H = H * 0.095
    const GAP = H * 0.012
    const START_Y = H * 0.39

    for (let i = 0; i < showing.length; i++) {
      const ev = showing[i]
      const slideDelay = 0.15 + i * 0.07
      const slideT = Math.max(0, Math.min(1, (t - slideDelay) / 0.22))
      const offsetX = (1 - easeOut(slideT)) * W * 0.6
      const cardY = START_Y + i * (CARD_H + GAP)

      ctx.save()
      ctx.translate(-offsetX, 0)

      drawRoundRect(ctx, W * 0.06, cardY, W * 0.88, CARD_H, 14)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = c2
      drawRoundRect(ctx, W * 0.06, cardY, 4, CARD_H, 2)
      ctx.fill()

      ctx.font = `bold ${W * 0.055}px Arial`
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      let title = ev.title
      const maxW = W * 0.68
      while (ctx.measureText(title).width > maxW && title.length > 2)
        title = title.slice(0, -1)
      if (title !== ev.title) title += '…'
      ctx.fillText(title, W * 0.91, cardY + CARD_H * 0.35)

      ctx.font = `${W * 0.04}px Arial`
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      const timeStr = ev.start_time ? `⏰ ${ev.start_time.slice(0, 5)}` : ''
      const locStr  = ev.location   ? `  📍 ${ev.location.slice(0, 18)}` : ''
      ctx.fillText((timeStr + locStr).trim() || (ev.is_recurring ? '🔄 קבוע' : ''), W * 0.91, cardY + CARD_H * 0.72)

      ctx.restore()
    }

    if (events.length > MAX_SHOW) {
      ctx.font = `${W * 0.042}px Arial`
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.textAlign = 'center'
      const moreY = START_Y + MAX_SHOW * (CARD_H + GAP) + GAP
      ctx.fillText(`+ ${events.length - MAX_SHOW} עוד`, W / 2, moreY)
    }
  }

  ctx.globalAlpha = 1
}

function renderOutro(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#0a0f1e')
  grad.addColorStop(1, '#0f2744')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const alpha = Math.min(t * 3, 1)
  ctx.globalAlpha = alpha

  ctx.font = `${W * 0.2}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('❤️', W / 2, H * 0.38)

  ctx.font = `900 ${W * 0.11}px Arial`
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText('יום נפלא!', W / 2, H * 0.52)

  ctx.font = `bold ${W * 0.07}px Arial`
  ctx.fillStyle = '#94A3B8'
  ctx.fillText('משפחת אלוני', W / 2, H * 0.6)

  ctx.globalAlpha = 1
}

function renderFrame(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  elapsed: number, byPerson: Record<string, FetchedEvent[]>, targetDate: Date,
) {
  // Only include people who have events (to keep the video shorter / more relevant)
  const activePeople = PEOPLE_ORDER.filter(p => (byPerson[p]?.length ?? 0) > 0)
  const showPeople   = activePeople.length > 0 ? activePeople : PEOPLE_ORDER

  const INTRO_END   = 2
  const PER_PERSON  = showPeople.length <= 3 ? 4 : 3   // 4s if few people, 3s otherwise
  const OUTRO_START = INTRO_END + showPeople.length * PER_PERSON
  const TOTAL       = OUTRO_START + 2  // 2s outro

  ctx.clearRect(0, 0, W, H)
  ctx.direction = 'rtl'

  if (elapsed < INTRO_END) {
    renderIntro(ctx, W, H, elapsed / INTRO_END, targetDate)
  } else if (elapsed < OUTRO_START) {
    const offset    = elapsed - INTRO_END
    const personIdx = Math.min(Math.floor(offset / PER_PERSON), showPeople.length - 1)
    const personT   = (offset % PER_PERSON) / PER_PERSON
    const person    = showPeople[personIdx]
    renderPerson(ctx, W, H, personT, person, byPerson[person] ?? [])
  } else {
    renderOutro(ctx, W, H, (elapsed - OUTRO_START) / 2)
  }

  return OUTRO_START + 2  // total duration
}

// ── Modal ────────────────────────────────────────────────────────────────

type Status = 'picking' | 'loading' | 'generating' | 'done' | 'error'

export default function VideoSummaryModal({ onClose, defaultDate }: {
  onClose: () => void
  defaultDate?: Date
}) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  const [status,     setStatus]     = useState<Status>('picking')
  const [targetDate, setTargetDate] = useState<Date>(defaultDate ?? today)
  const [progress,   setProgress]   = useState(0)
  const [videoUrl,   setVideoUrl]   = useState<string | null>(null)
  const [errorMsg,   setErrorMsg]   = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef  = useRef(false)

  const dateStr = targetDate.toISOString().split('T')[0]

  // Quick-pick buttons
  const QUICK: { label: string; date: Date }[] = [
    { label: 'היום',  date: today },
    { label: 'מחר',   date: addDays(today, 1) },
    { label: '+2',    date: addDays(today, 2) },
    { label: '+3',    date: addDays(today, 3) },
  ]

  const generate = useCallback(async (forDate: Date) => {
    abortRef.current = false
    setStatus('loading')
    setProgress(0)

    const dateKey   = forDate.toISOString().split('T')[0]
    const dayOfWeek = DAY_KEYS[forDate.getDay()]

    // Fetch events for that exact day + recurring events
    let allEvents: FetchedEvent[] = []
    try {
      const res = await fetch(`/api/events?start=${dateKey}&end=${dateKey}&include_recurring=true`)
      if (res.ok) allEvents = await res.json()
    } catch { /* use empty */ }

    // Group by person, filtering recurring events to this day-of-week
    const byPerson: Record<string, FetchedEvent[]> = {}
    for (const p of PEOPLE_ORDER) byPerson[p] = []

    for (const ev of allEvents) {
      if (!byPerson[ev.person]) continue
      if (ev.is_recurring) {
        // Only include if this recurring event occurs on this day of week
        if (ev.recurrence_days?.includes(dayOfWeek))
          byPerson[ev.person].push(ev)
      } else {
        byPerson[ev.person].push(ev)
      }
    }

    // Sort each person's events by start_time
    for (const p of PEOPLE_ORDER) {
      byPerson[p].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    }

    setStatus('generating')

    const canvas = canvasRef.current
    if (!canvas) return

    const W = 720, H = 1280
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Detect video MIME support
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4'

    let stream: MediaStream
    try {
      stream = canvas.captureStream(30)
    } catch {
      setErrorMsg('הדפדפן לא תומך ביצירת וידאו מ-Canvas')
      setStatus('error')
      return
    }

    const chunks: BlobPart[] = []
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
    } catch {
      try { recorder = new MediaRecorder(stream) }
      catch {
        setErrorMsg('MediaRecorder לא נתמך בדפדפן זה')
        setStatus('error')
        return
      }
    }

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    const done = new Promise<Blob>(resolve => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }))
    })

    recorder.start(200)
    const startTime = performance.now()
    let totalDuration = 20  // will be updated by renderFrame return value

    await new Promise<void>(resolve => {
      const frame = () => {
        if (abortRef.current) { recorder.stop(); resolve(); return }
        const elapsed = (performance.now() - startTime) / 1000
        totalDuration = renderFrame(ctx, W, H, elapsed, byPerson, forDate)
        setProgress(Math.min(99, Math.floor((elapsed / totalDuration) * 100)))

        if (elapsed < totalDuration) {
          requestAnimationFrame(frame)
        } else {
          recorder.stop()
          resolve()
        }
      }
      requestAnimationFrame(frame)
    })

    if (abortRef.current) { setStatus('picking'); return }

    const blob = await done
    setVideoUrl(URL.createObjectURL(blob))
    setStatus('done')
  }, [])

  const handleClose = () => {
    abortRef.current = true
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    onClose()
  }

  const resetToPickDate = () => {
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null) }
    setStatus('picking')
  }

  const isToday    = dateStr === today.toISOString().split('T')[0]
  const isTomorrow = dateStr === addDays(today, 1).toISOString().split('T')[0]
  const dateDisplayLabel = isToday ? 'היום' : isTomorrow ? 'מחר' : format(targetDate, 'd/M/yyyy')

  return (
    <div
      className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-black text-gray-900">🎬 סיכום יומי — וידאו AI</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg leading-none transition"
          >×</button>
        </div>

        <div className="px-5 pb-5">

          {/* ── DATE PICKER ── */}
          {status === 'picking' && (
            <div>
              <p className="text-gray-500 text-sm mb-3 text-center">בחר/י יום ליצירת הוידאו</p>

              {/* Quick picks */}
              <div className="flex gap-2 mb-3 justify-center">
                {QUICK.map(q => {
                  const qStr = q.date.toISOString().split('T')[0]
                  const active = qStr === dateStr
                  return (
                    <button
                      key={qStr}
                      onClick={() => setTargetDate(new Date(qStr + 'T12:00:00'))}
                      className={`px-3 py-1.5 rounded-xl text-sm font-bold transition border-2 ${
                        active
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      {q.label}
                    </button>
                  )
                })}
              </div>

              {/* Date input */}
              <div className="mb-4">
                <input
                  type="date"
                  value={dateStr}
                  onChange={e => {
                    const v = e.target.value
                    if (v) setTargetDate(new Date(v + 'T12:00:00'))
                  }}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:border-purple-400 text-gray-700"
                />
              </div>

              {/* Selected date display */}
              <div className="bg-purple-50 rounded-2xl px-4 py-3 mb-4 text-center">
                <p className="text-xs text-purple-400 mb-0.5">יוצר וידאו ל:</p>
                <p className="font-black text-purple-700 text-base">
                  {format(targetDate, 'EEEE', { locale: he })}
                </p>
                <p className="text-purple-600 text-sm">{format(targetDate, 'd MMMM yyyy', { locale: he })}</p>
              </div>

              <button
                onClick={() => generate(targetDate)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black px-8 py-3 rounded-2xl text-base shadow-lg hover:scale-105 active:scale-95 transition-transform w-full"
              >
                ✨ צור וידאו
              </button>
            </div>
          )}

          {/* ── LOADING / GENERATING ── */}
          {(status === 'loading' || status === 'generating') && (
            <div className="py-2">
              <div className="rounded-2xl overflow-hidden mb-4 shadow-lg" style={{ aspectRatio: '9/16', background: '#0a0f1e' }}>
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain"
                  style={{ display: 'block' }}
                />
              </div>
              <p className="font-bold text-gray-700 text-sm text-center mb-2">
                {status === 'loading' ? 'טוען נתונים…' : `מייצר וידאו ל${dateDisplayLabel}… ${progress}%`}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {status === 'generating' && (
                <p className="text-xs text-gray-400 text-center mt-2">הוידאו מוצג בזמן אמת</p>
              )}
            </div>
          )}

          {/* ── DONE ── */}
          {status === 'done' && videoUrl && (
            <div>
              <p className="text-center text-sm font-bold text-gray-600 mb-2">
                📅 {format(targetDate, 'EEEE, d MMMM yyyy', { locale: he })}
              </p>
              <div className="rounded-2xl overflow-hidden mb-3 shadow-lg bg-black" style={{ aspectRatio: '9/16' }}>
                <video
                  src={videoUrl}
                  controls autoPlay loop playsInline
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <a
                  href={videoUrl}
                  download={`family-${dateStr}.webm`}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition"
                >
                  ⬇️ הורד
                </a>
                <button
                  onClick={resetToPickDate}
                  className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold py-2.5 rounded-xl text-sm transition"
                >
                  📅 יום אחר
                </button>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {status === 'error' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-red-600 text-sm mb-4">{errorMsg}</p>
              <button onClick={resetToPickDate} className="text-purple-600 underline text-sm font-bold">חזור</button>
            </div>
          )}

          {/* Hidden canvas (only visible during generation) */}
          {status !== 'loading' && status !== 'generating' && (
            <canvas ref={canvasRef} className="hidden" />
          )}
        </div>
      </div>
    </div>
  )
}
