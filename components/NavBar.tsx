'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FAMILY_MEMBERS } from '@/lib/types'

export default function NavBar() {
  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  const pathname = usePathname()
  if (pathname === '/login') return null

  return (
    <nav className="bg-white shadow-sm border-b border-amber-100 no-print print-hide">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-14 flex-row-reverse">
          {/* Logo */}
          <Link href="/" className="font-bold text-xl text-amber-700">
            🏠 משפחת אלוני
          </Link>

          {/* Main Nav */}
          <div className="flex items-center gap-1 flex-row-reverse">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                pathname === '/' ? 'bg-amber-100 text-amber-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              לוח שנה
            </Link>

            {FAMILY_MEMBERS.map(member => (
              <Link
                key={member.name}
                href={`/person/${member.name}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  pathname === `/person/${member.name}`
                    ? `${member.bgColor} ${member.textColor}`
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {member.hebrewName}
              </Link>
            ))}

            <Link
              href="/kids"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                pathname === '/kids' ? 'bg-rose-100 text-rose-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              👧 ילדים
            </Link>

            <Link
              href="/inbox"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                pathname === '/inbox' ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📱 וואטסאפ
            </Link>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-gray-600 transition"
          >
            יציאה
          </button>
        </div>
      </div>
    </nav>
  )
}
