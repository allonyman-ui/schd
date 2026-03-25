import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'no url' }, { status: 400 })
  try {
    const resp = await fetch(url, { headers: { Accept: 'image/*' }, signal: AbortSignal.timeout(20000) })
    if (!resp.ok) return NextResponse.json({ error: `upstream ${resp.status}` }, { status: 502 })
    const blob = await resp.blob()
    return new Response(blob, {
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
