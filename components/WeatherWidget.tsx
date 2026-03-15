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
    <div className="flex items-center gap-2 text-gray-400 text-sm px-3 py-2 bg-white/60 rounded-2xl">
      <span className="animate-spin">⏳</span>
      <span>מזג אוויר...</span>
    </div>
  )
  if (error || !data) return null

  const cur  = weatherInfo(data.current.code)
  const tod  = weatherInfo(data.today.code)
  const tom  = weatherInfo(data.tomorrow.code)

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-sky-100 shadow-sm px-3 py-2.5 text-right w-full" dir="rtl">
      {/* Location badge */}
      <div className="text-[10px] text-sky-500 font-bold mb-1.5 flex items-center gap-1">
        <span>📍</span><span>יהוד מונוסון</span>
      </div>

      <div className="flex flex-wrap gap-3 items-start">

        {/* Current temp — big */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-3xl">{cur.icon}</span>
          <div>
            <div className="text-2xl font-black text-gray-800 leading-none">
              {Math.round(data.current.temp)}°
            </div>
            <div className="text-xs text-gray-500">{cur.label}</div>
            {data.current.rain > 0 && (
              <div className="text-[11px] text-blue-500 font-bold">💧 {data.current.rain}%</div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="w-px bg-gray-100 self-stretch flex-shrink-0" />

        {/* Next 4 hours */}
        <div className="flex gap-2 overflow-x-auto flex-shrink-0" dir="ltr">
          {data.hourly.map((h, i) => {
            const hi = weatherInfo(h.code)
            return (
              <div key={i} className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl flex-shrink-0 ${i === 0 ? 'bg-sky-50' : ''}`}>
                <span className="text-[10px] font-bold text-gray-400">{h.time}</span>
                <span className="text-base">{hi.icon}</span>
                <span className="text-xs font-black text-gray-700">{Math.round(h.temp)}°</span>
                {h.rain > 0 && <span className="text-[9px] text-blue-400 font-bold">{h.rain}%</span>}
              </div>
            )
          })}
        </div>

        {/* Separator */}
        <div className="w-px bg-gray-100 self-stretch flex-shrink-0" />

        {/* Today / Tomorrow summary */}
        <div className="flex gap-3 flex-shrink-0">
          {/* Today */}
          <div className="text-center min-w-[56px]">
            <div className="text-[10px] font-bold text-gray-400 mb-0.5">היום</div>
            <div className="text-base">{tod.icon}</div>
            <div className="text-xs font-black text-gray-700">
              {Math.round(data.today.min)}°–{Math.round(data.today.max)}°
            </div>
            <RainBar pct={data.today.rain} />
          </div>
          {/* Tomorrow */}
          <div className="text-center min-w-[56px]">
            <div className="text-[10px] font-bold text-gray-400 mb-0.5">מחר</div>
            <div className="text-base">{tom.icon}</div>
            <div className="text-xs font-black text-gray-700">
              {Math.round(data.tomorrow.min)}°–{Math.round(data.tomorrow.max)}°
            </div>
            <RainBar pct={data.tomorrow.rain} />
          </div>
        </div>

      </div>
    </div>
  )
}
