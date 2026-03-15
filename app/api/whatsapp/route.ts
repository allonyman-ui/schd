import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = (today: string) => `You are a schedule extraction assistant for an Israeli family. Parse the following WhatsApp messages and extract all schedule-related events.
Family members: Alex (אלכס), Itan (איתן), Ami (אמי), Danil (דניאל), Assaf (אסף).
Today's date: ${today}.
Return ONLY a JSON array of events with this structure:
[{
  "person": "alex|itan|ami|danil|assaf or null if unknown",
  "title": "event name in Hebrew or as written",
  "date": "YYYY-MM-DD or null if unknown",
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "location": "location or null",
  "notes": "any extra context or null",
  "is_recurring": false,
  "recurrence_days": null,
  "meeting_link": "full URL of Google Meet/Zoom/Teams link if present in the message, or null"
}]
Extract meeting links (meet.google.com, zoom.us, teams.microsoft.com, etc.) and attach them to the relevant event.
Return only valid JSON, no explanation.`

async function sendGreenApiReply(chatId: string, message: string): Promise<void> {
  const instanceId = process.env.GREEN_API_INSTANCE_ID
  const token = process.env.GREEN_API_TOKEN
  if (!instanceId || !token) {
    console.error('GREEN_API_INSTANCE_ID or GREEN_API_TOKEN not set')
    return
  }
  try {
    await fetch(`https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    })
  } catch (err) {
    console.error('Failed to send Green API reply:', err)
  }
}

export async function POST(request: NextRequest) {
  let messageBody: string
  let chatId: string

  try {
    const json = await request.json()

    // Only handle incoming text messages
    if (json.typeWebhook !== 'incomingMessageReceived') {
      return NextResponse.json({ ok: true })
    }

    const msgData = json.messageData
    if (msgData?.typeMessage !== 'textMessage') {
      return NextResponse.json({ ok: true })
    }

    messageBody = msgData.textMessageData?.textMessage || ''
    chatId = json.senderData?.chatId || ''
  } catch {
    console.error('Green API webhook: failed to parse JSON body')
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (!messageBody.trim()) {
    return NextResponse.json({ ok: true })
  }

  const today = new Date().toISOString().split('T')[0]

  let events: Array<Record<string, unknown>>
  try {
    const aiMessage = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: messageBody }],
      system: SYSTEM_PROMPT(today),
    })
    const content = aiMessage.content[0]
    if (content.type !== 'text') throw new Error('bad response')
    const jsonText = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    events = JSON.parse(jsonText)
  } catch (err) {
    console.error('WhatsApp webhook Claude error:', err)
    if (chatId) await sendGreenApiReply(chatId, 'שגיאה בעיבוד ההודעה — נסה שוב')
    return NextResponse.json({ ok: true })
  }

  if (!events || events.length === 0) {
    if (chatId) await sendGreenApiReply(chatId, 'לא נמצאו אירועים בהודעה')
    return NextResponse.json({ ok: true })
  }

  const complete = events.filter(e => e.person && e.date)
  const incomplete = events.filter(e => !e.person || !e.date)

  const supabase = createServiceClient()
  let savedCount = 0

  if (complete.length > 0) {
    const toInsert = complete.map(e => ({ ...e, source: 'whatsapp', is_recurring: false }))
    const { error } = await supabase.from('events').insert(toInsert)
    if (!error) {
      savedCount = complete.length
      await supabase.from('whatsapp_batches').insert({ raw_text: messageBody, processed_events: events })
    }
  }

  // Build reply
  const lines: string[] = []
  if (savedCount > 0) {
    lines.push(`✅ נשמרו ${savedCount} אירועים:`)
    complete.forEach(e => lines.push(`• ${e.title} — ${e.person} — ${e.date}`))
  }
  if (incomplete.length > 0) {
    lines.push(`\n⚠️ חסר מידע ב-${incomplete.length} אירועים:`)
    incomplete.forEach(e => {
      const missing = []
      if (!e.person) missing.push('שם הילד')
      if (!e.date) missing.push('תאריך')
      lines.push(`• ${e.title || 'אירוע'} — חסר: ${missing.join(', ')}`)
    })
    lines.push('\nהכנס את הפרטים החסרים באפליקציה: allonys.com/inbox')
  }
  if (savedCount === 0 && incomplete.length === 0) {
    lines.push('לא נמצאו אירועים בהודעה')
  }

  if (chatId) await sendGreenApiReply(chatId, lines.join('\n'))
  return NextResponse.json({ ok: true })
}
