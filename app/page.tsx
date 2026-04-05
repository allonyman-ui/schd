'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function GatePage() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  // Fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 transition-opacity duration-500"
      style={{
        background: 'linear-gradient(160deg,#050e1e 0%,#091629 40%,#040d1a 100%)',
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Brand */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-3">👨‍👩‍👧‍👦</div>
        <h1 className="text-2xl font-black text-white mb-1">משפחת אלוני</h1>
        <p className="text-white/35 text-sm">לאן תרצו ללכת היום?</p>
      </div>

      {/* Choice cards */}
      <div className="w-full max-w-xs flex flex-col gap-4">

        {/* Family calendar */}
        <button
          onClick={() => router.push('/kids')}
          className="w-full rounded-3xl p-5 text-right transition-all active:scale-[0.97] hover:scale-[1.02]"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(255,255,255,0.14)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl shrink-0">📅</div>
            <div>
              <div className="font-black text-white text-lg leading-tight">לוח זמנים משפחתי</div>
              <div className="text-white/40 text-xs mt-1 leading-relaxed">
                אירועים, תזכורות, ילדים, קניות ועוד
              </div>
            </div>
          </div>
        </button>

        {/* Athens trip */}
        <button
          onClick={() => router.push('/athens')}
          className="w-full rounded-3xl p-5 text-right transition-all active:scale-[0.97] hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg,rgba(21,101,192,0.35),rgba(13,71,161,0.25))',
            border: '1.5px solid rgba(59,130,246,0.45)',
            boxShadow: '0 8px 32px rgba(21,101,192,0.3)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl shrink-0">🏛️</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-black text-white text-lg leading-tight">טיול אתונה</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'rgba(245,158,11,0.3)', color: '#fbbf24' }}>
                  26 מרץ ←
                </span>
              </div>
              <div className="text-white/45 text-xs leading-relaxed">
                8 ימים · 3 מלונות · מדריך + AI + מזג אוויר
              </div>
            </div>
          </div>
          {/* Greek accent line */}
          <div className="mt-3 flex gap-1 h-1 rounded-full overflow-hidden">
            <div className="flex-1" style={{ background: '#1565C0' }} />
            <div className="flex-1 bg-white/80" />
            <div className="flex-1" style={{ background: '#1565C0' }} />
            <div className="flex-1 bg-white/80" />
            <div className="flex-1" style={{ background: '#1565C0' }} />
          </div>
        </button>

        {/* Photo gallery */}
        <button
          onClick={() => router.push('/photos')}
          className="w-full rounded-3xl p-5 text-right transition-all active:scale-[0.97] hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(79,70,229,0.2))',
            border: '1.5px solid rgba(167,139,250,0.4)',
            boxShadow: '0 8px 32px rgba(124,58,237,0.25)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl shrink-0">📸</div>
            <div>
              <div className="font-black text-white text-lg leading-tight">תמונות מהטיול</div>
              <div className="text-white/45 text-xs mt-1 leading-relaxed">
                העלו תמונות ווידאו · צפו ביחד
              </div>
            </div>
          </div>
        </button>

      </div>

      {/* Footer hint */}
      <p className="text-white/20 text-xs mt-10 text-center">
        תמיד ניתן לעבור בין הדפים מהתפריט
      </p>
    </div>
  )
}
