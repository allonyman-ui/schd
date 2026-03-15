'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { format } from 'date-fns'

interface CalEvent {
  id: string
  title: string
  person: string
  start_time: string | null
  is_recurring: boolean
  recurrence_days: string[] | null
  date: string
}

interface ReminderToast {
  id: string
  eventId: string
  title: string
  person: string
  startTime: string
  minutesBefore: number
}

const PERSON_HE: Record<string, string> = {
  ami: 'עמי',
  itan: 'איתן',
  alex: 'אלכס',
  assaf: 'אסף',
  danil: 'דניאל',
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// ── Web Audio chime ────────────────────────────────────────────────────────────
function playChime(minutesBefore: number) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    // 10 min → gentle two-note (C5 → E5)
    // 5 min  → urgent three-note chord roll (C5 → E5 → G5) played twice
    const notes = minutesBefore === 5
      ? [523.25, 659.25, 783.99, 659.25, 523.25]
      : [523.25, 659.25]

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.value = freq

      const t = ctx.currentTime + i * 0.2
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(minutesBefore === 5 ? 0.35 : 0.25, t + 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65)

      osc.start(t)
      osc.stop(t + 0.7)
    })

    // Clean up AudioContext after playback
    setTimeout(() => ctx.close().catch(() => {}), (notes.length * 0.2 + 0.8) * 1000)
  } catch {
    // Web Audio not available — silent fail
  }
}

// ── Single Toast Card ──────────────────────────────────────────────────────────
function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ReminderToast
  onDismiss: () => void
}) {
  const is5 = toast.minutesBefore === 5

  return (
    <div
      className={`
        flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border-2
        animate-reminder-in
        ${is5
          ? 'bg-orange-50 border-orange-400'
          : 'bg-sky-50 border-sky-400'
        }
      `}
      dir="rtl"
    >
      {/* Icon */}
      <div className="text-3xl mt-0.5 flex-shrink-0">
        {is5 ? '⏰' : '🔔'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm leading-snug ${is5 ? 'text-orange-700' : 'text-sky-700'}`}>
          מתחיל בעוד {toast.minutesBefore} דקות
        </div>
        <div className="text-gray-900 font-semibold text-base mt-0.5 truncate">
          {toast.title}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span>👤 {PERSON_HE[toast.person] ?? toast.person}</span>
          <span>•</span>
          <span dir="ltr">🕐 {toast.startTime}</span>
        </div>
      </div>

      {/* Progress bar auto-dismiss indicator */}
      <button
        onClick={onDismiss}
        className={`flex-shrink-0 text-lg leading-none mt-0.5 transition
          ${is5 ? 'text-orange-400 hover:text-orange-700' : 'text-sky-400 hover:text-sky-700'}
        `}
        aria-label="סגור"
      >
        ✕
      </button>
    </div>
  )
}

// ── Main Provider ──────────────────────────────────────────────────────────────
export default function EventReminderProvider() {
  const [toasts, setToasts] = useState<ReminderToast[]>([])
  const firedRef = useRef<Set<string>>(new Set())
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = dismissTimers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      dismissTimers.current.delete(id)
    }
  }, [])

  const scheduleAutoDismiss = useCallback((id: string, ms: number) => {
    const timer = setTimeout(() => dismissToast(id), ms)
    dismissTimers.current.set(id, timer)
  }, [dismissToast])

  const checkReminders = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const todayDayName = DAY_NAMES[now.getDay()]

    try {
      // Single call — returns non-recurring events for today + ALL recurring events
      const res = await fetch(`/api/events?include_recurring=true&start=${today}&end=${today}`)
      if (!res.ok) return
      const allEvents: CalEvent[] = await res.json()

      // Filter: keep today's non-recurring OR recurring that match today's weekday
      const todayEvents = allEvents.filter(e =>
        !e.is_recurring || (e.recurrence_days ?? []).includes(todayDayName)
      )

      const newToasts: ReminderToast[] = []

      for (const event of todayEvents) {
        if (!event.start_time) continue

        const [h, m] = event.start_time.split(':').map(Number)
        const eventMinutes = h * 60 + m
        const diff = eventMinutes - currentMinutes

        for (const target of [10, 5] as const) {
          // Window: target-0.5 < diff ≤ target+0.5  (fires once per 30-s poll cycle)
          if (diff > target - 0.5 && diff <= target + 0.5) {
            const fireKey = `${event.id}-${target}`
            if (!firedRef.current.has(fireKey)) {
              firedRef.current.add(fireKey)
              const toastId = `${fireKey}-${Date.now()}`
              newToasts.push({
                id: toastId,
                eventId: event.id,
                title: event.title,
                person: event.person,
                startTime: event.start_time.slice(0, 5),
                minutesBefore: target,
              })
            }
          }
        }
      }

      if (newToasts.length > 0) {
        setToasts(prev => [...newToasts, ...prev]) // newest on top
        playChime(newToasts[0].minutesBefore)
        // Auto-dismiss: 5-min alerts stay longer (12 s), 10-min auto-dismiss in 8 s
        newToasts.forEach(t =>
          scheduleAutoDismiss(t.id, t.minutesBefore === 5 ? 12_000 : 8_000)
        )
      }
    } catch {
      // network error — silent
    }
  }, [scheduleAutoDismiss])

  useEffect(() => {
    // Run immediately, then every 30 seconds
    checkReminders()
    const interval = setInterval(checkReminders, 30_000)
    return () => {
      clearInterval(interval)
      // Clean up all pending auto-dismiss timers
      dismissTimers.current.forEach(t => clearTimeout(t))
    }
  }, [checkReminders])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-16 inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none no-print"
      aria-live="polite"
      aria-label="תזכורות אירועים"
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-sm px-3">
          <ToastCard toast={toast} onDismiss={() => dismissToast(toast.id)} />
        </div>
      ))}
    </div>
  )
}
