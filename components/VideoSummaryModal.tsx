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
const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

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

function renderIntro(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, today: Date) {
  // Background
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

  // House emoji
  ctx.font = `${W * 0.22}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🏠', W / 2, H * 0.3)

  // Title
  ctx.font = `900 ${W * 0.11}px Arial`
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText('משפחת אלוני', W / 2, H * 0.46)

  // Subtitle
  ctx.font = `bold ${W * 0.065}px Arial`
  ctx.fillStyle = '#94A3B8'
  ctx.fillText('סיכום שבועי', W / 2, H * 0.54)

  // Date line
  ctx.font = `${W * 0.055}px Arial`
  ctx.fillStyle = '#60A5FA'
  const today2 = format(today, 'd MMMM', { locale: he })
  const end = format(addDays(today, 6), 'd MMMM yyyy', { locale: he })
  ctx.fillText(`${today2} – ${end}`, W / 2, H * 0.61)

  // Decorative line
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
  person: string, events: FetchedEvent[], today: Date,
) {
  const [c1, c2] = PERSON_COLORS[person]

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, c1)
  grad.addColorStop(0.5, '#111827')
  grad.addColorStop(1, '#030712')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Decorative circle top-right
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = c2
  ctx.beginPath(); ctx.arc(W * 0.9, H * 0.08, W * 0.45, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Fade in/out
  let alpha = 1
  if (t < 0.12) alpha = easeOut(t / 0.12)
  else if (t > 0.88) alpha = easeOut((1 - t) / 0.12)
  ctx.globalAlpha = alpha

  // Big emoji
  ctx.font = `${W * 0.22}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(PERSON_EMOJI[person], W / 2, H * 0.17)

  // Name
  ctx.font = `900 ${W * 0.13}px Arial`
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText(PERSON_NAMES[person], W / 2, H * 0.3)

  // Divider line
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W * 0.12, H * 0.36)
  ctx.lineTo(W * 0.88, H * 0.36)
  ctx.stroke()

  // Events
  if (events.length === 0) {
    ctx.font = `bold ${W * 0.075}px Arial`
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.textAlign = 'center'
    ctx.fillText('🎉 אין אירועים השבוע', W / 2, H * 0.52)
  } else {
    const MAX_SHOW = 5
    const showing = events.slice(0, MAX_SHOW)
    const CARD_H = H * 0.095
    const GAP = H * 0.012
    const START_Y = H * 0.39

    for (let i = 0; i < showing.length; i++) {
      const ev = showing[i]
      // Slide in from left (RTL)
      const slideDelay = 0.15 + i * 0.07
      const slideT = Math.max(0, Math.min(1, (t - slideDelay) / 0.22))
      const offsetX = (1 - easeOut(slideT)) * W * 0.6
      const cardY = START_Y + i * (CARD_H + GAP)

      ctx.save()
      ctx.translate(-offsetX, 0)

      // Card
      drawRoundRect(ctx, W * 0.06, cardY, W * 0.88, CARD_H, 14)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Left accent bar
      ctx.fillStyle = c2
      drawRoundRect(ctx, W * 0.06, cardY, 4, CARD_H, 2)
      ctx.fill()

      // Event title
      ctx.font = `bold ${W * 0.052}px Arial`
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      // Truncate
      let title = ev.title
      const maxW = W * 0.68
      while (ctx.measureText(title).width > maxW && title.length > 2)
        title = title.slice(0, -1)
      if (title !== ev.title) title += '…'
      ctx.fillText(title, W * 0.91, cardY + CARD_H * 0.35)

      // Date / time
      ctx.font = `${W * 0.038}px Arial`
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      let dateLabel = ''
      if (ev.is_recurring) {
        dateLabel = 'קבוע 🔄'
      } else {
        const d = new Date(ev.date + 'T12:00:00')
        dateLabel = format(d, 'EEEE, d/M', { locale: he })
      }
      const timeStr = ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ''
      ctx.fillText(dateLabel + timeStr, W * 0.91, cardY + CARD_H * 0.72)

      ctx.restore()
    }

    if (events.length > MAX_SHOW) {
      ctx.font = `${W * 0.042}px Arial`
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.textAlign = 'center'
      const moreY = START_Y + MAX_SHOW * (CARD_H + GAP) + GAP
      ctx.fillText(`+ ${events.length - MAX_SHOW} אירועים נוספים`, W / 2, moreY)
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

  // Fade in then hold
  const alpha = Math.min(t * 3, 1)
  ctx.globalAlpha = alpha

  ctx.font = `${W * 0.2}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('❤️', W / 2, H * 0.38)

  ctx.font = `900 ${W * 0.11}px Arial`
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText('שבוע נפלא!', W / 2, H * 0.52)

  ctx.font = `bold ${W * 0.07}px Arial`
  ctx.fillStyle = '#94A3B8'
  ctx.fillText('משפחת אלוני', W / 2, H * 0.6)

  ctx.globalAlpha = 1
}

function renderFrame(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  elapsed: number, byPerson: Record<string, FetchedEvent[]>, today: Date,
) {
  const INTRO_END  = 2      // seconds
  const PER_PERSON = 3      // seconds per person
  const OUTRO_START = INTRO_END + PEOPLE_ORDER.length * PER_PERSON  // 2 + 15 = 17
  const TOTAL = 20

  ctx.clearRect(0, 0, W, H)
  ctx.direction = 'rtl'

  if (elapsed < INTRO_END) {
    renderIntro(ctx, W, H, elapsed / INTRO_END, today)
  } else if (elapsed < OUTRO_START) {
    const offset = elapsed - INTRO_END
    const personIdx = Math.min(Math.floor(offset / PER_PERSON), PEOPLE_ORDER.length - 1)
    const personT = (offset % PER_PERSON) / PER_PERSON
    const person = PEOPLE_ORDER[personIdx]
    renderPerson(ctx, W, H, personT, person, byPerson[person] ?? [], today)
  } else {
    renderOutro(ctx, W, H, (elapsed - OUTRO_START) / (TOTAL - OUTRO_START))
  }
}

export default function VideoSummaryModal({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'generating' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const abortRef = useRef(false)

  const generate = useCallback(async () => {
    abortRef.current = false
    setStatus('loading')
    setProgress(0)

    // Fetch next 7 days events + recurring
    const today = new Date()
    const start = today.toISOString().split('T')[0]
    const end = addDays(today, 6).toISOString().split('T')[0]

    let allEvents: FetchedEvent[] = []
    try {
      const res = await fetch(`/api/events?start=${start}&end=${end}&include_recurring=true`)
      if (res.ok) allEvents = await res.json()
    } catch { /* use empty */ }

    // Group events by person, filter to next 7 days (recurring handled separately)
    const todayStr = today.toISOString().split('T')[0]
    const byPerson: Record<string, FetchedEvent[]> = {}
    for (const p of PEOPLE_ORDER) byPerson[p] = []

    for (const ev of allEvents) {
      if (!byPerson[ev.person]) continue
      if (ev.is_recurring) {
        // include recurring if they have any valid days
        if (!byPerson[ev.person].some(x => x.id === ev.id))
          byPerson[ev.person].push(ev)
      } else {
        byPerson[ev.person].push(ev)
      }
    }
    // Sort each person's events by date
    for (const p of PEOPLE_ORDER) {
      byPerson[p].sort((a, b) => {
        if (a.is_recurring && !b.is_recurring) return 1
        if (!a.is_recurring && b.is_recurring) return -1
        return a.date.localeCompare(b.date)
      })
    }

    setStatus('generating')

    const canvas = canvasRef.current
    if (!canvas) return

    // Portrait HD
    const W = 720, H = 1280
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Check MediaRecorder support
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
      try {
        recorder = new MediaRecorder(stream)
      } catch {
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

    const DURATION = 20  // seconds
    const startTime = performance.now()

    await new Promise<void>(resolve => {
      const frame = () => {
        if (abortRef.current) {
          recorder.stop()
          resolve()
          return
        }
        const elapsed = Math.min((performance.now() - startTime) / 1000, DURATION)
        setProgress(Math.floor((elapsed / DURATION) * 100))
        renderFrame(ctx, W, H, elapsed, byPerson, today)

        if (elapsed < DURATION) {
          requestAnimationFrame(frame)
        } else {
          recorder.stop()
          resolve()
        }
      }
      requestAnimationFrame(frame)
    })

    if (abortRef.current) {
      setStatus('idle')
      return
    }

    const blob = await done
    const url = URL.createObjectURL(blob)
    setVideoUrl(url)
    setStatus('done')
  }, [])

  const handleClose = () => {
    abortRef.current = true
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-black text-gray-900">🎬 סיכום וידאו שבועי</h2>
          <button onClick={handleClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg leading-none transition">×</button>
        </div>

        <div className="px-5 pb-5">
          {/* ── IDLE ── */}
          {status === 'idle' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">🎬</div>
              <p className="text-gray-600 text-sm mb-1">יוצר וידאו 20 שניות עם</p>
              <p className="text-gray-600 text-sm mb-4">האירועים השבועיים של כל בני המשפחה</p>
              <button
                onClick={generate}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black px-8 py-3 rounded-2xl text-base shadow-lg hover:scale-105 active:scale-95 transition-transform w-full"
              >
                ✨ צור וידאו AI
              </button>
            </div>
          )}

          {/* ── LOADING / GENERATING ── */}
          {(status === 'loading' || status === 'generating') && (
            <div className="py-4">
              {/* Live canvas preview */}
              <div className="rounded-2xl overflow-hidden mb-4 shadow-lg" style={{ aspectRatio: '9/16', background: '#0a0f1e' }}>
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain"
                  style={{ display: 'block' }}
                />
              </div>
              <div className="text-center mb-2">
                <p className="font-bold text-gray-700 text-sm">
                  {status === 'loading' ? 'טוען נתונים…' : `מייצר וידאו… ${progress}%`}
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {status === 'generating' && (
                <p className="text-xs text-gray-400 text-center mt-2">הוידאו מוצג בזמן אמת — ייקח כ-20 שניות</p>
              )}
            </div>
          )}

          {/* ── DONE ── */}
          {status === 'done' && videoUrl && (
            <div>
              <div className="rounded-2xl overflow-hidden mb-4 shadow-lg bg-black" style={{ aspectRatio: '9/16' }}>
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <a
                  href={videoUrl}
                  download={`family-summary-${new Date().toISOString().split('T')[0]}.webm`}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition"
                >
                  ⬇️ הורד וידאו
                </a>
                <button
                  onClick={() => { setStatus('idle'); if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null) } }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition"
                >
                  🔄 צור שוב
                </button>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {status === 'error' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-red-600 text-sm mb-4">{errorMsg}</p>
              <button onClick={() => setStatus('idle')} className="text-purple-600 underline text-sm font-bold">נסה שוב</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
