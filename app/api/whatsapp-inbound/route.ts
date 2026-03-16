import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Twilio WhatsApp inbound webhook ─────────────────────────────────────────
// Configure in Twilio Console:
//   Messaging → Services (or Phone Number) → Webhook URL (inbound)
//   → https://allonys.com/api/whatsapp-inbound
//
// Required env vars:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
//
// Twilio sends application/x-www-form-urlencoded:
//   Body, From (whatsapp:+972...), To, MessageSid, NumMedia, MediaUrl0…

const SYSTEM_PROMPT = (today: string) => `You are a precise schedule extraction assistant for an Israeli family. Read the ENTIRE message carefully from start to finish before extracting.

FAMILY MEMBERS (kids + parents):
- alex / אלכס / אלכסנדר → "alex"
- itan / איתן → "itan"
- ami / אמי / עמי → "ami"
- danil / דניאל / דני → "danil"
- assaf / אסף → "assaf"

TODAY'S DATE: ${today}

This message was forwarded via WhatsApp. It may be:
- A forwarded school/class group message
- A forwarded appointment/reminder
- A direct message about a schedule change
- Any other event or activity

INSTRUCTIONS — READ EVERY WORD:
1. Extract EVERY scheduled event, appointment, activity, or task mentioned.
2. Identify the person from context — e.g. "לאיתן יש...", "קבוצת כדורגל של אמי", "כיתה ד של אלכס".
   If the message is for the whole family or unclear, try to infer from content.
3. Parse ALL Hebrew AND English date formats:
   - "יום ראשון/שני/שלישי/רביעי/חמישי/שישי/שבת" → calculate the NEXT occurrence from today
   - "ביום ג׳", "ביום ה׳" → Hebrew abbreviations (א=ראשון, ב=שני, ג=שלישי, ד=רביעי, ה=חמישי, ו=שישי)
   - "21/3", "21.3", "21/03/2026", "21 למרץ" → parse to YYYY-MM-DD
   - "מחר" → tomorrow, "מחרתיים" → day after tomorrow
   - "Monday", "Tuesday", etc. → calculate NEXT occurrence
4. Parse ALL time formats: "ב-16:00", "בשעה 16:00", "3:00 PM", "ב4 אחרי הצהריים" (=16:00).
5. CAPTURE ALL DETAILS into notes: what to bring, wear, prepare; room/building; parking; any other context.
6. Extract location (school name, address, city, room, Zoom/Meet link).
7. Extract meeting links: meet.google.com, zoom.us, teams.microsoft.com, webex, etc.
8. For RECURRING events (every week): set is_recurring=true and recurrence_days.
9. For cancelled/deleted events: action="cancel". For updates to existing: action="update".
10. If person cannot be determined, use "assaf" as the default.
11. If date cannot be determined, leave "date" as empty string "".

Return ONLY a valid JSON array, no explanation, no markdown:
[{
  "person": "alex|itan|ami|danil|assaf",
  "title": "Event title — keep original language",
  "date": "YYYY-MM-DD or empty string",
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "location": "location or null",
  "notes": "all extra details or null",
  "is_recurring": true or false,
  "recurrence_days": ["sunday","monday",...] or null,
  "meeting_link": "full URL or null",
  "action": "add|cancel|update",
  "original_title": "only if action is update or cancel, else null"
}]`

// ── Twilio signature verification ──────────────────────────────────────────
function verifyTwilioSignature(
  authToken: string,
  twilioSignature: string,
  url: string,
  params: Record<string, string>
): boolean {
  try {
    const sortedKeys = Object.keys(params).sort()
    const paramStr = sortedKeys.map(k => `${k}${params[k]}`).join('')
    const hmac = crypto.createHmac('sha1', authToken).update(url + paramStr, 'utf8').digest('base64')
    if (hmac.length !== twilioSignature.length) return false
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(twilioSignature))
  } catch {
    return false
  }
}

// ── Fuzzy title similarity ─────────────────────────────────────────────────
function titlesAreSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.,!?׳״'"()[\]]/g, '')
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return true
  // One contains the other (handles "כדורגל" vs "אימון כדורגל")
  if (na.length > 3 && nb.includes(na)) return true
  if (nb.length > 3 && na.includes(nb)) return true
  // Word-level overlap ≥ 60%
  const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const wordsB = b.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (wordsA.length === 0 || wordsB.length === 0) return false
  const overlap = wordsA.filter(w => wordsB.includes(w)).length
  return overlap / Math.max(wordsA.length, wordsB.length) >= 0.6
}

// ── Send reply via Twilio REST API ────────────────────────────────────────
// More reliable than TwiML response — not subject to webhook response timeout
async function sendWhatsAppReply(to: string, body: string): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  // Env var can be bare "+972..." or "whatsapp:+972..." — normalise to whatsapp: prefix
  const fromRaw = process.env.TWILIO_WHATSAPP_NUMBER || ''
  const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`

  if (!sid || !token || !fromRaw) {
    console.warn('[whatsapp-inbound] Missing Twilio credentials — reply not sent')
    return
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      }
    )
    if (!res.ok) {
      const err = await res.text()
      console.error('[whatsapp-inbound] Reply send failed:', res.status, err)
    }
  } catch (err) {
    console.error('[whatsapp-inbound] Reply fetch error:', err)
  }
}

// ── POST: inbound WhatsApp message ────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Parse form data (Twilio sends x-www-form-urlencoded)
  let params: Record<string, string> = {}
  try {
    const text = await request.text()
    new URLSearchParams(text).forEach((val, key) => { params[key] = val })
  } catch {
    return new Response('OK', { status: 200 })
  }

  const messageBody = params.Body?.trim() || ''
  const from        = params.From  || 'unknown'   // "whatsapp:+972..."
  const messageSid  = params.MessageSid || ''

  if (!messageBody) return new Response('OK', { status: 200 })

  // Optional: verify Twilio signature
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (authToken) {
    const sig = request.headers.get('x-twilio-signature') || ''
    const webhookUrl = 'https://allonys.com/api/whatsapp-inbound'
    if (sig && !verifyTwilioSignature(authToken, sig, webhookUrl, params)) {
      console.warn('[whatsapp-inbound] Invalid Twilio signature from', from)
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const supabase = createServiceClient()

  // ── Call Claude ────────────────────────────────────────────────────────────
  let events: Array<Record<string, unknown>> = []

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT(today),
      messages: [{ role: 'user', content: messageBody }],
    })
    const content = msg.content[0]
    if (content.type === 'text') {
      const jsonText = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
      events = JSON.parse(jsonText)
    }
  } catch (err) {
    console.error('[whatsapp-inbound] Claude error:', err)
  }

  // Filter out cancel actions for now (keep add + update)
  const actionableEvents = events.filter(e => e.action !== 'cancel')

  // ── Save batch log ─────────────────────────────────────────────────────────
  await supabase
    .from('whatsapp_batches')
    .insert({
      raw_text: `[WHATSAPP from: ${from} | sid: ${messageSid}]\n\n${messageBody}`,
      processed_events: actionableEvents,
    })

  // ── Smart upsert: add new events or update similar existing ones ───────────
  let saved = 0, updated = 0, skipped = 0
  const resultLines: string[] = []

  for (const ev of actionableEvents) {
    if (!ev.title || !ev.date) { skipped++; continue }

    const person = (ev.person as string) || 'assaf'
    const date   = ev.date as string

    // Look for similar events for this person within ±3 days
    const d = new Date(date)
    const dMinus3 = new Date(d); dMinus3.setDate(d.getDate() - 3)
    const dPlus3  = new Date(d); dPlus3.setDate(d.getDate() + 3)

    const { data: nearby } = await supabase
      .from('events')
      .select('id, title, date')
      .eq('person', person)
      .gte('date', dMinus3.toISOString().split('T')[0])
      .lte('date', dPlus3.toISOString().split('T')[0])

    const similar = nearby?.find(e => titlesAreSimilar(e.title, ev.title as string))

    if (similar) {
      // UPDATE existing event with fresh data
      const { error } = await supabase.from('events').update({
        title:           ev.title,
        date:            ev.date,
        start_time:      ev.start_time ?? null,
        end_time:        ev.end_time ?? null,
        location:        ev.location ?? null,
        notes:           ev.notes ?? null,
        is_recurring:    ev.is_recurring || false,
        recurrence_days: ev.recurrence_days ?? null,
        meeting_link:    ev.meeting_link ?? null,
      }).eq('id', similar.id)

      if (!error) {
        updated++
        resultLines.push(`🔄 עודכן: ${ev.title}`)
      } else {
        skipped++
      }
    } else {
      // INSERT new event
      const { error } = await supabase.from('events').insert({
        title:           ev.title,
        person:          person,
        date:            ev.date,
        start_time:      ev.start_time ?? null,
        end_time:        ev.end_time ?? null,
        location:        ev.location ?? null,
        notes:           ev.notes ?? null,
        is_recurring:    ev.is_recurring || false,
        recurrence_days: ev.recurrence_days ?? null,
        meeting_link:    ev.meeting_link ?? null,
        completed:       false,
      })

      if (!error) {
        saved++
        resultLines.push(`✅ נוסף: ${ev.title}`)
      } else {
        skipped++
      }
    }
  }

  console.log(`[whatsapp-inbound] from=${from} → saved=${saved} updated=${updated} skipped=${skipped}`)

  // ── Reply via Twilio REST API (async — not bound to webhook response time) ─
  if (saved + updated === 0 && actionableEvents.length === 0) {
    await sendWhatsAppReply(
      from,
      '🤔 לא זיהיתי אירועים בהודעה.\nנסה לכתוב: שם האדם, אירוע, תאריך ושעה.\n\nדוגמה: "איתן — אימון כדורגל ביום ד׳ 16:00"'
    )
  } else if (saved + updated === 0) {
    await sendWhatsAppReply(from, '⚠️ לא הצלחתי לשמור את האירועים (שגיאת שרת). נסה שוב.')
  } else {
    const lines: string[] = ['🗓️ *לוח אלוני — עודכן!*', '']
    lines.push(...resultLines)
    lines.push('')
    const stats: string[] = []
    if (saved > 0)   stats.push(`✅ ${saved} אירועים נוספו`)
    if (updated > 0) stats.push(`🔄 ${updated} אירועים עודכנו`)
    if (skipped > 0) stats.push(`⏭️ ${skipped} דולגו`)
    lines.push(stats.join('\n'))
    await sendWhatsAppReply(from, lines.join('\n'))
  }

  // Always return 200 immediately so Twilio doesn't retry
  return new Response('OK', { status: 200 })
}

// ── GET: recent WhatsApp batches ──────────────────────────────────────────
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_batches')
    .select('*')
    .like('raw_text', '[WHATSAPP%')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
