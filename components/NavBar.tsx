'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  const pathname = usePathname()
  // Hide on login, root (redirects to /kids), and kids (has its own full hero)
  if (pathname === '/login' || pathname === '/' || pathname === '/kids') return null

  return (
    <nav className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-amber-100 no-print print-hide sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-12 flex-row-reverse">

          {/* Logo — back to calendar */}
          <Link href="/kids" className="font-black text-base text-amber-700 whitespace-nowrap flex items-center gap-1.5 shrink-0 hover:opacity-80 transition">
            🏠 <span>לוח המשפחה</span>
          </Link>

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
