'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  const pathname = usePathname()
  if (pathname === '/login' || pathname === '/') return null

  const isInbox = pathname === '/inbox'

  return (
    <nav className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-amber-100 no-print print-hide sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-14 flex-row-reverse gap-3">

          {/* Logo */}
          <Link href="/" className="font-black text-base sm:text-lg text-amber-700 whitespace-nowrap flex items-center gap-1.5 shrink-0">
            🏠 <span className="hidden sm:inline">משפחת אלוני</span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-2 flex-row-reverse">

            {/* ── Primary CTA: Add Data ── */}
            <Link
              href="/inbox"
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
                transition-all duration-200 whitespace-nowrap shadow-sm
                ${isInbox
                  ? 'text-white shadow-md scale-[1.02]'
                  : 'text-white hover:shadow-md hover:scale-[1.02] active:scale-100'
                }
              `}
              style={{
                background: isInbox
                  ? 'linear-gradient(135deg,#059669,#10B981)'
                  : 'linear-gradient(135deg,#10B981,#059669)',
                boxShadow: isInbox ? '0 4px 14px rgba(16,185,129,0.4)' : '0 2px 8px rgba(16,185,129,0.25)',
              }}
            >
              {/* Pulse dot — draws attention when not on inbox */}
              {!isInbox && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white">
                  <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
                </span>
              )}
              <span className="text-base leading-none">✚</span>
              <span>הכנס מידע</span>
            </Link>


          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-600 transition whitespace-nowrap shrink-0 px-2 py-1 rounded-lg hover:bg-gray-100"
          >
            יציאה
          </button>

        </div>
      </div>
    </nav>
  )
}
