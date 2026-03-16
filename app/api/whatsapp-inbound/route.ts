import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Unified conversational system prompt ──────────────────────────────────
const SYSTEM_PROMPT = (today: string, schedule: string) => `You are the WhatsApp AI assistant for the Aloni family schedule.
TODAY: ${today} (use this as the reference for ALL relative dates)

FAMILY MEMBERS (map any variation to the key):
- alex  => aleks, alexander, alex, אלכס, אלכסנדר
- itan  => itan, eytan, itai, איתן
- ami   => ami, amy, אמי, עמי
- danil => daniel, dani, danil, דניאל, דני
- assaf => assaf, asaf, אסף

${schedule ? `CURRENT SCHEDULE (next 14 days):\n${schedule}\n` : ''}
RETURN EXACTLY ONE JSON FORMAT:

FORMAT 1 - event_add (found 1 or more events with a date):
{"intent":"event_add","events":[{"person":"alex|itan|ami|danil|assaf","title":"concise Hebrew title 3-6 words","date":"YYYY-MM-DD","start_time":"HH:MM or null","end_time":"HH:MM or null","location":"string or null","notes":"what to bring/wear/prepare - include ALL details","is_recurring":false,"recurrence_days":null,"meeting_link":"URL or null","action":"add"}]}

FORMAT 2 - clarification_needed (event found but person truly unknown):
{"intent":"clarification_needed","partial_events":[{same fields, person:""}],"clarification_question":"Hebrew question","missing_field":"person"}

FORMAT 3 - event_query (user is asking about the schedule):
{"intent":"event_query","reply":"Hebrew answer. Use *bold* for names/dates."}

FORMAT 4 - chat (greeting, thanks, not schedule-related):
{"intent":"chat","reply":"short helpful Hebrew response"}

DATE AND TIME PARSING:
Hebrew days (next occurrence from TODAY unless explicit date given):
  aleph/rishon=Sunday  bet/sheni=Monday  gimel/shlishi=Tuesday  dalet/revii=Wednesday
  heh/hamishi=Thursday  vav/shishi=Friday  shabbat=Saturday
  In Hebrew: א=ראשון ב=שני ג=שלישי ד=רביעי ה=חמישי ו=שישי
Date formats: "21/3" "21.3" "21 מרץ" "March 21" => YYYY-MM-DD
Relative: מחר=+1d  מחרתיים=+2d  בשבוע הבא=+7d
Time: "16:00" "ב-16" "שעה 4 אחה\"צ"=16:00  "9 בבוקר"=09:00
Recurring: "כל שלישי" "every Thursday" => is_recurring:true, recurrence_days:["tuesday"]

PERSON DETECTION:
- Named explicitly (של איתן, לאמי, איתן צריך) => use that person
- School class group (כיתה ד, כיתה א) => clarification_needed (which child is in that class?)
- Child activity (חוג, אימון, בית ספר) with no name => clarification_needed
- Work/adult meeting with no name => use "assaf"
- Sender refers to themselves => use "assaf"

IMAGE AND SCREENSHOT RULES:
1. Read ALL text in the image carefully - Hebrew is right-to-left
2. Extract EVERY event mentioned (school newsletters often list multiple events)
3. Look for: event name, date (DD/MM or day name), time, location, what to bring
4. Apply same date/person rules as for text
5. If image has no event data => chat intent explaining what you see

QUALITY RULES:
- Extract ALL events - never miss any
- title: concise Hebrew (3-6 words), not the full raw text
- notes: include ALL useful details (what to bring, dress code, contacts)
- Never create duplicate events for same person+date+title in one response
- If message has multiple events, return all of them in the events array
- Return ONLY valid JSON - no markdown, no explanation, no prefix text`

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
  // Strip punctuation and normalize (Hebrew has no lowercase)
  const norm = (s: string) => s.replace(/[\s\-_.,!?׳״'"()[\]]/g, '').toLowerCase()
  const na = norm(a); const nb = norm(b)
  // Exact match after normalization
  if (na === nb) return true
  // One is a substring of the other (handles "אימון" vs "אימון כדורגל")
  if (na.length >= 4 && nb.includes(na)) return true
  if (nb.length >= 4 && na.includes(nb)) return true
  // Word overlap >= 70% (stricter than before to reduce false positives)
  const wordsA = a.split(/\s+/).filter(w => w.length > 2)
  const wordsB = b.split(/\s+/).filter(w => w.length > 2)
  if (wordsA.length < 1 || wordsB.length < 1) return false
  const overlap = wordsA.filter(w => wordsB.includes(w)).length
  return overlap / Math.max(wordsA.length, wordsB.length) >= 0.7
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

// ── Download Twilio media (images or audio) ────────────────────────────────
async function downloadTwilioMedia(
  mediaUrl: string
): Promise<{ base64: string; mediaType: string; buffer: Buffer } | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  try {
    const res = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
    })
    if (!res.ok) { console.error('[whatsapp-inbound] Media fetch failed:', res.status); return null }
    const contentType = (res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim()
    const arrayBuf = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)
    return { base64: buffer.toString('base64'), mediaType: contentType, buffer }
  } catch (err) {
    console.error('[whatsapp-inbound] Media download error:', err); return null
  }
}

// ── Transcribe audio via OpenAI Whisper ───────────────────────────────────
async function transcribeAudio(
  buf: Buffer, mimeType: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[whatsapp-inbound] OPENAI_API_KEY not set — cannot transcribe voice')
    return null
  }
  // Map MIME type to a file extension Whisper accepts
  const ext = mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3'
    : mimeType.includes('webm') ? 'webm'
    : mimeType.includes('wav')  ? 'wav'
    : 'ogg'  // WhatsApp voice notes are ogg/opus
  try {
    const formData = new FormData()
    // Convert Buffer to plain ArrayBuffer for Blob compatibility
    const ab = new ArrayBuffer(buf.length)
    const view = new Uint8Array(ab)
    buf.copy(view)
    formData.append('file', new Blob([ab], { type: mimeType }), `voice.${ext}`)
    formData.append('model', 'whisper-1')
    formData.append('language', 'he')  // Hebrew — also auto-detects other languages
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })
    if (!res.ok) {
      console.error('[whatsapp-inbound] Whisper error:', res.status, await res.text())
      return null
    }
    const data = await res.json() as { text?: string }
    console.log('[whatsapp-inbound] Whisper transcript:', data.text?.slice(0, 80))
    return data.text || null
  } catch (err) {
    console.error('[whatsapp-inbound] Whisper exception:', err)
    return null
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

// ── Pending state (stored in whatsapp_batches) ────────────────────────────
type PendingState =
  | { type: 'pending_clarification'; missing_field: string; partial_events: Array<Record<string, unknown>>; expires: string }
  | { type: 'pending_duplicate'; dup_pairs: DupPair[]; clean_events: Array<Record<string, unknown>>; expires: string }

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
  if (!state?.type?.startsWith('pending_')) return null
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

// Build duplicate-resolution question
interface DupPair {
  new_ev: Record<string, unknown>
  existing: { id: string; title: string; date: string; start_time?: string | null }
}
function duplicateCard(pairs: DupPair[]): string {
  const lines: string[] = ['⚠️ *מצאתי אירועים דומים בלוח!*', '']
  pairs.forEach((p, i) => {
    const num = pairs.length > 1 ? `${i + 1}. ` : ''
    lines.push(`${num}📌 *קיים:* ${p.existing.title}`)
    lines.push(`   📅 ${heDate(p.existing.date)}${p.existing.start_time ? ` ⏰ ${p.existing.start_time}` : ''}`)
    lines.push(`   ➡️ *חדש:* ${String(p.new_ev.title || '')}`)
    lines.push(`   📅 ${heDate(p.new_ev.date as string)}${p.new_ev.start_time ? ` ⏰ ${p.new_ev.start_time}` : ''}`)
    if (i < pairs.length - 1) lines.push('')
  })
  lines.push('')
  if (pairs.length === 1) {
    lines.push('*עדכן* — עדכן את הקיים עם הפרטים החדשים')
    lines.push('*חדש* — הוסף כאירוע נפרד')
  } else {
    lines.push(`ענה/י עם מספר + פעולה, לדוגמה: "1 עדכן, 2 חדש"`)
    lines.push('או: *עדכן הכל* / *חדש הכל*')
  }
  return lines.join('\n')
}

// ── Event payload builder ─────────────────────────────────────────────────
function buildPayload(ev: Record<string, unknown>) {
  return {
    title: ev.title, date: ev.date,
    start_time: ev.start_time ?? null, end_time: ev.end_time ?? null,
    location: ev.location ?? null, notes: ev.notes ?? null,
    is_recurring: ev.is_recurring || false,
    recurrence_days: ev.recurrence_days ?? null,
    meeting_link: ev.meeting_link ?? null,
  }
}

// Check only — returns similar existing event if found, null otherwise
async function findDuplicate(
  ev: Record<string, unknown>
): Promise<{ id: string; title: string; date: string; start_time?: string | null } | null> {
  if (!ev.title || !ev.date) return null
  const supabase = createServiceClient()
  const person = (ev.person as string) || 'assaf'
  // Exact same date only — ±1 day was causing too many false positives
  const { data } = await supabase
    .from('events').select('id, title, date, start_time')
    .eq('person', person)
    .eq('date', ev.date as string)
  return data?.find(e => titlesAreSimilar(e.title, ev.title as string)) ?? null
}

// Force-insert (skips duplicate check — used after user says "חדש")
async function insertEvent(
  ev: Record<string, unknown>
): Promise<{ status: 'saved' | 'skipped'; id: string | null }> {
  if (!ev.title || !ev.date) return { status: 'skipped', id: null }
  const supabase = createServiceClient()
  const person = (ev.person as string) || 'assaf'
  const { data, error } = await supabase.from('events')
    .insert({ ...buildPayload(ev), person, completed: false }).select('id').single()
  return error ? { status: 'skipped', id: null } : { status: 'saved', id: data?.id ?? null }
}

// Force-update existing event (used after user says "עדכן")
async function updateEvent(
  id: string, ev: Record<string, unknown>
): Promise<{ status: 'updated' | 'skipped'; id: string | null }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('events').update(buildPayload(ev)).eq('id', id)
  return error ? { status: 'skipped', id: null } : { status: 'updated', id }
}

// Smart upsert used when NO duplicate found (normal flow, no user prompt needed)
async function saveEvent(
  ev: Record<string, unknown>
): Promise<{ status: 'saved' | 'skipped'; id: string | null }> {
  return insertEvent(ev)
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

  // ── Check for pending state from this sender ─────────────────────────────
  const pending = await getPending(from)
  if (pending) {
    console.log('[whatsapp-inbound] Resolving pending:', pending.state.type)
    await deletePending(pending.id)
    const answer = messageBody.trim().toLowerCase()
    const cards: string[] = []
    let saved = 0, updated = 0
    const resolvedEvents: Array<Record<string, unknown>> = []

    // ── Resolve: person clarification ────────────────────────────────────
    if (pending.state.type === 'pending_clarification') {
      const PERSON_MAP: Record<string, string> = {
        אמי:'ami',ami:'ami',עמי:'ami', אלכס:'alex',alex:'alex',אלכסנדר:'alex',
        איתן:'itan',itan:'itan', דניאל:'danil',דני:'danil',danil:'danil', אסף:'assaf',assaf:'assaf',
      }
      const resolvedPerson = PERSON_MAP[answer] || PERSON_MAP[messageBody.trim()] || 'assaf'
      const events = (pending.state.partial_events || []).map(ev => ({ ...ev, person: resolvedPerson })) as Array<Record<string, unknown>>
      for (const ev of events) {
        const { status, id } = await insertEvent(ev)
        if (id) ev._event_id = id
        if (status === 'saved') { saved++; cards.push(eventCard(ev, '✅ נוסף')) }
        resolvedEvents.push(ev)
      }
    }

    // ── Resolve: duplicate decision ───────────────────────────────────────
    if (pending.state.type === 'pending_duplicate') {
      const { dup_pairs, clean_events } = pending.state
      const updateAll = /עדכן הכל|update all/i.test(answer)
      const newAll    = /חדש הכל|new all/i.test(answer)

      // Save clean (non-conflicting) events first
      for (const ev of (clean_events || [])) {
        const { status, id } = await insertEvent(ev)
        if (id) ev._event_id = id
        if (status === 'saved') { saved++; cards.push(eventCard(ev, '✅ נוסף')) }
        resolvedEvents.push(ev)
      }

      // Process each duplicate pair
      for (let i = 0; i < dup_pairs.length; i++) {
        const pair = dup_pairs[i]
        const numMatch = answer.match(new RegExp(`${i + 1}\\s*(עדכן|update|חדש|new)`))
        const doUpdate = updateAll || (!newAll && (numMatch?.[1] === 'עדכן' || numMatch?.[1] === 'update' || (dup_pairs.length === 1 && /עדכן|update/i.test(answer))))
        const doNew    = newAll    || (!updateAll && (numMatch?.[1] === 'חדש' || numMatch?.[1] === 'new'   || (dup_pairs.length === 1 && /חדש|new/i.test(answer))))

        if (doUpdate) {
          const { status, id } = await updateEvent(pair.existing.id, pair.new_ev)
          if (id) pair.new_ev._event_id = id
          if (status === 'updated') { updated++; cards.push(eventCard(pair.new_ev, '🔄 עודכן')) }
        } else if (doNew) {
          const { status, id } = await insertEvent(pair.new_ev)
          if (id) pair.new_ev._event_id = id
          if (status === 'saved') { saved++; cards.push(eventCard(pair.new_ev, '✅ נוסף')) }
        } else {
          // Default: insert new if answer unclear
          const { status, id } = await insertEvent(pair.new_ev)
          if (id) pair.new_ev._event_id = id
          if (status === 'saved') { saved++; cards.push(eventCard(pair.new_ev, '✅ נוסף')) }
        }
        resolvedEvents.push(pair.new_ev)
      }
    }

    void supabase.from('whatsapp_batches').insert({
      raw_text: `[WHATSAPP from: ${from} | sid: ${messageSid}]\n\n[תשובה: ${answer}]`,
      processed_events: resolvedEvents,
    })

    const reply = saved + updated === 0
      ? '⚠️ לא הצלחתי לשמור. נסה שוב.'
      : [`🗓️ *לוח אלוני — עודכן!*`, '', ...cards.map((c, i) => i > 0 ? '\n' + c : c)].join('\n')
    return twimlReply(reply)
  }

  // ── Download media if present ─────────────────────────────────────────────
  let mediaAttachment: { base64: string; mediaType: string; buffer: Buffer } | null = null
  let voiceTranscript: string | null = null

  if (numMedia > 0) {
    const mediaUrl  = params.MediaUrl0
    const mediaType = params.MediaContentType0 || ''
    console.log('[whatsapp-inbound] Media type:', mediaType)

    if (mediaUrl && mediaType.startsWith('image/')) {
      mediaAttachment = await downloadTwilioMedia(mediaUrl)
      if (!mediaAttachment) console.warn('[whatsapp-inbound] Image download failed')

    } else if (mediaUrl && (mediaType.startsWith('audio/') || mediaType.includes('ogg') || mediaType.includes('mpeg') || mediaType.includes('mp4'))) {
      console.log('[whatsapp-inbound] Voice message detected — transcribing')
      const audio = await downloadTwilioMedia(mediaUrl)
      if (audio) {
        voiceTranscript = await transcribeAudio(audio.buffer, audio.mediaType)
        if (voiceTranscript) {
          console.log('[whatsapp-inbound] Transcription ok, length:', voiceTranscript.length)
        } else {
          // No OPENAI_API_KEY or Whisper failed — let Claude know
          voiceTranscript = '[הודעה קולית — תמלול לא זמין]'
        }
      }
    }
  }

  // Effective text to process: transcribed voice > typed body
  const effectiveBody = voiceTranscript
    ? (voiceTranscript.startsWith('[') ? voiceTranscript : `[הודעה קולית]: "${voiceTranscript}"`)
    : messageBody

  // ── Fetch schedule only for likely queries (saves ~200ms otherwise) ────────
  const looksLikeQuery = /מה|מתי|יש לי|האם|מתוכנן|השבוע|היום|מחר|כמה|פגישה/i.test(effectiveBody)
  const schedule = looksLikeQuery ? await fetchUpcomingSchedule() : ''

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
        ? (effectiveBody || 'Extract all events and information from this image.')
        : effectiveBody,
    })

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT(today, schedule),
      messages: [{ role: 'user', content }],
    })

    const raw = msg.content[0]
    if (raw.type === 'text') {
      const jsonText = raw.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
      result = JSON.parse(jsonText)
    }
  } catch (err) {
    // Surface the real error in reply so we can diagnose quickly
    const errMsg = err instanceof Error ? err.message.slice(0, 140) : String(err).slice(0, 140)
    console.error('[whatsapp-inbound] Claude error:', errMsg)
    return twimlReply(`⚠️ שגיאת AI: ${errMsg}`)
  }

  if (!result) {
    return twimlReply('⚠️ לא הצלחתי לנתח את ההודעה. נסה שוב.')
  }

  console.log('[whatsapp-inbound] Intent:', result.intent)

  // ── Handle intent ─────────────────────────────────────────────────────────
  // ── chat / event_query ────────────────────────────────────────────────────
  const logText = voiceTranscript
    ? `[WHATSAPP from: ${from} | sid: ${messageSid} | 🎙️ voice]\n\n${voiceTranscript}`
    : `[WHATSAPP from: ${from} | sid: ${messageSid}]\n\n${messageBody}`

  if (result.intent === 'chat' || result.intent === 'event_query') {
    console.log('[whatsapp-inbound] Replying:', result.intent)
    void supabase.from('whatsapp_batches').insert({ raw_text: logText, processed_events: [] })
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
      raw_text: `[PENDING from: ${from}]\n\n${effectiveBody}`,
      processed_events: pendingState as unknown as Record<string, unknown>[],
    })
    return twimlReply(clarificationCard(result.partial_events, result.missing_field))
  }

  // ── event_add ─────────────────────────────────────────────────────────────
  // Deduplicate within the batch itself (AI sometimes returns same event twice)
  const rawEvents = (result.events || []).filter((e: Record<string, unknown>) => e.action !== 'cancel')
  // Intra-batch dedup (AI sometimes returns same event twice)
  const events: Array<Record<string, unknown>> = []
  for (const ev of rawEvents) {
    const inBatchDup = events.some(x =>
      x.person === ev.person && x.date === ev.date &&
      titlesAreSimilar(String(x.title || ''), String(ev.title || ''))
    )
    if (!inBatchDup) events.push(ev)
  }

  if (events.length === 0) {
    return twimlReply('🤔 לא זיהיתי אירועים בהודעה.\nנסה: "איתן — אימון כדורגל ביום ד׳ 16:00"')
  }

  // ── Check each event for duplicates in DB — ask user if found ────────────
  const dupPairs: DupPair[]                          = []
  const cleanEvents: Array<Record<string, unknown>>  = []

  for (const ev of events) {
    const existing = await findDuplicate(ev)
    if (existing) {
      console.log('[whatsapp-inbound] Possible duplicate found:', existing.title)
      dupPairs.push({ new_ev: ev, existing })
    } else {
      cleanEvents.push(ev)
    }
  }

  // If any duplicates found → ask before touching DB
  if (dupPairs.length > 0) {
    const pendingState: PendingState = {
      type: 'pending_duplicate',
      dup_pairs: dupPairs,
      clean_events: cleanEvents,
      expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }
    await supabase.from('whatsapp_batches').insert({
      raw_text: `[PENDING from: ${from}]\n\n${effectiveBody}`,
      processed_events: pendingState as unknown as Record<string, unknown>[],
    })
    return twimlReply(duplicateCard(dupPairs))
  }

  // No duplicates — save all clean events directly
  let saved = 0, skipped = 0
  const resultLines: string[] = []

  for (const ev of cleanEvents) {
    const { status, id } = await saveEvent(ev)
    if (id) ev._event_id = id
    if (status === 'saved') { saved++; resultLines.push(eventCard(ev, '✅ נוסף')) }
    else skipped++
  }

  console.log(`[whatsapp-inbound] saved=${saved} skipped=${skipped}`)
  void supabase.from('whatsapp_batches').insert({ raw_text: logText, processed_events: cleanEvents })

  const reply = saved === 0
    ? '⚠️ לא הצלחתי לשמור את האירועים. נסה שוב.'
    : ['🗓️ *לוח אלוני — עודכן!*', '', resultLines.join('\n\n')].join('\n')

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
