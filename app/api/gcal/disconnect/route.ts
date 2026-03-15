import { NextResponse } from 'next/server'
import { deleteTokens, getStoredTokens } from '@/lib/gcal'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // Revoke token at Google
    const tokens = await getStoredTokens()
    if (tokens?.access_token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, { method: 'POST' })
        .catch(() => {}) // ignore errors — still delete locally
    }
    await deleteTokens()
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
