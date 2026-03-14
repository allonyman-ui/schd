export type PersonName = 'alex' | 'itan' | 'ami' | 'danil' | 'assaf'

export interface Event {
  id: string
  title: string
  person: PersonName
  date: string // YYYY-MM-DD
  start_time: string | null // HH:MM
  end_time: string | null // HH:MM
  location: string | null
  notes: string | null
  is_recurring: boolean
  recurrence_days: string[] | null
  source: 'manual' | 'whatsapp'
  created_at: string
}

export interface WhatsappBatch {
  id: string
  raw_text: string
  processed_events: Event[]
  created_at: string
}

export interface ExtractedEvent {
  person: PersonName
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  notes: string | null
  is_recurring: boolean
  recurrence_days: string[] | null
  action?: 'add' | 'cancel' | 'update'
  original_title?: string
}

export const FAMILY_MEMBERS: { name: PersonName; hebrewName: string; color: string; bgColor: string; textColor: string }[] = [
  { name: 'alex', hebrewName: 'אלכס', color: 'alex', bgColor: 'bg-blue-200', textColor: 'text-blue-800' },
  { name: 'itan', hebrewName: 'איתן', color: 'itan', bgColor: 'bg-green-200', textColor: 'text-green-800' },
  { name: 'ami', hebrewName: 'אמי', color: 'ami', bgColor: 'bg-rose-200', textColor: 'text-rose-800' },
  { name: 'danil', hebrewName: 'דניאל', color: 'danil', bgColor: 'bg-violet-200', textColor: 'text-violet-800' },
  { name: 'assaf', hebrewName: 'אסף', color: 'assaf', bgColor: 'bg-amber-200', textColor: 'text-amber-800' },
]

export function getMemberInfo(name: PersonName) {
  return FAMILY_MEMBERS.find(m => m.name === name)!
}
