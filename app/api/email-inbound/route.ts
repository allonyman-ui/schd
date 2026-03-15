import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Postmark inbound webhook ────────────────────────────────────────────────
// Configure in Postmark: Settings → Inbound → Webhook URL → https://allonys.com/api/email-inbound
//
// Postmark POST body (relevant fields):
// { From, FromName, Subject, TextBody, HtmlBody, Date, StrippedTextReply }

const SYSTEM_PROMPT = (today: string) => `You are a precise schedule extraction assistant for an Israeli family. Read the ENTIRE message carefully from start to finish before extracting.

FAMILY MEMBERS (kids + parents):
- alex / אלכס / אלכסנדר → "alex"
- itan / איתן → "itan"
- ami / אמי / עמי → "ami"
- danil / דניאל / דני → "danil"
- assaf / אסף → "assaf"

TODAY'S DATE: ${today}

This message was forwarded from an email. It may be:
- A meeting invite (extract title, date, time, location, meeting link, attendees context)
- A school notification (identify which child from content)
- A forwarded appointment confirmation
- Any other scheduled event

INSTRUCTIONS — READ EVERY WORD:
1. Extract EVERY scheduled event, appointment, activity, or task mentioned.
2. Identify the person from context — e.g. "לאיתן יש...", "קבוצת כדורגל של אמי", "כיתה ד של אלכס".
   If the email is addressed to the whole family or unclear, try to infer from content.
3. Parse ALL Hebrew AND English date formats:
   - "יום ראשון/שני/שלישי/רביעי/חמישי/שישי/שבת" → calculate the NEXT occurrence from today
   - "Monday", "Tuesday", etc. → calculate the NEXT occurrence
   - "21/3", "21.3", "21/03/2026", "March 21" → parse to YYYY-MM-DD
   - "tomorrow", "מחר" → tomorrow, etc.
4. Parse ALL time formats including "3:00 PM", "15:00", "ב-16:00", "בשעה 16:00".
5. CAPTURE ALL DETAILS into the notes field:
   - What to bring, what to wear, preparation instructions
   - Room numbers, building names, parking info
   - Any important context from the email
6. Extract location from the email body (address, city, room, Zoom/Meet link).
7. Extract meeting links: meet.google.com, zoom.us, teams.microsoft.com, webex, etc.
8. For RECURRING events (every week): set is_recurring=true and recurrence_days.
9. For calendar invites with RSVP — just extract the event details.
10. If person cannot be determined from the message, use "assaf" as the default (the account owner).
11. If the date cannot be determined, leave "date" as empty string "".

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
  "action": "add"
}]`

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
    .slice(0, 8000)
}

export async function POST(request: NextRequest) {
  // Optional: verify Postmark webhook token
  const webhookToken = process.env.POSTMARK_WEBHOOK_TOKEN
  if (webhookToken) {
    const token = request.headers.get('x-postmark-signature') || request.headers.get('authorization')
    if (!token?.includes(webhookToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: Record<string, string>
  try {
    body = await request.json()
  } catch {
    return new Response('OK', { status: 200 }) // Postmark retries on non-200; always return 200
  }

  const from    = body.From || body.FromName || 'unknown'
  const subject = body.Subject || '(no subject)'
  const textBody = body.TextBody || body.StrippedTextReply || ''
  const htmlBody = body.HtmlBody || ''

  // Prefer text body; fall back to stripped HTML
  const bodyText = textBody.trim() || stripHtml(htmlBody)

  if (!bodyText && !subject) {
    return new Response('OK', { status: 200 })
  }

  // Build the raw text for Claude — include subject as context
  const rawText = `נושא: ${subject}\nמאת: ${from}\n\n${bodyText}`.slice(0, 8000)
  const today = new Date().toISOString().split('T')[0]

  // ── Call Claude ────────────────────────────────────────────────────────────
  let events: Array<Record<string, unknown>> = []
  let claudeRaw = ''

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT(today),
      messages: [{ role: 'user', content: rawText }],
    })
    const content = message.content[0]
    if (content.type === 'text') {
      claudeRaw = content.text.trim()
      const jsonText = claudeRaw.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      events = JSON.parse(jsonText)
    }
  } catch (err) {
    console.error('[email-inbound] Claude error:', err)
    // Still save the batch so the user can see it failed
  }

  const supabase = createServiceClient()

  // ── Save batch log ─────────────────────────────────────────────────────────
  const batchMeta = `[EMAIL from: ${from} | subject: ${subject}]\n\n${rawText}`
  const { data: batch } = await supabase
    .from('whatsapp_batches')
    .insert({ raw_text: batchMeta, processed_events: events })
    .select()
    .single()

  // ── Auto-save events that have at least title + date ───────────────────────
  let saved = 0
  let skipped = 0

  for (const ev of events) {
    if (!ev.title || !ev.date) { skipped++; continue }

    // Duplicate check
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('person', ev.person || 'assaf')
      .eq('title', ev.title)
      .eq('date', ev.date)
      .limit(1)

    if (existing && existing.length > 0) { skipped++; continue }

    const { error: insertErr } = await supabase.from('events').insert({
      title:           ev.title,
      person:          ev.person || 'assaf',
      date:            ev.date,
      start_time:      ev.start_time || null,
      end_time:        ev.end_time || null,
      location:        ev.location || null,
      notes:           ev.notes || null,
      is_recurring:    ev.is_recurring || false,
      recurrence_days: ev.recurrence_days || null,
      meeting_link:    ev.meeting_link || null,
      completed:       false,
    })

    if (!insertErr) saved++
    else skipped++
  }

  console.log(`[email-inbound] ${subject} → ${saved} saved, ${skipped} skipped, batch=${batch?.id}`)

  // Always return 200 so Postmark doesn't retry
  return NextResponse.json({ ok: true, saved, skipped, batchId: batch?.id })
}

// ── GET: return recent email batches ───────────────────────────────────────
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_batches')
    .select('*')
    .like('raw_text', '[EMAIL%')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
