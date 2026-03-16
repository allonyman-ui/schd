import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Unified conversational system prompt ──────────────────────────────────
const SYSTEM_PROMPT = (today: string, schedule: string) => `You are the WhatsApp AI assistant for the Aloni family schedule (לוח אלוני — משפחת אלוני).
You receive messages via WhatsApp and can: add events, answer questions about the schedule, and have conversations.

FAMILY MEMBERS:
- alex / אלכס / אלכסנדר → "alex"
- itan / איתן → "itan"
- ami / אמי / עמי → "ami"
- danil / דניאל / דני → "danil"
- assaf / אסף → "assaf"

TODAY: ${today}

FAMILY SCHEDULE — NEXT 14 DAYS:
${schedule || 'אין אירועים קרובים'}

━━━ YOUR TASK ━━━
Analyze the message (text, forwarded content, or image/screenshot) and return ONE of these JSON formats:

FORMAT 1 — event_add (message contains events with clear person + date):
{"intent":"event_add","events":[{"person":"alex|itan|ami|danil|assaf","title":"string","date":"YYYY-MM-DD","start_time":"HH:MM or null","end_time":"HH:MM or null","location":"string or null","notes":"all details: what to bring/wear/prepare or null","is_recurring":false,"recurrence_days":null,"meeting_link":"URL or null","action":"add"}]}

FORMAT 2 — clarification_needed (events found but PERSON is truly ambiguous):
{"intent":"clarification_needed","partial_events":[{...same event structure, person:""}],"clarification_question":"Hebrew question asking who the event is for","missing_field":"person"}

FORMAT 3 — event_query (asking about the schedule):
{"intent":"event_query","reply":"Hebrew answer using the FAMILY SCHEDULE above. Use *bold* for names/dates. Be concise."}

FORMAT 4 — chat (general conversation, questions, anything else):
{"intent":"chat","reply":"helpful Hebrew response. Be friendly and concise. Use *bold* sparingly."}

PARSING RULES:
- Hebrew dates: "יום ראשון/שני/שלישי/רביעי/חמישי/שישי/שבת" → NEXT occurrence from today
- Hebrew abbreviations: ביום א'/ב'/ג'/ד'/ה'/ו' → א=ראשון, ב=שני, ג=שלישי, ד=רביעי, ה=חמישי, ו=שישי
- Dates: "21/3", "21.3", "21 למרץ", "March 21" → YYYY-MM-DD
- Relative: "מחר"=tomorrow, "מחרתיים"=day+2, "בשבוע הבא"=next week
- Times: "16:00", "ב-16:00", "בשעה 4", "4 אחרי הצהריים"=16:00, "9 בבוקר"=09:00
- Recurring: "כל שלישי", "every week" → is_recurring:true, recurrence_days:[...]
- Images/screenshots: extract ALL visible text, then apply same rules above
- If person is explicitly named or clear from context (child's name, "של אמי", school class name) → use it directly
- If the message is about a school/activity that belongs to a specific child → use that child
- If the sender is asking about their OWN schedule (work meeting, appointment) → use "assaf"
- If it's truly unclear who the event belongs to → use clarification_needed (don't guess)

Return ONLY valid JSON, no explanation, no markdown code blocks.`

// ── Twilio signature verification ─────────────────────────────────────────
function verifyTwilioSignature(
  authToken: string, twilioSignature: string,
  url: string, params: Record<string, string>
): boolean {
  try {
    const sortedKeys = Object.keys(params).sort()
    const paramStr = sortedKeys.map(k => `${k}${params[k]}`).join('')
    const hmac = crypto.createHmac('sha1', authToken).update(url + paramStr, 'utf8').digest('base64')
    if (hmac.length !== twilioSignature.length) return false
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(twilioSignature))
  } catch { return false }
}

// ── Title similarity ───────────────────────────────────────────────────────
function titlesAreSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.,!?׳״'"()[\]]/g, '')
  const na = norm(a); const nb = norm(b)
  if (na === nb) return true
  if (na.length > 3 && nb.includes(na)) return true
  if (nb.length > 3 && na.includes(nb)) return true
  const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const wordsB = b.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (!wordsA.length || !wordsB.length) return false
  const overlap = wordsA.filter(w => wordsB.includes(w)).length
  return overlap / Math.max(wordsA.length, wordsB.length) >= 0.6
}

// ── TwiML reply helper ────────────────────────────────────────────────────
function twimlReply(body: string): Response {
  // Escape XML special chars so WhatsApp emoji/Hebrew don't break the response
  const safe = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`
  console.log('[whatsapp-inbound] TwiML reply length:', xml.length)
  return new Response(xml, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}
function twimlEmpty(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200, headers: { 'Content-Type': 'text/xml' },
  })
}

// ── Download Twilio media (images, documents) ──────────────────────────────
async function downloadTwilioMedia(
  mediaUrl: string
): Promise<{ base64: string; mediaType: string } | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  try {
    const res = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
    })
    if (!res.ok) return null
    const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    const buffer = await res.arrayBuffer()
    return { base64: Buffer.from(buffer).toString('base64'), mediaType: contentType }
  } catch (err) {
    console.error('[whatsapp-inbound] Media download error:', err); return null
  }
}

// ── Fetch upcoming schedule for context ───────────────────────────────────
async function fetchUpcomingSchedule(): Promise<string> {
  try {
    const supabase = createServiceClient()
    const today = new Date().toISOString().split('T')[0]
    const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    const { data } = await supabase
      .from('events')
      .select('person, title, date, start_time, location')
      .gte('date', today)
      .lte('date', in14)
      .order('date').order('start_time')
      .limit(60)
    if (!data?.length) return ''
    const NAMES: Record<string, string> = { alex: 'אלכס', itan: 'איתן', ami: 'אמי', danil: 'דניאל', assaf: 'אסף' }
    return data.map(e =>
      `${e.date} ${e.start_time || ''} — ${NAMES[e.person] || e.person}: ${e.title}${e.location ? ` (${e.location})` : ''}`
    ).join('\n')
  } catch { return '' }
}

// ── Pending clarification state (stored in whatsapp_batches) ──────────────
interface PendingState {
  type: 'pending_clarification'
  missing_field: string
  partial_events: Array<Record<string, unknown>>
  expires: string
}

async function getPending(from: string) {
  const supabase = createServiceClient()
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('whatsapp_batches')
    .select('id, processed_events, created_at')
    .like('raw_text', `[PENDING from: ${from}]%`)
    .gte('created_at', tenMinAgo)
    .order('created_at', { ascending: false })
    .limit(1)
  if (!data?.length) return null
  const state = data[0].processed_events as unknown as PendingState
  if (state?.type !== 'pending_clarification') return null
  return { id: data[0].id as string, state }
}

async function deletePending(id: string) {
  const supabase = createServiceClient()
  await supabase.from('whatsapp_batches').delete().eq('id', id)
}

// ── Hebrew date/person formatting ────────────────────────────────────────
const HE_NAMES: Record<string, string> = {
  alex: 'אלכס', itan: 'איתן', ami: 'אמי', danil: 'דניאל', assaf: 'אסף',
}
const HE_DAYS  = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function heDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00') // noon avoids timezone shift
    return `יום ${HE_DAYS[d.getDay()]}, ${d.getDate()} ב${HE_MONTHS[d.getMonth()]}`
  } catch { return dateStr }
}

// Build a rich WhatsApp card for a single event
function eventCard(ev: Record<string, unknown>, status: '✅ נוסף' | '🔄 עודכן'): string {
  const lines: string[] = [`${status} *${String(ev.title || '')}*`]
  if (ev.person) lines.push(`👤 ל${HE_NAMES[ev.person as string] || String(ev.person)}`)
  if (ev.date)   lines.push(`📅 ${heDate(ev.date as string)}`)
  if (ev.start_time) {
    const time = ev.end_time ? `${ev.start_time}–${ev.end_time}` : String(ev.start_time)
    lines.push(`⏰ ${time}`)
  }
  if (ev.location)     lines.push(`📍 ${String(ev.location)}`)
  if (ev.notes)        lines.push(`📝 ${String(ev.notes).slice(0, 80)}`)
  if (ev.meeting_link) lines.push(`🔗 ${String(ev.meeting_link).slice(0, 60)}`)
  if (ev.is_recurring && ev.recurrence_days) {
    const days = (ev.recurrence_days as string[]).map(d => HE_DAYS[['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(d)] || d)
    lines.push(`🔄 כל ${days.join(', ')}`)
  }
  return lines.join('\n')
}

// Build clarification question with event preview
function clarificationCard(partialEvents: Array<Record<string, unknown>>, missingField: string): string {
  const lines: string[] = ['🤔 *יש לי שאלה לפני שאשמור:*', '']

  partialEvents.forEach(ev => {
    lines.push(`📌 *${String(ev.title || 'אירוע')}*`)
    if (ev.date)       lines.push(`   📅 ${heDate(ev.date as string)}`)
    if (ev.start_time) lines.push(`   ⏰ ${String(ev.start_time)}`)
    if (ev.location)   lines.push(`   📍 ${String(ev.location)}`)
  })

  lines.push('')
  if (missingField === 'person') {
    lines.push('👥 *למי להוסיף את זה?*')
    lines.push('ענה/י: *אמי / אלכס / איתן / דניאל / אסף*')
  } else if (missingField === 'date') {
    lines.push('📅 *מתי זה?*')
    lines.push('ענה/י עם תאריך (לדוגמה: "יום ד׳ 19/3" או "מחר")')
  }

  return lines.join('\n')
}

// ── Smart event upsert ────────────────────────────────────────────────────
async function upsertEvent(
  ev: Record<string, unknown>
): Promise<{ status: 'saved' | 'updated' | 'skipped'; id: string | null }> {
  if (!ev.title || !ev.date) return { status: 'skipped', id: null }
  const supabase = createServiceClient()
  const person = (ev.person as string) || 'assaf'
  const date   = ev.date as string
  const d = new Date(date)
  const dM3 = new Date(d); dM3.setDate(d.getDate() - 3)
  const dP3 = new Date(d); dP3.setDate(d.getDate() + 3)

  const { data: nearby } = await supabase
    .from('events').select('id, title, date')
    .eq('person', person)
    .gte('date', dM3.toISOString().split('T')[0])
    .lte('date', dP3.toISOString().split('T')[0])

  const similar = nearby?.find(e => titlesAreSimilar(e.title, ev.title as string))
  const payload = {
    title: ev.title, date: ev.date,
    start_time: ev.start_time ?? null, end_time: ev.end_time ?? null,
    location: ev.location ?? null, notes: ev.notes ?? null,
    is_recurring: ev.is_recurring || false,
    recurrence_days: ev.recurrence_days ?? null,
    meeting_link: ev.meeting_link ?? null,
  }

  if (similar) {
    const { error } = await supabase.from('events').update(payload).eq('id', similar.id)
    return error ? { status: 'skipped', id: null } : { status: 'updated', id: similar.id }
  } else {
    const { data, error } = await supabase.from('events')
      .insert({ ...payload, person, completed: false }).select('id').single()
    return error ? { status: 'skipped', id: null } : { status: 'saved', id: data?.id ?? null }
  }
}

// ── POST: inbound WhatsApp message ────────────────────────────────────────
export async function POST(request: NextRequest) {
  let params: Record<string, string> = {}
  try {
    const text = await request.text()
    new URLSearchParams(text).forEach((val, key) => { params[key] = val })
  } catch {
    return new Response('<Response/>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
  }

  const messageBody = params.Body?.trim() || ''
  const from        = params.From  || 'unknown'
  const messageSid  = params.MessageSid || ''
  const numMedia    = parseInt(params.NumMedia || '0', 10)

  console.log('[whatsapp-inbound] HIT', {
    from, messageSid,
    bodyLength: messageBody.length,
    bodyPreview: messageBody.slice(0, 80),
    numMedia,
  })

  if (!messageBody && numMedia === 0) {
    console.log('[whatsapp-inbound] Empty — skipping')
    return twimlEmpty()
  }

  // Deduplication: if we already processed this MessageSid, skip (Twilio retries)
  if (messageSid) {
    const supabaseCheck = createServiceClient()
    const { data: existing } = await supabaseCheck
      .from('whatsapp_batches')
      .select('id')
      .like('raw_text', `%sid: ${messageSid}%`)
      .limit(1)
    if (existing && existing.length > 0) {
      console.log('[whatsapp-inbound] Duplicate MessageSid — skipping', messageSid)
      return twimlEmpty()
    }
  }

  // Signature check (warn only)
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (authToken) {
    const sig = request.headers.get('x-twilio-signature') || ''
    const webhookUrl = 'https://allonys.com/api/whatsapp-inbound'
    if (sig && !verifyTwilioSignature(authToken, sig, webhookUrl, params)) {
      console.warn('[whatsapp-inbound] Signature mismatch — continuing')
    }
  }

  const supabase = createServiceClient()
  const today    = new Date().toISOString().split('T')[0]

  // ── Check for pending clarification from this sender ─────────────────────
  const pending = await getPending(from)
  if (pending) {
    console.log('[whatsapp-inbound] Resolving pending clarification', pending.id)
    await deletePending(pending.id)

    const answer = messageBody.trim()
    // Map answer to a person key
    const PERSON_MAP: Record<string, string> = {
      אמי: 'ami', ami: 'ami', עמי: 'ami',
      אלכס: 'alex', alex: 'alex', אלכסנדר: 'alex',
      איתן: 'itan', itan: 'itan',
      דניאל: 'danil', דני: 'danil', danil: 'danil',
      אסף: 'assaf', assaf: 'assaf',
    }
    const resolvedPerson = PERSON_MAP[answer.toLowerCase().trim()] || PERSON_MAP[answer] || 'assaf'

    const events = (pending.state.partial_events || []).map(ev => ({
      ...ev, person: resolvedPerson
    })) as Array<Record<string, unknown>>

    let saved = 0, updated = 0
    const cards: string[] = []
    for (const ev of events) {
      const { status, id } = await upsertEvent(ev)
      if (id) ev._event_id = id
      if (status === 'saved') { saved++; cards.push(eventCard(ev, '✅ נוסף')) }
      else if (status === 'updated') { updated++; cards.push(eventCard(ev, '🔄 עודכן')) }
    }

    // Log batch
    await supabase.from('whatsapp_batches').insert({
      raw_text: `[WHATSAPP from: ${from} | sid: ${messageSid}]\n\n[תשובה לברור: ${answer}]\n\n${events.map((e: Record<string, unknown>) => e.title).join(', ')}`,
      processed_events: events,
    })

    const reply = saved + updated === 0
      ? '⚠️ לא הצלחתי לשמור את האירועים. נסה שוב.'
      : [`🗓️ *לוח אלוני — עודכן!*`, '', ...cards.map((c, i) => (i > 0 ? '\n' + c : c))].join('\n')

    return twimlReply(reply)
  }

  // ── Download media if present ─────────────────────────────────────────────
  let mediaAttachment: { base64: string; mediaType: string } | null = null
  if (numMedia > 0) {
    const mediaUrl = params.MediaUrl0
    const mediaType = params.MediaContentType0 || 'image/jpeg'
    if (mediaUrl && mediaType.startsWith('image/')) {
      console.log('[whatsapp-inbound] Downloading media:', mediaType)
      mediaAttachment = await downloadTwilioMedia(mediaUrl)
    }
  }

  // ── Fetch schedule context ────────────────────────────────────────────────
  const schedule = await fetchUpcomingSchedule()

  // ── Call Claude with unified prompt ───────────────────────────────────────
  type ClaudeResult =
    | { intent: 'event_add'; events: Array<Record<string, unknown>> }
    | { intent: 'clarification_needed'; partial_events: Array<Record<string, unknown>>; clarification_question: string; missing_field: string }
    | { intent: 'event_query'; reply: string }
    | { intent: 'chat'; reply: string }

  let result: ClaudeResult | null = null

  try {
    // Build message content — support image + text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = []

    if (mediaAttachment) {
      const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      const mt = supportedTypes.includes(mediaAttachment.mediaType)
        ? mediaAttachment.mediaType
        : 'image/jpeg'
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mt, data: mediaAttachment.base64 },
      })
    }

    content.push({
      type: 'text',
      text: mediaAttachment
        ? (messageBody || 'Please extract all events and information from this image.')
        : messageBody,
    })

    const msg = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPT(today, schedule),
      messages: [{ role: 'user', content }],
    })

    const raw = msg.content[0]
    if (raw.type === 'text') {
      const jsonText = raw.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
      result = JSON.parse(jsonText)
    }
  } catch (err) {
    console.error('[whatsapp-inbound] Claude error:', err)
    return twimlReply('⚠️ שגיאת AI — נסה שוב בעוד רגע.')
  }

  if (!result) {
    return twimlReply('⚠️ לא הצלחתי לנתח את ההודעה. נסה שוב.')
  }

  console.log('[whatsapp-inbound] Intent:', result.intent)

  // ── Handle intent ─────────────────────────────────────────────────────────
  // ── chat / event_query ────────────────────────────────────────────────────
  if (result.intent === 'chat' || result.intent === 'event_query') {
    console.log('[whatsapp-inbound] Replying:', result.intent)
    void supabase.from('whatsapp_batches').insert({
      raw_text: `[WHATSAPP from: ${from} | sid: ${messageSid}]\n\n${messageBody}`,
      processed_events: [],
    })
    return twimlReply(result.reply)
  }

  // ── clarification_needed ──────────────────────────────────────────────────
  if (result.intent === 'clarification_needed') {
    console.log('[whatsapp-inbound] Asking clarification')
    const pendingState: PendingState = {
      type: 'pending_clarification',
      missing_field: result.missing_field,
      partial_events: result.partial_events,
      expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }
    await supabase.from('whatsapp_batches').insert({
      raw_text: `[PENDING from: ${from}]\n\n${messageBody}`,
      processed_events: pendingState as unknown as Record<string, unknown>[],
    })
    return twimlReply(clarificationCard(result.partial_events, result.missing_field))
  }

  // ── event_add ─────────────────────────────────────────────────────────────
  const events = (result.events || []).filter((e: Record<string, unknown>) => e.action !== 'cancel')
  let saved = 0, updated = 0, skipped = 0
  const resultLines: string[] = []

  for (const ev of events) {
    const { status, id } = await upsertEvent(ev)
    if (id) ev._event_id = id
    if (status === 'saved')        { saved++;   resultLines.push(eventCard(ev, '✅ נוסף')) }
    else if (status === 'updated') { updated++; resultLines.push(eventCard(ev, '🔄 עודכן')) }
    else skipped++
  }

  console.log(`[whatsapp-inbound] saved=${saved} updated=${updated} skipped=${skipped}`)

  await supabase.from('whatsapp_batches').insert({
    raw_text: `[WHATSAPP from: ${from} | sid: ${messageSid}]\n\n${messageBody}`,
    processed_events: events,
  })

  let reply: string
  if (saved + updated === 0 && events.length === 0) {
    reply = '🤔 לא זיהיתי אירועים בהודעה.\nנסה: "איתן — אימון כדורגל ביום ד׳ 16:00"'
  } else if (saved + updated === 0) {
    reply = '⚠️ לא הצלחתי לשמור את האירועים. נסה שוב.'
  } else {
    reply = ['🗓️ *לוח אלוני — עודכן!*', '', resultLines.join('\n\n')].join('\n')
  }

  return twimlReply(reply)
}

// ── GET: recent WhatsApp batches (non-pending) ────────────────────────────
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_batches')
    .select('*')
    .like('raw_text', '[WHATSAPP%')
    .not('raw_text', 'like', '[PENDING%')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
