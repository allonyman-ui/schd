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

  const systemPrompt = `You are a schedule extraction assistant for an Israeli family. Parse the following WhatsApp messages and extract all schedule-related events.
Family members: Alex (אלכס), Itan (איתן), Ami (אמי), Danil (דניאל), Assaf (אסף).
Today's date: ${today}.
Return ONLY a JSON array of events with this structure:
[{
  "person": "alex|itan|ami|danil|assaf",
  "title": "event name in Hebrew or as written",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "location": "location or null",
  "notes": "any extra context or null",
  "is_recurring": true/false,
  "recurrence_days": ["sunday","monday",...] or null,
  "meeting_link": "full URL of Google Meet/Zoom/Teams link if present in the message, or null",
  "action": "add|cancel|update",
  "original_title": "only if action is update or cancel"
}]
Extract meeting links (meet.google.com, zoom.us, teams.microsoft.com, etc.) and attach them to the relevant event.
Return only valid JSON, no explanation.`

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
