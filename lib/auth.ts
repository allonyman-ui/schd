import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

const SESSION_COOKIE = 'family_session'
const SESSION_VALUE = 'authenticated'

export async function verifyPassword(password: string): Promise<boolean> {
  const familyPassword = process.env.FAMILY_PASSWORD ?? ''
  const masterPassword = process.env.MASTER_PASSWORD ?? ''

  // Check family password (supports plain text or bcrypt hash)
  const familyMatch = familyPassword.startsWith('$2')
    ? await bcrypt.compare(password, familyPassword)
    : password === familyPassword

  if (familyMatch) return true

  // Check master password (plain text only, for admin access)
  if (masterPassword && password === masterPassword) return true

  return false
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  return session?.value === SESSION_VALUE
}

export function createSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: SESSION_VALUE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  }
}
