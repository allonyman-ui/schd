import { NextResponse } from 'next/server'
import { listCalendars, getCalendarConnections } from '@/lib/gcal'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [calendars, connections] = await Promise.all([
      listCalendars(),
      getCalendarConnections(),
    ])

    // Merge calendar list with saved connection settings
    const merged = calendars.map(cal => {
      const conn = connections.find(c => c.calendar_id === cal.id)
      return {
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        backgroundColor: cal.backgroundColor,
        primary: cal.primary,
        // From saved connection:
        person: conn?.person || null,
        enabled: conn?.enabled ?? true,
        last_synced: conn?.last_synced || null,
      }
    })

    return NextResponse.json({ calendars: merged })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
