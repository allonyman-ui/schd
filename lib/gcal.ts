// Google Calendar helpers — token management + API calls
import { createServiceClient } from '@/lib/supabase'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GCAL_BASE = 'https://www.googleapis.com/calendar/v3'

export interface GCalToken {
  access_token: string
  refresh_token: string
  token_expiry: string
}

export interface GCalCalendar {
  id: string
  summary: string
  description?: string
  backgroundColor?: string
  primary?: boolean
}

export interface GCalEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  recurrence?: string[]
  status: string
  htmlLink?: string
  conferenceData?: { entryPoints?: { uri: string; entryPointType: string }[] }
}

// ── Token CRUD ─────────────────────────────────────────────────────────────

export async function getStoredTokens(): Promise<GCalToken | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('google_tokens').select('*').eq('id', 1).single()
  return data || null
}

export async function storeTokens(tokens: GCalToken) {
  const supabase = createServiceClient()
  await supabase.from('google_tokens').upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: tokens.token_expiry,
    updated_at: new Date().toISOString(),
  })
}

export async function deleteTokens() {
  const supabase = createServiceClient()
  await supabase.from('google_tokens').delete().eq('id', 1)
}

// ── Refresh access token ───────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  return res.json()
}

// ── Get a valid access token (auto-refresh if expired) ────────────────────

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens()
  if (!tokens) return null

  const expiry = new Date(tokens.token_expiry)
  const now = new Date()

  // Refresh if expires within 5 minutes
  if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token)
    if (!refreshed) return null
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    await storeTokens({ ...tokens, access_token: refreshed.access_token, token_expiry: newExpiry })
    return refreshed.access_token
  }

  return tokens.access_token
}

// ── Google Calendar API calls ──────────────────────────────────────────────

export async function listCalendars(): Promise<GCalCalendar[]> {
  const token = await getValidAccessToken()
  if (!token) return []
  const res = await fetch(`${GCAL_BASE}/users/me/calendarList?minAccessRole=reader`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.items || []
}

export async function fetchEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GCalEvent[]> {
  const token = await getValidAccessToken()
  if (!token) return []

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const res = await fetch(`${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.items || []
}

// ── Calendar connections CRUD ──────────────────────────────────────────────

export interface CalendarConnection {
  id: string
  calendar_id: string
  calendar_name: string | null
  color: string | null
  person: string | null
  enabled: boolean
  last_synced: string | null
}

export async function getCalendarConnections(): Promise<CalendarConnection[]> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('calendar_connections').select('*').order('calendar_name')
  return data || []
}

export async function upsertCalendarConnection(conn: Partial<CalendarConnection> & { calendar_id: string }) {
  const supabase = createServiceClient()
  await supabase.from('calendar_connections').upsert(conn, { onConflict: 'calendar_id' })
}
