import { NextRequest, NextResponse } from 'next/server'
import { fetchEvents, upsertCalendarConnection } from '@/lib/gcal'
import { createServiceClient } from '@/lib/supabase'
import { format, addDays } from 'date-fns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

// Parse a Google Calendar RRULE into our recurrence_days format
function parseRRule(rrule: string): string[] | null {
  // RRULE:FREQ=WEEKLY;BYDAY=MO,TU → ['monday','tuesday']
  const match = rrule.match(/BYDAY=([^;]+)/)
  if (!match) return null
  const dayMap: Record<string, string> = {
    SU:'sunday', MO:'monday', TU:'tuesday', WE:'wednesday',
    TH:'thursday', FR:'friday', SA:'saturday'
  }
  return match[1].split(',').map(d => dayMap[d]).filter(Boolean)
}

export async function POST(request: NextRequest) {
  const { calendarId, person, daysAhead = 60 } = await request.json()
  if (!calendarId || !person) {
    return NextResponse.json({ error: 'calendarId and person required' }, { status: 400 })
  }

  const timeMin = new Date().toISOString()
  const timeMax = addDays(new Date(), daysAhead).toISOString()

  const gcalEvents = await fetchEvents(calendarId, timeMin, timeMax)

  if (!gcalEvents.length) {
    await upsertCalendarConnection({
      calendar_id: calendarId,
      person,
      enabled: true,
      last_synced: new Date().toISOString(),
    })
    return NextResponse.json({ synced: 0, skipped: 0 })
  }

  const supabase = createServiceClient()
  let synced = 0, skipped = 0, errors = 0

  for (const ev of gcalEvents) {
    if (ev.status === 'cancelled') continue

    // Parse start/end
    const isAllDay = !!ev.start.date
    const startDT = ev.start.dateTime || ev.start.date || ''
    const endDT = ev.end.dateTime || ev.end.date || ''

    const date = isAllDay
      ? ev.start.date!
      : format(new Date(startDT), 'yyyy-MM-dd')

    const start_time = isAllDay ? null : format(new Date(startDT), 'HH:mm:ss')
    const end_time = isAllDay ? null : format(new Date(endDT), 'HH:mm:ss')

    // Check for recurring
    const isRecurring = !!(ev.recurrence?.length)
    const recurrence_days = isRecurring && ev.recurrence
      ? ev.recurrence.flatMap(r => parseRRule(r) || [])
      : null

    // Meeting link from conferenceData or description URL
    let meeting_link: string | null = null
    if (ev.conferenceData?.entryPoints) {
      const video = ev.conferenceData.entryPoints.find(e => e.entryPointType === 'video')
      if (video) meeting_link = video.uri
    }
    if (!meeting_link && ev.description) {
      const urlMatch = ev.description.match(/https?:\/\/[^\s<>"]+meet[^\s<>"]+/i)
      if (urlMatch) meeting_link = urlMatch[0]
    }

    const row = {
      person,
      title: ev.summary || '(ללא כותרת)',
      date,
      start_time,
      end_time,
      location: ev.location || null,
      notes: ev.description ? ev.description.replace(/<[^>]+>/g, '').slice(0, 500) : null,
      is_recurring: isRecurring,
      recurrence_days: recurrence_days?.length ? recurrence_days : null,
      meeting_link,
      completed: false,
    }

    // Duplicate check
    let dupQuery = supabase.from('events').select('id').eq('person', person).eq('title', row.title).eq('date', date)
    if (start_time) dupQuery = dupQuery.eq('start_time', start_time)
    const { data: existing } = await dupQuery.limit(1)

    if (existing && existing.length > 0) {
      skipped++
      continue
    }

    const { error } = await supabase.from('events').insert(row)
    if (error) { console.error('Insert error:', error.message); errors++ }
    else synced++
  }

  // Update last_synced
  await upsertCalendarConnection({
    calendar_id: calendarId,
    person,
    enabled: true,
    last_synced: new Date().toISOString(),
  })

  return NextResponse.json({ synced, skipped, errors, total: gcalEvents.length })
}
