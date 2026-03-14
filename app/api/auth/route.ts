import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  const valid = await verifyPassword(password)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  const cookie = createSessionCookie()
  response.cookies.set(cookie)
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('family_session')
  return response
}
