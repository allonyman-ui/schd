'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

const NVR = 'https://nvr.allonys.com'

const CAMERAS = [
  { key: 'entrance',    label: 'כניסה'   },
  { key: 'deck_nosound',label: 'מרפסת'   },
  { key: 'bikes',       label: 'אופניים' },
  { key: 'edna_mike',   label: 'שכנים'   },
  { key: 'gina',        label: 'ג\'ינה'  },
  { key: 'deck_sound',  label: 'מרפסת🔊' },
]

// Use snapshot polling (more reliable than raw MJPEG in all browsers)
function snapshotUrl(cam: string) {
  return `${NVR}/api/frame.jpeg?src=${cam}`
}

export default function CameraWidget() {
  const [open, setOpen]         = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [cam, setCam]           = useState('entrance')
  const [imgSrc, setImgSrc]     = useState('')
  const [err, setErr]           = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(() => {
    setImgSrc(`${snapshotUrl(cam)}&t=${Date.now()}`)
  }, [cam])

  // When cam changes or panel opens — start polling
  useEffect(() => {
    if (!open) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    setErr(false)
    refresh()
    timerRef.current = setInterval(refresh, 3000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [open, cam, refresh])

  const w = expanded ? 320 : 200
  const h = expanded ? 240 : 150

  return (
    <>
      {/* ── Floating camera button (right side, above nothing) ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="מצלמות"
          className="fixed z-40 no-print w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition active:scale-90 hover:scale-105 text-xl"
          style={{ bottom: 24, right: 16, background: 'linear-gradient(135deg,#334155,#1e293b)', boxShadow: '0 4px 14px rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.12)' }}>
          📷
        </button>
      )}

      {/* ── Camera tile ── */}
      {open && (
        <div
          className="fixed z-50 no-print rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{
            bottom: 16, right: 16,
            width: w,
            background: 'rgba(5,16,31,0.96)',
            border: '1.5px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(20px)',
          }}>

          {/* Header bar */}
          <div className="flex items-center justify-between px-2.5 py-1.5 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white/80">📷</span>
              <span className="text-[11px] font-black text-white/70">{CAMERAS.find(c => c.key === cam)?.label}</span>
              {/* live dot */}
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setExpanded(e => !e)}
                className="text-white/50 hover:text-white text-[11px] px-1.5 py-0.5 rounded-lg transition"
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                {expanded ? '⊡' : '⊞'}
              </button>
              <button onClick={() => setOpen(false)}
                className="text-white/50 hover:text-white text-[11px] px-1.5 py-0.5 rounded-lg transition"
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                ✕
              </button>
            </div>
          </div>

          {/* Video frame */}
          <div className="relative flex-shrink-0 bg-black" style={{ height: h }}>
            {err ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <span className="text-2xl">📵</span>
                <span className="text-[11px] text-white/40">אין חיבור</span>
                <button onClick={() => { setErr(false); refresh() }}
                  className="text-[10px] text-sky-400 underline">נסה שוב</button>
              </div>
            ) : imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc}
                alt=""
                onError={() => setErr(true)}
                onLoad={() => setErr(false)}
                className="w-full h-full object-cover"
                style={{ display: 'block' }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Camera selector */}
          <div className="flex flex-wrap gap-1 p-1.5 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {CAMERAS.map(c => (
              <button key={c.key} onClick={() => setCam(c.key)}
                className="text-[10px] font-bold px-2 py-1 rounded-xl transition flex-shrink-0"
                style={{
                  background: cam === c.key ? 'rgba(14,165,233,0.3)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${cam === c.key ? 'rgba(14,165,233,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: cam === c.key ? '#38bdf8' : 'rgba(255,255,255,0.55)',
                }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
