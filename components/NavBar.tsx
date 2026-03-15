'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  const pathname = usePathname()
  if (pathname === '/login') return null

  return (
    <nav className="bg-white shadow-sm border-b border-amber-100 no-print print-hide">
      <div className="container mx-auto px-3 max-w-5xl">
        <div className="flex items-center justify-between h-12 flex-row-reverse">
          {/* Logo */}
          <Link href="/" className="font-bold text-base sm:text-lg text-amber-700 whitespace-nowrap">
            🏠 משפחת אלוני
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1 flex-row-reverse overflow-x-auto">
            <Link
              href="/inbox"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                pathname === '/inbox' ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📥 הכנס מידע
            </Link>
            <Link
              href="/settings"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                pathname === '/settings' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ⚙️ הגדרות
            </Link>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-gray-600 transition whitespace-nowrap"
          >
            יציאה
          </button>
        </div>
      </div>
    </nav>
  )
}
