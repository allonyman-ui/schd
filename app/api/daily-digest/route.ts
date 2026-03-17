import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const PEOPLE = [
  { key: 'assaf', name: 'אסף',   envVar: 'WHATSAPP_PHONE_ASSAF' },
  { key: 'danil', name: 'דניאל', envVar: 'WHATSAPP_PHONE_DANIL' },
  { key: 'ami',   name: 'אמי',   envVar: 'WHATSAPP_PHONE_AMI_MOM' },
]

async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !from) {
    console.warn('Twilio env vars not set — skipping WhatsApp send')
    return false
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const creds = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const params = new URLSearchParams({ To: to, From: from, Body: body })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Twilio error:', err)
    return false
  }
  return true
}

async function fetchWeather(): Promise<string> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) return ''

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Tel+Aviv,IL&appid=${apiKey}&units=metric&lang=he`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return ''
    const data = await res.json()
    const temp   = Math.round(data.main?.temp ?? 0)
    const desc   = data.weather?.[0]?.description ?? ''
    const feelsLike = Math.round(data.main?.feels_like ?? 0)
    return `🌤️ מזג אוויר בתל אביב: ${temp}°C, ${desc} (מרגיש כ-${feelsLike}°C)`
  } catch {
    return ''
  }
}

function buildMessage(
  name: string,
  events: { title: string; start_time: string | null; end_time: string | null; location: string | null }[],
  lunch: string | null,
  weather: string,
  dateLabel: string
): string {
  const lines: string[] = []
  lines.push(`🌅 בוקר טוב, ${name}!`)
  lines.push(`📅 ${dateLabel}`)
  lines.push('')

  if (weather) {
    lines.push(weather)
    lines.push('')
  }

  if (events.length === 0) {
    lines.push('✨ אין לך אירועים מיוחדים היום — יום נינוח!')
  } else {
    lines.push(`📋 האירועים שלך היום (${events.length}):`)
    for (const ev of events) {
      let line = `• ${ev.title}`
      if (ev.start_time) {
        line += ` ⏰ ${ev.start_time.slice(0, 5)}`
        if (ev.end_time) line += `–${ev.end_time.slice(0, 5)}`
      }
      if (ev.location) line += ` 📍 ${ev.location}`
      lines.push(line)
    }
  }

  if (lunch) {
    lines.push('')
    lines.push(`🍽️ ארוחת צהריים: ${lunch}`)
  }

  lines.push('')
  lines.push('❤️ יום נפלא לכל המשפחה!')

  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  // Allow Vercel cron (x-vercel-cron header) or CRON_SECRET check
  const cronSecret   = process.env.CRON_SECRET
  const verifyCron   = request.headers.get('x-vercel-cron')
  const authorization = request.headers.get('authorization')

  if (!verifyCron) {
    // Not from Vercel cron — require CRON_SECRET
    if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return runDigest()
}

export async function POST(request: NextRequest) {
  // Allow manual POST for testing (no auth required in dev, or check secret)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authorization = request.headers.get('authorization')
    if (authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  return runDigest()
}

async function runDigest() {
  const supabase = createServiceClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const dateLabel = format(new Date(), 'EEEE, d בMMMM yyyy', { locale: he })
  const dayOfWeek = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]

  // Fetch all events for today (date-specific + recurring)
  const [dateRes, recurringRes] = await Promise.all([
    supabase.from('events').select('*').eq('date', today).eq('is_recurring', false).order('start_time'),
    supabase.from('events').select('*').eq('is_recurring', true).order('start_time'),
  ])

  const dateEvents     = dateRes.data ?? []
  const recurringEvents = recurringRes.data ?? []

  // Filter recurring events that match today's day-of-week
  const todaysRecurring = recurringEvents.filter(e =>
    Array.isArray(e.recurrence_days) && e.recurrence_days.includes(dayOfWeek)
  )

  const allTodayEvents = [...dateEvents, ...todaysRecurring]

  // Fetch today's lunch
  const lunchRes = await supabase.from('lunch_menus').select('menu').eq('date', today).maybeSingle()
  const lunch = lunchRes.data?.menu ?? null

  // Fetch weather
  const weather = await fetchWeather()

  const results: Record<string, string> = {}

  for (const person of PEOPLE) {
    const phone = process.env[person.envVar]
    if (!phone) {
      results[person.key] = `skipped (no phone configured)`
      continue
    }

    const personEvents = allTodayEvents
      .filter(e => e.person === person.key)
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))

    const message = buildMessage(person.name, personEvents, lunch, weather, dateLabel)
    const sent = await sendWhatsApp(phone, message)
    results[person.key] = sent ? 'sent' : 'failed'
  }

  return NextResponse.json({ date: today, results })
}
