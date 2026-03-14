import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60s for Claude API calls

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { rawText } = await request.json()
  if (!rawText?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const systemPrompt = `You are a precise schedule extraction assistant for an Israeli family. Read the ENTIRE message carefully from start to finish before extracting.

FAMILY MEMBERS (kids + parents):
- alex / אלכס / אלכסנדר → "alex"
- itan / איתן → "itan"
- ami / אמי / עמי → "ami"
- danil / דניאל / דני → "danil"
- assaf / אסף → "assaf"

TODAY'S DATE: ${today}

INSTRUCTIONS — READ EVERY WORD:
1. Extract EVERY scheduled event, appointment, activity, or task mentioned.
2. Identify the person from context — e.g. "לאיתן יש...", "קבוצת כדורגל של אמי", "כיתה ד של אלכס".
3. Parse ALL Hebrew date formats:
   - "יום ראשון/שני/שלישי/רביעי/חמישי/שישי/שבת" → calculate the NEXT occurrence from today
   - "ביום ג׳", "ביום ה׳" → Hebrew day abbreviations (א=ראשון, ב=שני, ג=שלישי, ד=רביעי, ה=חמישי, ו=שישי, ש=שבת)
   - "21/3", "21.3", "21/03/2026", "21 למרץ" → parse to YYYY-MM-DD using current year if not specified
   - "מחר" → tomorrow, "מחרתיים" → day after tomorrow, "השבוע" → infer day from context
4. Parse ALL Hebrew time formats:
   - "ב-16:00", "בשעה 16:00", "ב16:30", "ב4 אחרי הצהריים" (=16:00), "ב9 בבוקר" (=09:00)
5. CAPTURE ALL DETAILS into the notes field — do NOT ignore anything:
   - What to bring: "להביא ציוד", "להביא ספר X", "להביא כסף"
   - What to wear: "ללבוש...", "לבוש ספורט"
   - Preparation: "להכין", "לחזור על"
   - Instructions: "לא לשכוח", "חשוב"
   - Any other context from the message
6. Extract the location if mentioned (school name, address, city, room number, online/Zoom).
7. Extract meeting links: meet.google.com, zoom.us, teams.microsoft.com, etc.
8. For RECURRING events (every week on same day): set is_recurring=true and recurrence_days.
9. For cancelled events: action="cancel". For updates: action="update".
10. If the person cannot be determined from the message, leave "person" as empty string "".
11. If the date cannot be determined, leave "date" as empty string "".

Return ONLY a valid JSON array, no explanation, no markdown:
[{
  "person": "alex|itan|ami|danil|assaf or empty string",
  "title": "שם האירוע בעברית כפי שכתוב",
  "date": "YYYY-MM-DD or empty string",
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "location": "מיקום or null",
  "notes": "כל הפרטים הנוספים: מה להביא, מה ללבוש, הנחיות, הערות חשובות — or null",
  "is_recurring": true or false,
  "recurrence_days": ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] or null,
  "meeting_link": "full URL or null",
  "action": "add|cancel|update",
  "original_title": "only if action is update or cancel, otherwise null"
}]`

  let message
  try {
    message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: rawText }],
      system: systemPrompt,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Anthropic API error:', msg)
    return NextResponse.json({ error: `Claude API error: ${msg}` }, { status: 500 })
  }

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response type from Claude' }, { status: 500 })
  }

  let events
  try {
    const jsonText = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    events = JSON.parse(jsonText)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: content.text }, { status: 500 })
  }

  // Save the batch to Supabase
  const supabase = createServiceClient()
  const { data: batch, error: batchError } = await supabase
    .from('whatsapp_batches')
    .insert({ raw_text: rawText, processed_events: events })
    .select()
    .single()

  if (batchError) {
    console.error('Failed to save batch:', batchError)
  }

  return NextResponse.json({ events, batchId: batch?.id })
}

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
