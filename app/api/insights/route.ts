import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { format, addDays, startOfWeek } from 'date-fns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PERSON_NAMES: Record<string, string> = {
  ami: 'אמי', alex: 'אלכס', itan: 'איתן', assaf: 'אסף', danil: 'דניאל'
}
const ALL_PEOPLE = ['ami', 'alex', 'itan', 'assaf', 'danil']
const DAY_NAMES_ENG = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_NAMES_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')

  const date = new Date(dateStr + 'T12:00:00')
  const weekStart = startOfWeek(date, { weekStartsOn: 0 }) // Sunday
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), 'yyyy-MM-dd')
  )
  const weekStartStr = weekDates[0]
  const weekEndStr = weekDates[6]

  const supabase = createServiceClient()

  // Fetch all events for the week + all recurring
  const [dateRes, recurRes] = await Promise.all([
    supabase.from('events').select('*').gte('date', weekStartStr).lte('date', weekEndStr).eq('is_recurring', false),
    supabase.from('events').select('*').eq('is_recurring', true),
  ])

  const dateEvents: any[] = dateRes.data || []
  const recurEvents: any[] = recurRes.data || []

  // Build weekly grid: person → date → event[]
  const grid: Record<string, Record<string, any[]>> = {}
  ALL_PEOPLE.forEach(p => {
    grid[p] = {}
    weekDates.forEach(d => { grid[p][d] = [] })
  })

  dateEvents.forEach(ev => {
    if (grid[ev.person]?.[ev.date]) grid[ev.person][ev.date].push(ev)
  })

  recurEvents.forEach(ev => {
    if (!ev.recurrence_days || !grid[ev.person]) return
    weekDates.forEach(d => {
      const dayName = DAY_NAMES_ENG[new Date(d + 'T12:00:00').getDay()]
      if (ev.recurrence_days.includes(dayName)) {
        if (grid[ev.person]) grid[ev.person][d].push({ ...ev, date: d })
      }
    })
  })

  // Compute stats
  const personTotals: Record<string, number> = {}
  const dayTotals: Record<string, number> = {}
  let totalEvents = 0

  ALL_PEOPLE.forEach(p => {
    personTotals[p] = 0
    weekDates.forEach(d => {
      const c = grid[p][d].length
      personTotals[p] += c
      dayTotals[d] = (dayTotals[d] || 0) + c
      totalEvents += c
    })
  })

  const sortedPeople = Object.entries(personTotals).sort((a, b) => b[1] - a[1])
  const busiestPerson = sortedPeople[0]?.[0] || null
  const busiestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  const freeDays = weekDates.filter(d => (dayTotals[d] || 0) === 0)

  // Detect conflicts: same time slot, different people
  const conflicts: string[] = []
  weekDates.forEach(d => {
    const allDayEvs = ALL_PEOPLE.flatMap(p => grid[p][d].map(e => ({ ...e, personKey: p })))
    const timed = allDayEvs.filter(e => e.start_time)
    timed.forEach((e1, i) => {
      timed.slice(i + 1).forEach(e2 => {
        if (e1.personKey !== e2.personKey && e1.start_time === e2.start_time) {
          const dayIdx = weekDates.indexOf(d)
          const dayHe = DAY_NAMES_HE[new Date(d + 'T12:00:00').getDay()]
          conflicts.push(
            `יום ${dayHe}: ${PERSON_NAMES[e1.personKey]} ו-${PERSON_NAMES[e2.personKey]} יש אירועים באותה שעה ${e1.start_time.slice(0, 5)}`
          )
        }
      })
    })
  })

  // Flatten all week events for AI
  const allWeekEvents = [
    ...dateEvents,
    ...weekDates.flatMap(d =>
      recurEvents
        .filter(ev => {
          if (!ev.recurrence_days) return false
          const dayName = DAY_NAMES_ENG[new Date(d + 'T12:00:00').getDay()]
          return ev.recurrence_days.includes(dayName)
        })
        .map(ev => ({ ...ev, date: d }))
    ),
  ]

  // AI insights via Claude
  let aiInsights: any[] = []

  if (allWeekEvents.length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic()

      const eventsText = allWeekEvents.map(ev => {
        const name = PERSON_NAMES[ev.person] || ev.person
        const time = ev.start_time ? ` שעה ${ev.start_time.slice(0, 5)}` : ''
        const loc = ev.location ? ` ב${ev.location}` : ''
        const notes = ev.notes ? ` (${ev.notes})` : ''
        const dayHe = DAY_NAMES_HE[new Date(ev.date + 'T12:00:00').getDay()]
        return `${name} | יום ${dayHe} ${ev.date}: "${ev.title}"${time}${loc}${notes}`
      }).join('\n')

      const conflictsText = conflicts.length
        ? `\nזיהינו ניגודי זמנים:\n${conflicts.join('\n')}`
        : ''

      const personSummary = sortedPeople
        .filter(([, c]) => c > 0)
        .map(([p, c]) => `${PERSON_NAMES[p]}: ${c} אירועים`)
        .join(', ')

      const msg = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 900,
        messages: [{
          role: 'user',
          content: `אתה עוזר חכם למשפחת אלוני. ניתח את לוח השבועי הבא ותן 5 תובנות מעמיקות ומועילות בעברית.

חברי המשפחה:
- אמי (ami) — ילדה בת 6
- אלכס (alex) — נער בן 15
- איתן (itan) — נער בן 13
- אסף (assaf) — הורה
- דניאל (danil) — הורה

סיכום שבועי (${weekStartStr} עד ${weekEndStr}):
${personSummary}
אירועים ללא תאריך: ${freeDays.length} ימים ריקים

כל האירועים:
${eventsText}
${conflictsText}

הנחיות לתובנות:
- "warning" 🔴: ניגודי זמנים, עומס יתר על אדם אחד, בעיות לוגיסטיות
- "connection" 🟣: קשרים בין אנשים, הזדמנויות לזמן משפחתי, דפוסים מעניינים
- "tip" 🔵: המלצות פרקטיות כמו לתאם נסיעות, להכין דברים מראש
- "info" ⚪: עובדות מעניינות על השבוע, מי הכי עסוק, מה מיוחד

החזר JSON בלבד ללא טקסט נוסף:
{
  "insights": [
    {"type": "warning|connection|tip|info", "icon": "emoji אחד", "title": "כותרת קצרה", "text": "תיאור מפורט ומועיל בעברית, 1-2 משפטים"}
  ]
}`
        }],
      })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        aiInsights = parsed.insights || []
      }
    } catch (e) {
      console.error('AI insights error:', e)
    }
  }

  return NextResponse.json({
    insights: aiInsights,
    stats: {
      totalEvents,
      busiestPerson,
      busiestDay,
      freeDays,
      personTotals,
      dayTotals,
      conflicts,
      weekDates,
      grid,
    },
  })
}
