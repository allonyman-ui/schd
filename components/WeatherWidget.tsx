'use client'

import { useEffect, useState } from 'react'

interface HourEntry { time: string; temp: number; rain: number; code: number }
interface DayEntry  { min: number; max: number; rain: number; code: number }
interface WeatherData {
  current: { temp: number; rain: number; code: number }
  hourly:  HourEntry[]
  today:   DayEntry
  tomorrow: DayEntry
}

// WMO weather-code → emoji + short Hebrew label
function weatherInfo(code: number): { icon: string; label: string } {
  if (code === 0)               return { icon: '☀️',  label: 'בהיר'       }
  if (code === 1)               return { icon: '🌤️',  label: 'בהיר בעיקר' }
  if (code === 2)               return { icon: '⛅',  label: 'מעונן חלקית' }
  if (code === 3)               return { icon: '☁️',  label: 'מעונן'       }
  if (code === 45 || code===48) return { icon: '🌫️',  label: 'ערפל'        }
  if (code >= 51 && code <= 55) return { icon: '🌦️',  label: 'טפטוף'       }
  if (code >= 61 && code <= 65) return { icon: '🌧️',  label: 'גשם'         }
  if (code >= 71 && code <= 77) return { icon: '❄️',  label: 'שלג'         }
  if (code >= 80 && code <= 82) return { icon: '🌦️',  label: 'מקלחות'      }
  if (code >= 95)               return { icon: '⛈️',  label: 'סערה'        }
  return { icon: '🌡️', label: '' }
}

function RainBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? '#3B82F6' : pct >= 40 ? '#60A5FA' : '#BAE6FD'
  return (
    <div className="flex items-center gap-1 mt-0.5">
      <div className="flex-1 h-1 rounded-full bg-blue-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{pct}%</span>
    </div>
  )
}

export default function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (d.error) throw new Error(); setData(d) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center gap-2 text-white/50 text-sm px-1 py-1">
      <span className="w-2 h-2 rounded-full bg-white/30 animate-pulse flex-shrink-0" />
      <span>מזג אוויר...</span>
    </div>
  )
  if (error || !data) return null

  const cur = weatherInfo(data.current.code)
  const tod = weatherInfo(data.today.code)
  const tom = weatherInfo(data.tomorrow.code)

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-right" dir="rtl">

      {/* Current — big number */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <span className="text-4xl drop-shadow-lg">{cur.icon}</span>
        <div>
          <div className="text-3xl font-black text-white leading-none tabular-nums">
            {Math.round(data.current.temp)}°
          </div>
          <div className="text-blue-200 text-xs mt-0.5 font-medium">{cur.label}</div>
          {data.current.rain > 0 && (
            <div className="text-sky-300 text-[11px] font-bold mt-0.5">💧 {data.current.rain}%</div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-white/15 flex-shrink-0 hidden sm:block" />

      {/* Hourly strip */}
      <div className="flex gap-1 overflow-x-auto flex-shrink-0" dir="ltr">
        {data.hourly.map((h, i) => {
          const hi = weatherInfo(h.code)
          return (
            <div key={i}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl flex-shrink-0 transition
                ${i === 0 ? 'bg-white/15 ring-1 ring-white/20' : 'hover:bg-white/10'}`}>
              <span className="text-[10px] font-bold text-white/50">{h.time}</span>
              <span className="text-sm leading-none">{hi.icon}</span>
              <span className="text-xs font-black text-white">{Math.round(h.temp)}°</span>
              {h.rain > 0 && <span className="text-[9px] text-sky-300 font-bold">{h.rain}%</span>}
            </div>
          )
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-white/15 flex-shrink-0 hidden sm:block" />

      {/* Today / Tomorrow */}
      <div className="flex gap-3 flex-shrink-0">
        {[
          { label: 'היום', info: tod, day: data.today },
          { label: 'מחר',  info: tom, day: data.tomorrow },
        ].map(({ label, info, day }) => (
          <div key={label} className="text-center min-w-[48px]">
            <div className="text-[10px] font-bold text-white/40 mb-0.5">{label}</div>
            <div className="text-base leading-none">{info.icon}</div>
            <div className="text-xs font-black text-white mt-0.5 tabular-nums">
              {Math.round(day.min)}°–{Math.round(day.max)}°
            </div>
            {day.rain > 0 && (
              <>
                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-sky-400" style={{ width: `${day.rain}%` }} />
                </div>
                <div className="text-[9px] text-sky-300 mt-0.5">{day.rain}%</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Location */}
      <div className="text-[10px] text-white/30 font-medium flex items-center gap-1 self-end pb-0.5 flex-shrink-0 hidden sm:flex">
        <span>📍</span><span>יהוד</span>
      </div>

    </div>
  )
}
