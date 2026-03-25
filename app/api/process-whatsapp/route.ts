import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { rawText, images, answers, history } = await request.json()

  const hasText = !!(rawText?.trim())
  const hasImages = !!(images?.length)
  if (!hasText && !hasImages) return NextResponse.json({ error: 'No input provided' }, { status: 400 })

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
  const hebrewDay = dayNames[today.getDay()]
  const timeStr = today.toTimeString().slice(0,5)

  const dateRef = Array.from({length:14}, (_,i) => {
    const d = new Date(today); d.setDate(today.getDate()+i)
    return `${dayNames[d.getDay()]} ${d.toISOString().split('T')[0]}`
  }).join(', ')

  const answersContext = answers?.length
    ? `\n\nTHE USER ANSWERED YOUR CLARIFYING QUESTIONS:\n${answers.map((a: {question:string;answer:string}) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}`
    : ''

  const systemPrompt = `You are a warm, conversational family assistant for an Israeli family calendar app. Your job is NOT just to extract data — it is to have a real conversation, understand what the user needs, and ask smart clarifying questions BEFORE assuming anything.

TODAY: ${todayStr} (${hebrewDay}) TIME: ${timeStr}
NEXT 14 DAYS REFERENCE (day-name → date): ${dateRef}

FAMILY MEMBERS (all 5):
- ami / אמי / עמי → person: "ami"
- alex / אלכס / אלכסנדר → person: "alex"
- itan / איתן → person: "itan"
- danil / דניאל / דני → person: "danil"
- assaf / אסף → person: "assaf"
- ONLY use "family" when explicitly said "כולנו" / "המשפחה" / "לכולם"

══════════════════════════════════════
CONVERSATION RULES — CRITICAL:
══════════════════════════════════════

1. ALWAYS ASK ABOUT PERSON — if the text doesn't clearly state exactly who this is for, always ask. Do NOT default to "family". List the person names and ask "למי מיועד?"

2. ALWAYS ASK EVENT vs REMINDER — if ambiguous, ask: "האם זה אירוע ביומן (תאריך + שעה) או תזכורת לעשות משהו?"

3. ALWAYS ASK DATE SCOPE — if there's any date, ask: "האם זה ליום אחד או לתקופה? מתי מתחיל ומתי נגמר?"

4. ASK UP TO 5 QUESTIONS — don't be shy. It's better to ask than to guess wrong. Group multiple questions in one shot.

5. FOLLOW-UP AWARE — if this is a follow-up message (history provided), use context. "גם הוא" = person from last turn. "שנה ל-" = modify previous item. Merge corrections naturally.

6. BE CONVERSATIONAL — your context_summary should be a friendly Hebrew sentence summarizing what you understood and what you're asking.

══════════════════════════════════════
EXTRACTION CATEGORIES:
══════════════════════════════════════
1. EVENTS: Scheduled activities with date/time (class, appointment, meeting, trip, sport, birthday, ceremony, performance)
2. REMINDERS: Things to remember, do, bring, prepare, deadlines, tasks
3. SHOPPING: Any item to buy, grocery, thing to get from store
4. NOTES: Phone numbers, addresses, contact details, medical info, school info, prices, codes
5. LINKS: Any URL (http/https), website, app link, or Google Meet/Zoom link → extract as link with a short Hebrew title

IMAGE HANDLING: Read ALL text from images. Treat WhatsApp screenshots, school notices, handwritten notes identically to typed text. For school circulars: extract event, date, requirements (what to bring/pay/wear).

DATE PARSING (use 14-day reference):
- "יום שלישי הבא" → next Tuesday in reference
- "מחר" → ${new Date(today.getTime()+86400000).toISOString().split('T')[0]}
- "21/3", "21.3.26", "21.3" → YYYY-MM-DD

TIME PARSING:
- "ב4 אחרי הצהריים"=16:00, "ב9 בבוקר"=09:00
- "אחרי הצהריים"≈14:00, "בערב"≈19:00, "בבוקר"≈08:00

NOTES field on events: capture what to bring, wear, prepare, pay, contact info.
${answersContext}

Return ONLY valid JSON (no markdown):
{
  "context_summary": "one sentence in Hebrew summarizing what was extracted",
  "events": [{
    "person": "ami|alex|itan|danil|assaf|family",
    "title": "event title in Hebrew",
    "date": "YYYY-MM-DD or ''",
    "start_time": "HH:MM or null",
    "end_time": "HH:MM or null",
    "location": "location or null",
    "notes": "what to bring, wear, prepare, special instructions — or null",
    "is_recurring": false,
    "recurrence_days": null,
    "meeting_link": "URL or null",
    "action": "add"
  }],
  "reminders": [{
    "person": "person key or 'family'",
    "text": "reminder text in Hebrew",
    "due_date": "YYYY-MM-DD or null"
  }],
  "shopping": [{
    "item": "item name in Hebrew",
    "qty": "quantity or null",
    "notes": "brand, size, notes or null"
  }],
  "notes": [{
    "person": "person key",
    "content": "the information in Hebrew",
    "category": "school|medical|financial|contact|general|address|phone"
  }],
  "questions": [{
    "id": "q1",
    "question": "clarifying question in Hebrew",
    "context": "which item/event this refers to",
    "type": "person|date|time|clarify"
  }],
  "links": [{
    "url": "https://...",
    "title": "short Hebrew title describing the link"
  }]
}`

  // Build conversation messages array
  const messages: Anthropic.MessageParam[] = []

  // Add history (last 6 turns max to stay within context)
  if (history?.length) {
    const recentHistory = history.slice(-6)
    for (const turn of recentHistory) {
      messages.push({ role: turn.role as 'user' | 'assistant', content: turn.content })
    }
  }

  // Build current user message content
  const userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = []

  // Add images first (vision)
  if (hasImages) {
    for (const img of images as string[]) {
      const commaIdx = img.indexOf(',')
      if (commaIdx === -1) continue
      const header = img.slice(0, commaIdx)
      const data = img.slice(commaIdx + 1)
      const mediaTypeMatch = header.match(/data:([^;]+)/)
      const mediaType = (mediaTypeMatch?.[1] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } })
    }
  }

  // Add text
  const textContent = (hasText ? rawText : '') + answersContext
  if (textContent.trim()) {
    userContent.push({ type: 'text', text: textContent })
  } else if (hasImages) {
    userContent.push({ type: 'text', text: 'אנא חלץ את כל המידע מהתמונה/ות למעלה.' })
  }

  // Push as simple string if only text, or array if mixed content
  if (userContent.length === 1 && userContent[0].type === 'text') {
    messages.push({ role: 'user', content: (userContent[0] as Anthropic.TextBlockParam).text })
  } else {
    messages.push({ role: 'user', content: userContent })
  }

  let message
  try {
    message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      messages,
      system: systemPrompt,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Claude API error: ${msg}` }, { status: 500 })
  }

  const content = message.content[0]
  if (content.type !== 'text') return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })

  let data: { events?: unknown[]; reminders?: unknown[]; shopping?: unknown[]; notes?: unknown[]; questions?: unknown[]; links?: unknown[]; context_summary?: string }
  try {
    const jsonText = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    data = JSON.parse(jsonText)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: content.text }, { status: 500 })
  }

  // Save batch to Supabase
  const supabase = createServiceClient()
  const { data: batch } = await supabase
    .from('whatsapp_batches')
    .insert({ raw_text: rawText || '(image)', processed_events: data.events || [] })
    .select().single()

  return NextResponse.json({
    events: data.events || [],
    reminders: data.reminders || [],
    shopping: data.shopping || [],
    notes: data.notes || [],
    questions: data.questions || [],
    links: data.links || [],
    context_summary: data.context_summary || '',
    batchId: batch?.id,
    assistantSummary: data.context_summary || 'עובד',
  })
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
