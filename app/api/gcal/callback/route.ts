import { NextRequest, NextResponse } from 'next/server'
import { storeTokens } from '@/lib/gcal'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const base = process.env.NEXTAUTH_URL || 'https://allonys.com'

  if (error || !code) {
    return NextResponse.redirect(`${base}/settings?gcal_error=${error || 'no_code'}`)
  }

  const redirectUri = `${base}/api/gcal/callback`

  // Exchange code for tokens
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Token exchange failed:', err)
    return NextResponse.redirect(`${base}/settings?gcal_error=token_exchange_failed`)
  }

  const data = await res.json()

  if (!data.refresh_token) {
    // No refresh token — user may have already authorized before. Revoke and retry.
    return NextResponse.redirect(`${base}/settings?gcal_error=no_refresh_token&hint=revoke_and_retry`)
  }

  const token_expiry = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await storeTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expiry,
  })

  return NextResponse.redirect(`${base}/settings?gcal_connected=true`)
}
