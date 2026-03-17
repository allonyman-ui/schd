import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── POST: send an outbound WhatsApp message via Twilio ────────────────────
export async function POST(request: NextRequest) {
  const { to, body } = await request.json()

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }

  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_WHATSAPP_FROM // e.g. whatsapp:+14155238886

  if (!sid || !token || !from) {
    return NextResponse.json({ error: 'Twilio env vars not configured' }, { status: 500 })
  }

  // Resolve recipient — matches the env var names in .env.local
  // Set WHATSAPP_GROUP_NUMBER to the family group chat number (individual WhatsApp, not group chat)
  // Note: Twilio can only send to individual numbers, not WhatsApp group chat IDs
  const FAMILY_NUMBERS: Record<string, string> = {
    assaf: process.env.WHATSAPP_PHONE_ASSAF  || '',
    danil: process.env.WHATSAPP_PHONE_DANIL  || '',
    ami:   process.env.WHATSAPP_PHONE_AMI_MOM || '',
    group: process.env.WHATSAPP_GROUP_NUMBER || process.env.WHATSAPP_PHONE_ASSAF || '',
  }

  // Accept either a key name ("assaf") or a raw number ("+972501234567")
  const recipient = FAMILY_NUMBERS[to] || (to?.startsWith('+') ? to : null) || FAMILY_NUMBERS.assaf
  if (!recipient) {
    return NextResponse.json({ error: 'No recipient number configured' }, { status: 400 })
  }

  const toNumber = recipient.startsWith('whatsapp:') ? recipient : `whatsapp:${recipient}`

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: toNumber, Body: body }).toString(),
      }
    )

    const data = await res.json() as Record<string, unknown>
    if (!res.ok) {
      console.error('[whatsapp-send] Twilio error:', data)
      return NextResponse.json({ error: (data.message as string) || 'Twilio error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sid: data.sid })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
