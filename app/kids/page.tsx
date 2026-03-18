'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { he } from 'date-fns/locale'
import WeatherWidget from '@/components/WeatherWidget'
import VideoSummaryModal from '@/components/VideoSummaryModal'
import KidPhotoGallery from '@/components/KidPhotoGallery'

interface Event {
  id: string; title: string; person: string; date: string
  start_time: string | null; end_time: string | null
  location: string | null; notes: string | null
  is_recurring: boolean; recurrence_days: string[] | null
  completed?: boolean; meeting_link?: string | null
  attachment_url?: string | null
}

interface Reminder {
  id: string; date: string; person: string | null
  text: string; completed: boolean; created_at: string
}

interface KidTheme {
  bg: string; headerGrad: string; border: string; accent: string
  textColor: string; noteBg: string; noteText: string
  badgeBg: string; badgeText: string; cardBg: string
  dark?: boolean; label: string
  gradient?: string   // CSS gradient for card header background
  name?: string       // Hebrew theme name
  emoji?: string      // Theme emoji for picker
  text?: string
}

interface EventForm {
  title: string; persons: string[]; date: string
  start_time: string; end_time: string
  location: string; notes: string
  is_recurring: boolean; recurrence_days: string[]
  meeting_link: string
  attachment_url: string
}

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const HE_DAYS: Record<string,string> = {
  sunday:'א׳', monday:'ב׳', tuesday:'ג׳', wednesday:'ד׳', thursday:'ה׳', friday:'ו׳', saturday:'ש׳'
}
const HE_DAYS_FULL: Record<string,string> = {
  sunday:'ראשון', monday:'שני', tuesday:'שלישי', wednesday:'רביעי', thursday:'חמישי', friday:'שישי', saturday:'שבת'
}

// Quick presets for recurring days
const RECURRENCE_PRESETS = [
  { label: 'כל ימי הלימודים', days: ['sunday','monday','tuesday','wednesday','thursday'] },
  { label: 'א׳ + ג׳ + ה׳', days: ['sunday','tuesday','thursday'] },
  { label: 'ב׳ + ד׳', days: ['monday','wednesday'] },
  { label: 'כל שבוע (א׳-ו׳)', days: ['sunday','monday','tuesday','wednesday','thursday','friday'] },
  { label: 'סוף שבוע', days: ['friday','saturday'] },
]

function getNextOccurrences(startDate: string, recurrenceDays: string[], count: number): string[] {
  const result: string[] = []
  try {
    const start = new Date(startDate + 'T12:00:00')
    let cur = new Date(start)
    let tries = 0
    while (result.length < count && tries < 90) {
      const dayName = DAY_NAMES[cur.getDay()]
      if (recurrenceDays.includes(dayName)) {
        result.push(cur.toISOString().split('T')[0])
      }
      cur = new Date(cur.getTime() + 86400000)
      tries++
    }
  } catch { /* ignore */ }
  return result
}

// ── Flat named theme palette ───────────────────────────────────────────────
const THEMES: Record<string, KidTheme> = {
  pink: {
    bg: '#FFF0F3', headerGrad: 'linear-gradient(135deg,#FFB6C1,#FF85A1)',
    border: '#FF85A1', accent: '#E91E63', textColor: '#880E4F',
    noteBg: '#FCE4EC', noteText: '#880E4F',
    badgeBg: '#F8BBD9', badgeText: '#880E4F', cardBg: '#FFF0F3', label: '🌸 ורוד',
    gradient: 'linear-gradient(135deg,#FCE4EC,#F48FB1)', name: 'ורוד', emoji: '🌸',
  },
  teal: {
    bg: '#E0F7FA', headerGrad: 'linear-gradient(135deg,#26C6DA,#006064)',
    border: '#00ACC1', accent: '#006064', textColor: '#004D40',
    noteBg: '#E0F2F1', noteText: '#004D40',
    badgeBg: '#B2EBF2', badgeText: '#00363A', cardBg: '#E0F7FA', label: "😎 טורקיז",
    gradient: 'linear-gradient(135deg,#E0F7FA,#80DEEA)', name: 'טורקיז', emoji: '🌊',
  },
  dark: {
    bg: '#1a1a2e', headerGrad: 'linear-gradient(135deg,#6C3483,#1a1a2e)',
    border: '#A855F7', accent: '#D8B4FE', textColor: '#E9D5FF',
    noteBg: '#2d1b4e', noteText: '#DDD6FE',
    badgeBg: '#4C1D95', badgeText: '#DDD6FE', cardBg: '#16213e', dark: true, label: '🌙 כהה',
    gradient: 'linear-gradient(135deg,#263238,#37474F)', name: 'כהה', emoji: '🌙',
  },
  purple: {
    bg: '#F3E5F5', headerGrad: 'linear-gradient(135deg,#CE93D8,#9575CD)',
    border: '#AB47BC', accent: '#7B1FA2', textColor: '#4A148C',
    noteBg: '#EDE7F6', noteText: '#4A148C',
    badgeBg: '#E1BEE7', badgeText: '#4A148C', cardBg: '#F3E5F5', label: '🍇 סגול',
    gradient: 'linear-gradient(135deg,#F3E5F5,#CE93D8)', name: 'סגול', emoji: '🍇',
  },
  orange: {
    bg: '#FFF3E0', headerGrad: 'linear-gradient(135deg,#FF7043,#BF360C)',
    border: '#FF5722', accent: '#BF360C', textColor: '#BF360C',
    noteBg: '#FBE9E7', noteText: '#BF360C',
    badgeBg: '#FFCCBC', badgeText: '#BF360C', cardBg: '#FFF8F5', label: '🍊 כתום',
    gradient: 'linear-gradient(135deg,#FFF3E0,#FFCC80)', name: 'כתום', emoji: '🍊',
  },
  green: {
    bg: '#E8F5E9', headerGrad: 'linear-gradient(135deg,#66BB6A,#1B5E20)',
    border: '#43A047', accent: '#1B5E20', textColor: '#1B5E20',
    noteBg: '#F1F8E9', noteText: '#33691E',
    badgeBg: '#C8E6C9', badgeText: '#1B5E20', cardBg: '#F9FBE7', label: '🌿 ירוק',
    gradient: 'linear-gradient(135deg,#E8F5E9,#A5D6A7)', name: 'ירוק', emoji: '🌿',
  },
  blue: {
    bg: '#EFF6FF', headerGrad: 'linear-gradient(135deg,#3B82F6,#1E3A8A)',
    border: '#3B82F6', accent: '#1D4ED8', textColor: '#1E3A8A',
    noteBg: '#DBEAFE', noteText: '#1E3A8A',
    badgeBg: '#BFDBFE', badgeText: '#1E3A8A', cardBg: '#EFF6FF', label: '💙 כחול',
    gradient: 'linear-gradient(135deg,#E3F2FD,#90CAF9)', name: 'כחול', emoji: '💙',
  },
  sunset: {
    bg: '#FFF8F0', headerGrad: 'linear-gradient(135deg,#FFB347,#FF6B35)',
    border: '#FF8C42', accent: '#FF5733', textColor: '#8B2500',
    noteBg: '#FFE8D6', noteText: '#8B2500',
    badgeBg: '#FFD4B8', badgeText: '#8B2500', cardBg: '#FFFAF5', label: '🌅 שקיעה',
    gradient: 'linear-gradient(135deg,#FFB347,#FF6B35)', name: 'שקיעה', emoji: '🌅',
  },
  gold: {
    bg: '#FFFDE7', headerGrad: 'linear-gradient(135deg,#FFF176,#FFD54F)',
    border: '#FFD700', accent: '#F9A825', textColor: '#5D4037',
    noteBg: '#FFF9C4', noteText: '#5D4037',
    badgeBg: '#FFE082', badgeText: '#5D4037', cardBg: '#FEFDF5', label: '⭐ זהב',
    gradient: 'linear-gradient(135deg,#FFF176,#FFD54F)', name: 'זהב', emoji: '⭐',
  },
  mint: {
    bg: '#F0FFF4', headerGrad: 'linear-gradient(135deg,#C6F6D5,#68D391)',
    border: '#38A169', accent: '#276749', textColor: '#1C4532',
    noteBg: '#C6F6D5', noteText: '#1C4532',
    badgeBg: '#9AE6B4', badgeText: '#1C4532', cardBg: '#F0FFF4', label: '🍃 מנטה',
    gradient: 'linear-gradient(135deg,#C6F6D5,#68D391)', name: 'מנטה', emoji: '🍃',
  },
  galaxy: {
    bg: '#0D0221', headerGrad: 'linear-gradient(135deg,#1E0645,#4C1D95)',
    border: '#7C3AED', accent: '#A78BFA', textColor: '#DDD6FE',
    noteBg: '#1E0645', noteText: '#DDD6FE',
    badgeBg: '#3B0764', badgeText: '#DDD6FE', cardBg: '#130338', dark: true, label: '🌌 גלקסיה',
    gradient: 'linear-gradient(135deg,#1E0645,#4C1D95)', name: 'גלקסיה', emoji: '🌌',
  },
}

const ADULT_THEMES: Record<string, KidTheme> = {
  assaf: THEMES.blue,
  danil: THEMES.green,
}

// ── Per-kid theme packs (legacy per-kid arrays — kept for kids tab) ────────
const KID_THEME_PACKS: Record<string, KidTheme[]> = {
  ami: [
    { bg: '#FFF0F3', headerGrad: 'linear-gradient(135deg,#FFB6C1,#FF85A1)',
      border: '#FF85A1', accent: '#E91E63', textColor: '#880E4F',
      noteBg: '#FCE4EC', noteText: '#880E4F',
      badgeBg: '#F8BBD9', badgeText: '#880E4F', cardBg: '#FFF0F3', label: '👑 פרינסס' },
    { bg: '#FFFDE7', headerGrad: 'linear-gradient(135deg,#FFD54F,#FF8A65)',
      border: '#FFB300', accent: '#F57F17', textColor: '#E65100',
      noteBg: '#FFF8E1', noteText: '#E65100',
      badgeBg: '#FFE082', badgeText: '#BF360C', cardBg: '#FFFDE7', label: '🌈 רינבו' },
    { bg: '#F3E5F5', headerGrad: 'linear-gradient(135deg,#CE93D8,#9575CD)',
      border: '#AB47BC', accent: '#7B1FA2', textColor: '#4A148C',
      noteBg: '#EDE7F6', noteText: '#4A148C',
      badgeBg: '#E1BEE7', badgeText: '#4A148C', cardBg: '#F3E5F5', label: '🦄 יוניקורן' },
  ],
  itan: [
    { bg: '#E8F5E9', headerGrad: 'linear-gradient(135deg,#66BB6A,#1B5E20)',
      border: '#43A047', accent: '#1B5E20', textColor: '#1B5E20',
      noteBg: '#F1F8E9', noteText: '#33691E',
      badgeBg: '#C8E6C9', badgeText: '#1B5E20', cardBg: '#F9FBE7', label: '⚽ ספורט' },
    { bg: '#1a1a2e', headerGrad: 'linear-gradient(135deg,#6C3483,#1a1a2e)',
      border: '#A855F7', accent: '#D8B4FE', textColor: '#E9D5FF',
      noteBg: '#2d1b4e', noteText: '#DDD6FE',
      badgeBg: '#4C1D95', badgeText: '#DDD6FE', cardBg: '#16213e', dark: true, label: '🎮 גיימינג' },
    { bg: '#E0F7FA', headerGrad: 'linear-gradient(135deg,#26C6DA,#006064)',
      border: '#00ACC1', accent: '#006064', textColor: '#004D40',
      noteBg: '#E0F2F1', noteText: '#004D40',
      badgeBg: '#B2EBF2', badgeText: '#00363A', cardBg: '#E0F7FA', label: "😎 צ'יל" },
  ],
  alex: [
    { bg: '#F3E5F5', headerGrad: 'linear-gradient(135deg,#AB47BC,#4A148C)',
      border: '#8E24AA', accent: '#4A148C', textColor: '#4A148C',
      noteBg: '#EDE7F6', noteText: '#311B92',
      badgeBg: '#E1BEE7', badgeText: '#4A148C', cardBg: '#FAF5FF', label: '🎵 מוזיקה' },
    { bg: '#FFF3E0', headerGrad: 'linear-gradient(135deg,#FF7043,#BF360C)',
      border: '#FF5722', accent: '#BF360C', textColor: '#BF360C',
      noteBg: '#FBE9E7', noteText: '#BF360C',
      badgeBg: '#FFCCBC', badgeText: '#BF360C', cardBg: '#FFF8F5', label: '🛹 סקייט' },
    { bg: '#ECEFF1', headerGrad: 'linear-gradient(135deg,#546E7A,#263238)',
      border: '#607D8B', accent: '#263238', textColor: '#263238',
      noteBg: '#F5F5F5', noteText: '#37474F',
      badgeBg: '#CFD8DC', badgeText: '#263238', cardBg: '#F8FAFB', label: '🌊 מינימל' },
  ],
}

// ── KID_THEMES: all kids + parents, using flat named themes ───────────────
const KID_THEMES: Record<string, KidTheme[]> = {
  ami:   [THEMES.pink, THEMES.sunset, THEMES.mint, THEMES.gold, THEMES.purple, THEMES.teal, THEMES.dark, THEMES.galaxy],
  alex:  [THEMES.purple, THEMES.blue, THEMES.galaxy, THEMES.gold, THEMES.orange, THEMES.dark, THEMES.mint, THEMES.pink],
  itan:  [THEMES.green, THEMES.mint, THEMES.teal, THEMES.blue, THEMES.dark, THEMES.gold, THEMES.galaxy, THEMES.orange],
  assaf: [THEMES.blue, THEMES.dark, THEMES.galaxy, THEMES.gold, THEMES.teal, THEMES.mint, THEMES.purple, THEMES.green],
  danil: [THEMES.green, THEMES.mint, THEMES.teal, THEMES.dark, THEMES.gold, THEMES.blue, THEMES.galaxy, THEMES.orange],
}

const KIDS = [
  { key: 'ami',  name: 'אמי',  photo: 'https://i.imgur.com/cG8XKwn.jpeg' as string|null, initials: 'א' },
  { key: 'alex', name: 'אלכס', photo: 'https://i.imgur.com/G0j3TD8.jpeg' as string|null, initials: 'א' },
  { key: 'itan', name: 'איתן', photo: 'https://i.imgur.com/5BKBLqt.jpeg' as string|null, initials: 'א' },
]
const ADULTS = [
  { key: 'assaf', name: 'אסף',   emoji: '💼' },
  { key: 'danil', name: 'דניאל', emoji: '🌿' },
]
const ALL_PEOPLE = [
  { key: 'ami',   name: 'אמי' },
  { key: 'alex',  name: 'אלכס' },
  { key: 'itan',  name: 'איתן' },
  { key: 'assaf', name: 'אסף' },
  { key: 'danil', name: 'דניאל' },
]
const PEOPLE_NAMES: Record<string, string> = Object.fromEntries(ALL_PEOPLE.map(p => [p.key, p.name]))

// Fuzzy title similarity (mirrors backend logic)
function titlesSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[\s\-_.,!?׳״'"()[\]]/g, '').toLowerCase()
  const na = norm(a), nb = norm(b)
  if (na === nb) return true
  if (na.length >= 4 && nb.includes(na)) return true
  if (nb.length >= 4 && na.includes(nb)) return true
  const wa = a.split(/\s+/).filter(w => w.length > 2)
  const wb = b.split(/\s+/).filter(w => w.length > 2)
  if (!wa.length || !wb.length) return false
  const overlap = wa.filter(w => wb.includes(w)).length
  return overlap / Math.max(wa.length, wb.length) >= 0.7
}
const FAMILY_PEOPLE = [
  { key: 'ami',   name: 'אמי',    color: '#E91E63', photo: 'https://i.imgur.com/cG8XKwn.jpeg' as string|null, emoji: '🌸' },
  { key: 'alex',  name: 'אלכס',   color: '#8E24AA', photo: 'https://i.imgur.com/G0j3TD8.jpeg' as string|null, emoji: '🎵' },
  { key: 'itan',  name: 'איתן',   color: '#2E7D32', photo: 'https://i.imgur.com/5BKBLqt.jpeg' as string|null, emoji: '⚽' },
  { key: 'assaf', name: 'אסף',    color: '#1D4ED8', photo: null, emoji: '💼' },
  { key: 'danil', name: 'דניאל',  color: '#15803D', photo: null, emoji: '🌿' },
]

type TabKey = 'now' | 'kids' | 'parents' | 'links'
const TABS = [
  { key: 'now'     as TabKey, label: '⏰ עכשיו' },
  { key: 'kids'    as TabKey, label: '👧👦 ילדים' },
  { key: 'parents' as TabKey, label: '👨‍👩 הורים' },
  { key: 'links'   as TabKey, label: '🔗 קישורים' },
]


// ── Live clock ─────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hhmm = format(now, 'HH:mm')
  const ss   = format(now, 'ss')
  return (
    <div dir="ltr" className="flex items-end gap-0.5 leading-none tabular-nums select-none">
      <span className="font-black text-white tracking-tight" style={{ fontSize: '2.6rem', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {hhmm}
      </span>
      <span className="font-bold text-white/40 mb-1" style={{ fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums' }}>
        :{ss}
      </span>
    </div>
  )
}

// ── KidAvatar ──────────────────────────────────────────────────────────────
function KidAvatar({ kid, theme, onClick, customPhoto, onEditPhoto }: {
  kid: typeof KIDS[0]; theme: KidTheme; onClick?: () => void;
  customPhoto?: string; onEditPhoto?: () => void
}) {
  const size = 160
  return (
    <div className="relative inline-block flex-shrink-0">
      <button onClick={onClick} title={`לחץ לשנות עיצוב (${theme.label})`}
        className="relative rounded-full focus:outline-none transition-transform active:scale-95 hover:scale-105"
        style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 0 3px ${theme.border}, 0 0 12px ${theme.border}66` }} />
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{ background: theme.dark ? '#2d2d2d' : theme.bg, border: `3px solid ${theme.border}` }}>
          {(customPhoto || kid.photo)
            ? <img src={customPhoto || kid.photo!} alt={kid.name} className="w-full h-full object-cover" />
            : <span style={{ fontSize: 36 }}>{kid.key === 'ami' ? '🌸' : kid.key === 'itan' ? '⚡' : '🎸'}</span>
          }
        </div>
        <div className="absolute -bottom-1 -right-1 text-xs rounded-full px-1.5 py-0.5 font-bold shadow-sm"
          style={{ background: theme.accent, color: '#fff', fontSize: 9 }}>
          {theme.label.split(' ')[0]}
        </div>
      </button>
      {onEditPhoto && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEditPhoto() }}
          className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center text-base hover:scale-110 transition-transform border-2 border-gray-100"
          title="שנה תמונה">
          📷
        </button>
      )}
    </div>
  )
}

const REACTION_EMOJIS = ['👍', '❤️', '✅', '😂', '❓', '🔥', '😮']

// ── EventCard ──────────────────────────────────────────────────────────────
function EventCard({ event, theme, onToggle, onDelete, onEdit, reactions, onReact, isPast, isNext }: {
  event: Event; theme: KidTheme
  onToggle: (e: Event) => void; onDelete: (id: string) => void; onEdit: (e: Event) => void
  reactions: { person: string; emoji: string }[]
  onReact: (emoji: string) => void
  isPast?: boolean; isNext?: boolean
}) {
  const done = !!event.completed
  const [showPicker, setShowPicker] = useState(false)

  // Afternoon detection: events starting at 14:00 or later get a warm amber overlay
  const isAfternoon = !!event.start_time && event.start_time.slice(0, 5) >= '14:00'

  // Group reactions by emoji
  const grouped: Record<string, number> = {}
  for (const r of reactions) {
    grouped[r.emoji] = (grouped[r.emoji] || 0) + 1
  }

  const [imgExpanded, setImgExpanded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  // Show as image for any non-null URL; fall back to file link if loading fails
  const hasPhoto = !!event.attachment_url && !imgFailed

  return (
    <>
    {/* ── Lightbox ── */}
    {imgExpanded && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 no-print"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={() => setImgExpanded(false)}>
        <img src={event.attachment_url!} alt={event.title}
          className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
          onClick={e => e.stopPropagation()}
          onError={() => { setImgFailed(true); setImgExpanded(false) }} />
        <button onClick={() => setImgExpanded(false)}
          className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none font-light">×</button>
      </div>
    )}
    <div className="group relative rounded-2xl mb-2 transition-all overflow-hidden"
      style={{
        background: done
          ? (theme.dark ? '#2a2a2a' : '#f5f5f5')
          : isAfternoon
            ? (theme.dark ? '#2a2216' : '#FFF8F0')   // warm cream for afternoon
            : theme.cardBg,
        border: `1.5px solid ${done ? '#ddd' : isAfternoon ? '#F59E0B' : theme.border}44`,
        borderLeft: done ? undefined : isAfternoon ? '4px solid #F59E0B' : `4px solid ${theme.border}`,
        opacity: done ? 0.6 : isPast ? 0.45 : 1,
        filter: isPast ? 'grayscale(30%)' : undefined,
      }}>

      {/* ── "Next up" badge ────────────────────────────────────────────── */}
      {isNext && (
        <div className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 text-center animate-pulse">
          ⏰ עכשיו בא
        </div>
      )}

      {/* ── Photo banner (top of card, full-width) ─────────────────────── */}
      {hasPhoto && (
        <div className="relative w-full overflow-hidden cursor-pointer"
          style={{ height: 140 }}
          onClick={() => setImgExpanded(true)}>
          <img
            src={event.attachment_url!}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
          {/* Gradient fade into card background */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.18) 100%)' }} />
          {/* Expand hint */}
          <div className="absolute bottom-1.5 left-2 flex items-center gap-1 bg-black/40 rounded-lg px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-[10px] font-bold">🔍 הגדל</span>
          </div>
          {/* Top-right: open in new tab */}
          <a href={event.attachment_url!} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute top-1.5 left-1.5 bg-black/40 hover:bg-black/60 rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-[11px] font-bold">↗</span>
          </a>
        </div>
      )}

      <div className="p-3">
      <div className="flex items-start gap-2 flex-row-reverse">
        <button onClick={() => onToggle(event)}
          className="mt-0.5 flex-shrink-0 rounded-full transition-all active:scale-90 flex items-center justify-center"
          style={{ width: 30, height: 30, minWidth: 30, minHeight: 30,
            background: done ? theme.accent : 'transparent',
            border: `2.5px solid ${done ? theme.accent : theme.border}66` }}>
          {done && <span className="text-white font-black text-sm leading-none">✓</span>}
        </button>
        <div className="flex-1 min-w-0 text-right">
          {(event.start_time || event.is_recurring) && (
            <div className="flex flex-wrap gap-1 flex-row-reverse mb-1">
              {event.start_time && (
                <span className="text-sm px-2.5 py-0.5 rounded-full font-black" dir="ltr"
                  style={{
                    background: isAfternoon ? '#FEF3C7' : theme.badgeBg,
                    color: isAfternoon ? '#92400E' : theme.badgeText,
                  }}>
                  {isAfternoon ? '🌅' : '⏰'} {event.start_time.slice(0,5)}{event.end_time ? ` – ${event.end_time.slice(0,5)}` : ''}
                </span>
              )}
              {event.is_recurring && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: theme.badgeBg, color: theme.badgeText }}>🔄 קבוע</span>
              )}
            </div>
          )}
          <div className={`font-black leading-snug mb-1 ${done ? 'line-through' : ''}`}
            style={{ color: done ? '#aaa' : theme.textColor, fontSize: 16 }}>{event.title}</div>
          {event.location && (
            <div className="text-sm flex items-center gap-1 flex-row-reverse mb-1" style={{ color: done ? '#bbb' : theme.accent }}>
              <span>📍</span><span>{event.location}</span>
            </div>
          )}
          {event.notes && (
            <div className="text-sm rounded-xl px-2.5 py-1.5 mt-1 text-right leading-relaxed"
              style={{ background: theme.noteBg, color: done ? '#bbb' : theme.noteText }}>
              <span className="font-bold">📝 </span>{event.notes}
            </div>
          )}
          {event.meeting_link && !done && (
            <a href={event.meeting_link} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-lg mt-1.5 transition-opacity hover:opacity-80"
              style={{ background: theme.accent, color: '#fff' }}>🔗 כניסה לפגישה</a>
          )}
          {/* Non-image / failed-image attachment link */}
          {event.attachment_url && imgFailed && (
            <a href={event.attachment_url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg mt-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
              📎 קובץ מצורף ↗
            </a>
          )}
          {/* Reactions row */}
          <div className="flex items-center gap-1 flex-row-reverse mt-1.5 flex-wrap">
            {Object.entries(grouped).map(([emoji, count]) => (
              <button key={emoji} onClick={() => onReact(emoji)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold transition-all hover:scale-110 active:scale-95"
                style={{ background: theme.badgeBg, color: theme.badgeText }}>
                <span>{emoji}</span>
                {count > 1 && <span>{count}</span>}
              </button>
            ))}
            {/* + reaction button */}
            <div className="relative">
              <button onClick={() => setShowPicker(p => !p)}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all hover:scale-110"
                style={{ background: theme.badgeBg, color: theme.badgeText }}>+</button>
              {showPicker && (
                <div className="absolute bottom-full mb-1 right-0 flex gap-1 bg-white rounded-2xl shadow-xl border border-gray-100 px-2 py-1.5 z-20 flex-row-reverse">
                  {REACTION_EMOJIS.map(e => (
                    <button key={e} onClick={() => { onReact(e); setShowPicker(false) }}
                      className="text-base hover:scale-125 transition-transform active:scale-95">
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onEdit(event)} className="text-gray-300 hover:text-blue-500 text-xs" title="ערוך">✏️</button>
          <button onClick={() => onDelete(event.id)} className="text-gray-300 hover:text-red-500 text-xs" title="מחק">🗑️</button>
        </div>
      </div>
      </div>{/* end p-3 */}
    </div>{/* end card */}
    </>
  )
}

type DupWarning = { person: string; existingTitle: string }

// ── EventModal ─────────────────────────────────────────────────────────────
function EventModal({ form, editing, onClose, onSave, onSaveAnyway, onDismissWarning, onChange, dupWarning }: {
  form: EventForm; editing: boolean
  onClose: () => void; onSave: () => void; onSaveAnyway: () => void; onDismissWarning: () => void
  onChange: (f: Partial<EventForm>) => void
  dupWarning: DupWarning[] | null
}) {
  const cls = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white text-right"
  const lbl = "block text-xs font-bold text-gray-500 mb-1 text-right"
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json()
        onChange({ attachment_url: url })
      }
    } finally {
      setUploading(false)
    }
  }

  const toggleDay = (day: string) => onChange({
    recurrence_days: form.recurrence_days.includes(day)
      ? form.recurrence_days.filter(d => d !== day)
      : [...form.recurrence_days, day]
  })
  const togglePerson = (key: string) => onChange({
    persons: form.persons.includes(key)
      ? form.persons.filter(p => p !== key)
      : [...form.persons, key]
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">{editing ? '✏️ עריכת אירוע' : '➕ הוספת אירוע'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">

          {/* Multi-person selector */}
          <div>
            <label className={lbl}>👥 עבור מי <span className="text-gray-300 font-normal">(ניתן לבחור מספר אנשים)</span></label>
            <div className="flex flex-wrap gap-2 flex-row-reverse">
              {ALL_PEOPLE.map(p => {
                const selected = form.persons.includes(p.key)
                return (
                  <button key={p.key} type="button" onClick={() => togglePerson(p.key)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                    }`}>
                    {p.name}
                  </button>
                )
              })}
            </div>
            {form.persons.length > 1 && !editing && (
              <p className="text-xs text-blue-500 mt-1.5 text-right">✨ ייווצרו {form.persons.length} אירועים נפרדים</p>
            )}
            {form.persons.length > 1 && editing && (
              <p className="text-xs text-emerald-600 mt-1.5 text-right">✨ האירוע הנוכחי יעודכן + ייווצרו {form.persons.length - 1} אירועים חדשים</p>
            )}
          </div>

          <div><label className={lbl}>📝 כותרת *</label>
            <input type="text" value={form.title} onChange={e => onChange({ title: e.target.value })} placeholder="שם האירוע..." className={cls} /></div>
          <div><label className={lbl}>📅 תאריך</label>
            <input type="date" value={form.date} onChange={e => onChange({ date: e.target.value })} className={cls} dir="ltr" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>⏰ שעת התחלה</label>
              <input type="time" value={form.start_time} onChange={e => onChange({ start_time: e.target.value })} className={cls} dir="ltr" /></div>
            <div><label className={lbl}>⏰ שעת סיום</label>
              <input type="time" value={form.end_time} onChange={e => onChange({ end_time: e.target.value })} className={cls} dir="ltr" /></div>
          </div>
          <div><label className={lbl}>📍 מיקום</label>
            <input type="text" value={form.location} onChange={e => onChange({ location: e.target.value })} placeholder="כתובת / שם מקום..." className={cls} /></div>
          <div><label className={lbl}>📋 פרטים נוספים</label>
            <textarea value={form.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="מה להביא, הוראות, הערות..." rows={3} className={cls + ' resize-none'} /></div>
          <div><label className={lbl}>🔗 קישור לפגישה (אופציונלי)</label>
            <input type="url" value={form.meeting_link} onChange={e => onChange({ meeting_link: e.target.value })} placeholder="https://..." className={cls} dir="ltr" /></div>

          {/* Photo/attachment upload */}
          <div>
            <label className={lbl}>📎 תמונה / קובץ מצורף (אופציונלי)</label>
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            {form.attachment_url ? (
              <div className="flex items-center gap-3 flex-row-reverse">
                <a href={form.attachment_url} target="_blank" rel="noopener noreferrer">
                  <img src={form.attachment_url} alt="קובץ מצורף" className="w-16 h-16 object-cover rounded-xl shadow-sm" />
                </a>
                <button type="button" onClick={() => onChange({ attachment_url: '' })}
                  className="text-xs text-red-500 hover:text-red-700 font-bold border border-red-200 rounded-xl px-2 py-1 transition">
                  ✕ הסר
                </button>
              </div>
            ) : (
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 text-sm font-bold text-blue-600 border-2 border-dashed border-blue-200 rounded-xl px-4 py-2.5 hover:bg-blue-50 transition disabled:opacity-50">
                {uploading ? '⏳ מעלה...' : '📎 הוסף תמונה/קובץ'}
              </button>
            )}
          </div>

          {/* ── Recurring event — redesigned ─────────────────────────── */}
          <div className={`rounded-2xl border-2 transition-all ${form.is_recurring ? 'border-blue-300 bg-blue-50/60' : 'border-gray-100'} p-4`}>
            {/* Toggle */}
            <button type="button" onClick={() => onChange({ is_recurring: !form.is_recurring })}
              className="w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-row-reverse">
                {/* iOS-style toggle */}
                <div className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${form.is_recurring ? 'bg-blue-500' : 'bg-gray-200'}`}>
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${form.is_recurring ? 'right-1' : 'right-6'}`} />
                </div>
                <span className={`text-sm font-black ${form.is_recurring ? 'text-blue-700' : 'text-gray-600'}`}>🔄 אירוע קבוע (חוזר)</span>
              </div>
              {form.is_recurring && form.recurrence_days.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                  {form.recurrence_days.map(d => HE_DAYS[d]).join(' ')}
                </span>
              )}
            </button>

            {form.is_recurring && (
              <div className="mt-4 space-y-4">

                {/* Quick presets */}
                <div>
                  <div className="text-xs font-bold text-gray-500 mb-2 text-right">⚡ בחירה מהירה:</div>
                  <div className="flex flex-wrap gap-2 flex-row-reverse">
                    {RECURRENCE_PRESETS.map(preset => {
                      const isActive = preset.days.length === form.recurrence_days.length &&
                        preset.days.every(d => form.recurrence_days.includes(d))
                      return (
                        <button key={preset.label} type="button"
                          onClick={() => onChange({ recurrence_days: isActive ? [] : [...preset.days] })}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${
                            isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                          }`}>
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Individual day selector */}
                <div>
                  <div className="text-xs font-bold text-gray-500 mb-2 text-right">📅 בחר ימים ידנית:</div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_NAMES.map(day => {
                      const active = form.recurrence_days.includes(day)
                      return (
                        <button key={day} type="button" onClick={() => toggleDay(day)}
                          className={`py-2.5 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-0.5 ${
                            active ? 'bg-blue-600 text-white shadow-sm scale-105' : 'bg-white text-gray-500 border-2 border-gray-100 hover:border-blue-300'
                          }`}>
                          <span className="text-xs">{HE_DAYS[day]}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex justify-between mt-1 px-0.5">
                    {DAY_NAMES.map(day => (
                      <span key={day} className="text-[9px] text-gray-400 font-medium" style={{ width: '14.28%', textAlign: 'center' }}>
                        {HE_DAYS_FULL[day].slice(0, 3)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Next occurrences preview */}
                {form.recurrence_days.length > 0 && form.date && (
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <div className="text-xs font-bold text-blue-700 mb-2 text-right">📆 המועדים הקרובים:</div>
                    <div className="flex flex-wrap gap-1.5 flex-row-reverse">
                      {getNextOccurrences(form.date, form.recurrence_days, 6).map((d, i) => {
                        const dt = new Date(d + 'T12:00:00')
                        const dayLabel = HE_DAYS_FULL[DAY_NAMES[dt.getDay()]]
                        const dateLabel = `${dt.getDate()}/${dt.getMonth() + 1}`
                        return (
                          <span key={i} className="text-xs bg-blue-50 rounded-lg px-2.5 py-1.5 text-blue-700 font-bold border border-blue-100 leading-none">
                            {dayLabel} {dateLabel}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {form.recurrence_days.length === 0 && (
                  <p className="text-xs text-amber-600 font-bold text-right">⚠️ בחר לפחות יום אחד להחזרה</p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          {/* Duplicate warning — shown instead of normal save button */}
          {dupWarning && dupWarning.length > 0 ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3 text-right space-y-2">
              <p className="font-black text-amber-800 text-sm">⚠️ נמצא אירוע דומה!</p>
              {dupWarning.map((d, i) => (
                <p key={i} className="text-xs text-amber-700">
                  &quot;{d.existingTitle}&quot; כבר קיים עבור {PEOPLE_NAMES[d.person] || d.person}
                </p>
              ))}
              <p className="text-xs text-amber-600 font-medium">האם זה אירוע שונה? תוכל להוסיף אותו בכל זאת.</p>
              <div className="flex gap-2 pt-1 flex-row-reverse">
                <button onClick={onSaveAnyway}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-2 rounded-xl text-sm transition shadow-sm">
                  ✅ כן, אירוע שונה — הוסף
                </button>
                <button onClick={onDismissWarning}
                  className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-bold py-2 rounded-xl text-sm border-2 border-gray-200 transition">
                  ✏️ חזור לעריכה
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 flex-row-reverse">
              <button onClick={onSave} disabled={!form.title.trim() || !form.persons.length}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black py-2.5 rounded-2xl transition shadow-md text-sm">
                {editing ? '💾 שמור שינויים' : form.persons.length > 1 ? `✅ הוסף ${form.persons.length} אירועים` : '✅ הוסף אירוע'}
              </button>
              <button onClick={onClose} className="px-5 py-2.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition">ביטול</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Grocery List Panel ──────────────────────────────────────────────────────
function GroceryPanel({ items, newVal, loading, onNewChange, onAdd, onToggle, onDelete, onClearDone }: {
  items: Reminder[]; newVal: string; loading: boolean
  onNewChange: (v: string) => void
  onAdd: () => void
  onToggle: (id: string, done: boolean) => void
  onDelete: (id: string) => void
  onClearDone: () => void
}) {
  const done    = items.filter(i => i.completed)
  const pending = items.filter(i => !i.completed)

  return (
    <div className="mt-6 no-print">
      <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-emerald-100">
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-2 flex-row-reverse"
          style={{ background: 'linear-gradient(135deg,#059669,#10B981)' }}>
          <span className="text-lg">🛒</span>
          <span className="font-black text-white text-sm flex-1 text-right">רשימת קניות</span>
          <div className="flex items-center gap-2">
            {pending.length > 0 && (
              <span className="bg-white/30 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-black">{pending.length}</span>
            )}
            {done.length > 0 && (
              <button onClick={onClearDone}
                className="text-white/80 hover:text-white text-xs font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full transition whitespace-nowrap">
                נקה שנרכש ({done.length})
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-3">
          {!loading && items.length === 0 && (
            <p className="text-sm text-center text-gray-300 py-2 mb-2">הרשימה ריקה — הוסף פריטים 🥦</p>
          )}

          {/* Pending items */}
          {pending.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {pending.map(item => (
                <li key={item.id} className="flex items-center gap-2 flex-row-reverse group">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => onToggle(item.id, true)}
                    className="w-4 h-4 cursor-pointer flex-shrink-0 rounded"
                    style={{ accentColor: '#059669' }}
                  />
                  <span className="flex-1 text-sm text-right text-gray-800">{item.text}</span>
                  <button onClick={() => onDelete(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0 transition-opacity">×</button>
                </li>
              ))}
            </ul>
          )}

          {/* Done items — faded strikethrough */}
          {done.length > 0 && (
            <>
              {pending.length > 0 && <div className="border-t border-dashed border-gray-200 my-2" />}
              <ul className="space-y-1.5 mb-2">
                {done.map(item => (
                  <li key={item.id} className="flex items-center gap-2 flex-row-reverse group">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => onToggle(item.id, false)}
                      className="w-4 h-4 cursor-pointer flex-shrink-0 rounded"
                      style={{ accentColor: '#059669' }}
                    />
                    <span className="flex-1 text-sm text-right line-through text-gray-400">{item.text}</span>
                    <button onClick={() => onDelete(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0 transition-opacity">×</button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Add input */}
          <div className="flex gap-2 flex-row-reverse mt-2">
            <input
              type="text"
              value={newVal}
              onChange={e => onNewChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAdd()}
              placeholder="הוסף פריט לקניות..."
              dir="rtl"
              className="flex-1 border-2 border-emerald-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 min-w-0 bg-emerald-50/30"
            />
            <button onClick={onAdd} disabled={!newVal.trim()}
              className="text-white text-sm font-black px-4 py-2 rounded-xl disabled:opacity-40 transition shadow-sm"
              style={{ background: 'linear-gradient(135deg,#059669,#10B981)' }}>
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Family Links Panel ──────────────────────────────────────────────────────
const LINK_CATEGORIES = [
  { label: 'בית ספר', emoji: '🏫', color: '#3B82F6' },
  { label: 'בריאות',  emoji: '🏥', color: '#EF4444' },
  { label: 'ספורט',   emoji: '⚽', color: '#10B981' },
  { label: 'בידור',   emoji: '🎬', color: '#8B5CF6' },
  { label: 'עבודה',   emoji: '💼', color: '#F59E0B' },
  { label: 'אחר',     emoji: '🔗', color: '#6B7280' },
]
// ── FullWeatherPanel ──────────────────────────────────────────────────────
interface HourlyEntry { time: string; date: string; temp: number; rain: number; code: number; wind: number; humidity: number }
interface DayEntry { min: number; max: number; rain: number; code: number; sunrise: string | null; sunset: string | null }
interface FullWeatherData {
  current: { temp: number; rain: number; code: number; wind: number; humidity: number }
  hourly: HourlyEntry[]
  today: DayEntry
  tomorrow: DayEntry
  dayAfter?: DayEntry | null
}

function wxEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code === 1) return '🌤️'
  if (code === 2) return '⛅'
  if (code === 3) return '☁️'
  if (code === 45 || code === 48) return '🌫️'
  if (code >= 51 && code <= 55) return '🌦️'
  if (code >= 61 && code <= 65) return '🌧️'
  if (code >= 71 && code <= 77) return '❄️'
  if (code >= 80 && code <= 82) return '🌦️'
  if (code >= 95) return '⛈️'
  return '🌡️'
}
function wxLabel(code: number): string {
  if (code === 0) return 'בהיר ☀️'
  if (code === 1) return 'כמעט בהיר'
  if (code === 2) return 'מעונן חלקית'
  if (code === 3) return 'מעונן'
  if (code === 45 || code === 48) return 'ערפל'
  if (code >= 51 && code <= 55) return 'טפטוף'
  if (code >= 61 && code <= 65) return 'גשם 🌧️'
  if (code >= 71 && code <= 77) return 'שלג ❄️'
  if (code >= 80 && code <= 82) return 'מקלחות'
  if (code >= 95) return 'סערה ⛈️'
  return ''
}

function funWeatherMsg(temp: number, code: number): string {
  if (code >= 95) return 'היום יש סערה! תישארו בבית 🏠⚡'
  if (code >= 61 && code <= 65) return 'יורד גשם! אל תשכחו מטרייה ☂️'
  if (code >= 51 && code <= 55) return 'קצת טפטופים בחוץ, תתלבשו בהתאם 🌂'
  if (temp >= 35) return 'חם מאוד! שתו הרבה מים 💧'
  if (temp >= 28) return 'חם מחוץ! כיף לצאת לים 🏖️'
  if (temp >= 20) return 'מזג אוויר נחמד — יום טוב לפעילות בחוץ 🌳'
  if (temp >= 15) return 'נעים אבל קצת קריר — לבשו ז\'קט 🧥'
  if (temp >= 10) return 'קריר! התלבשו חם 🧣'
  return 'קר מאוד! שמרו על עצמכם 🥶'
}

const HE_WEEK = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']

function FullWeatherPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<FullWeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/weather?full=true')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Group hourly entries by date
  const byDate: Record<string, HourlyEntry[]> = {}
  if (data) {
    for (const h of data.hourly) {
      if (!h.date) continue
      if (!byDate[h.date]) byDate[h.date] = []
      byDate[h.date].push(h)
    }
  }
  const dates = Object.keys(byDate).slice(0, 3)

  const dateLabel = (d: string) => {
    const dt = new Date(d + 'T12:00:00')
    return `יום ${HE_WEEK[dt.getDay()]}, ${dt.getDate()}/${dt.getMonth() + 1}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full sm:max-w-lg bg-gradient-to-b from-[#0a1628] to-[#1a3a6e] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 px-5 pt-5 pb-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(to bottom, #0a1628, transparent)' }}>
          <h2 className="text-xl font-black text-white">🌤️ תחזית מזג האוויר</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="px-5 pb-6 space-y-5">
          {loading && (
            <div className="text-center py-12 text-white/40 text-4xl animate-pulse">🌡️</div>
          )}

          {!loading && data && (
            <>
              {/* Current conditions */}
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <div className="text-6xl mb-2">{wxEmoji(data.current.code)}</div>
                <div className="text-5xl font-black text-white tabular-nums">{Math.round(data.current.temp)}°</div>
                <div className="text-blue-200 font-bold mt-1">{wxLabel(data.current.code)}</div>
                <div className="text-yellow-300 font-black text-sm mt-2">{funWeatherMsg(data.current.temp, data.current.code)}</div>
                <div className="flex justify-center gap-4 mt-3 text-sm text-white/60">
                  {data.current.rain > 0 && <span>💧 גשם {data.current.rain}%</span>}
                  {data.current.wind > 0 && <span>💨 רוח {Math.round(data.current.wind)} קמ״ש</span>}
                  {data.current.humidity > 0 && <span>🌊 לחות {data.current.humidity}%</span>}
                </div>
              </div>

              {/* Day summaries */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'היום', d: data.today },
                  { label: 'מחר', d: data.tomorrow },
                  ...(data.dayAfter ? [{ label: 'מחרתיים', d: data.dayAfter }] : []),
                ].map(({ label, d }) => (
                  <div key={label} className="bg-white/10 rounded-2xl p-3 text-center">
                    <div className="text-sm font-bold text-white/50 mb-1">{label}</div>
                    <div className="text-2xl">{wxEmoji(d.code)}</div>
                    <div className="text-white font-black tabular-nums mt-1">{Math.round(d.min)}°–{Math.round(d.max)}°</div>
                    {d.rain > 0 && <div className="text-sky-300 text-xs mt-1">💧 {d.rain}%</div>}
                    {d.sunrise && <div className="text-yellow-200/60 text-[11px] mt-1">🌅 {d.sunrise} | 🌇 {d.sunset}</div>}
                  </div>
                ))}
              </div>

              {/* Hourly forecast per day */}
              {dates.map(date => (
                <div key={date}>
                  <div className="text-white/60 text-xs font-bold mb-2">{dateLabel(date)}</div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {byDate[date].filter((_, i) => i % 2 === 0).map((h, i) => (
                      <div key={i}
                        className="flex-shrink-0 flex flex-col items-center gap-1 bg-white/10 rounded-xl px-2.5 py-2 min-w-[52px]">
                        <span className="text-[11px] font-bold text-white/50">{h.time}</span>
                        <span className="text-lg leading-none">{wxEmoji(h.code)}</span>
                        <span className="text-sm font-black text-white tabular-nums">{Math.round(h.temp)}°</span>
                        {h.rain > 0 && (
                          <>
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-sky-400 rounded-full" style={{ width: `${h.rain}%` }} />
                            </div>
                            <span className="text-[9px] text-sky-300">{h.rain}%</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LinksPanel({ links, newLinkTitle, newLinkUrl, loading, onTitleChange, onUrlChange, onAdd, onDelete }: {
  links: { id: string; title: string; url: string }[]
  newLinkTitle: string; newLinkUrl: string; loading: boolean
  onTitleChange: (v: string) => void; onUrlChange: (v: string) => void
  onAdd: () => void; onDelete: (id: string) => void
}) {
  const hostOf = (url: string) => { try { return new URL(url).hostname.replace('www.','') } catch { return url } }
  const faviconOf = (url: string) => { try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32` } catch { return null } }

  return (
    <div className="bg-white rounded-3xl shadow-md overflow-hidden border border-blue-100">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3 flex-row-reverse"
        style={{ background: 'linear-gradient(135deg,#2563EB,#4F46E5)' }}>
        <span className="text-2xl">🔗</span>
        <div className="flex-1 text-right">
          <div className="font-black text-white text-lg">קישורים משפחתיים</div>
          <div className="text-blue-200 text-xs mt-0.5">גישה מהירה לאתרים ושירותים חשובים</div>
        </div>
        {links.length > 0 && (
          <span className="bg-white/20 text-white text-sm font-black px-2.5 py-1 rounded-full">{links.length}</span>
        )}
      </div>

      <div className="p-5">
        {/* Links grid */}
        {!loading && links.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <div className="text-5xl mb-3">🔗</div>
            <div className="font-bold text-base mb-1">אין קישורים עדיין</div>
            <div className="text-sm">הוסף קישורים לאתרים שאתם משתמשים בהם לעתים קרובות</div>
          </div>
        )}
        {links.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {links.map(link => (
              <div key={link.id} className="group flex items-center gap-3 flex-row-reverse bg-gray-50 hover:bg-blue-50 rounded-2xl px-4 py-3 border border-gray-100 hover:border-blue-200 transition-all">
                <div className="flex-shrink-0">
                  {faviconOf(link.url)
                    ? <img src={faviconOf(link.url)!} alt="" className="w-8 h-8 rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                    : <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-lg">🔗</div>
                  }
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <a href={link.url} target="_blank" rel="noopener noreferrer"
                    className="font-black text-gray-800 hover:text-blue-600 text-sm leading-snug block truncate transition-colors">
                    {link.title}
                  </a>
                  <div className="text-xs text-gray-400 truncate">{hostOf(link.url)}</div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <a href={link.url} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white text-sm transition shadow-sm"
                    title="פתח">↗</a>
                  <button onClick={() => onDelete(link.id)}
                    className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-red-100 hover:text-red-500 flex items-center justify-center text-gray-400 text-sm transition opacity-0 group-hover:opacity-100"
                    title="מחק">×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new link form */}
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <div className="text-xs font-bold text-gray-400 text-right mb-2">➕ הוסף קישור</div>
          <input type="text" value={newLinkTitle} onChange={e => onTitleChange(e.target.value)}
            placeholder="שם הקישור (לדוג׳: יומן בי&quot;ס)" dir="rtl"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
          <input type="url" value={newLinkUrl} onChange={e => onUrlChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAdd()}
            placeholder="https://..." dir="ltr"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
          <button onClick={onAdd} disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
            className="w-full text-white font-black py-2.5 rounded-xl disabled:opacity-40 transition shadow-sm text-sm"
            style={{ background: 'linear-gradient(135deg,#2563EB,#4F46E5)' }}>
            ➕ הוסף קישור
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Standalone Reminders Panel ──────────────────────────────────────────────
function RemindersPanel({ reminders, newVal, loading, onNewChange, onAdd, onToggle, onDelete }: {
  reminders: Reminder[]; newVal: string; loading: boolean
  onNewChange: (v: string) => void; onAdd: () => void
  onToggle: (id: string, done: boolean) => void; onDelete: (id: string) => void
}) {
  const pending = reminders.filter(r => !r.completed)
  const done    = reminders.filter(r => r.completed)
  return (
    <div className="mt-6 no-print">
      <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-amber-100">
        <div className="px-4 py-3 flex items-center gap-2 flex-row-reverse"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)' }}>
          <span className="text-lg">📋</span>
          <span className="font-black text-white text-sm flex-1 text-right">תזכורות</span>
          <div className="flex items-center gap-2">
            {pending.length > 0 && (
              <span className="bg-white/30 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-black">{pending.length}</span>
            )}
            {done.length > 0 && (
              <button onClick={() => done.forEach(r => onDelete(r.id))}
                className="text-white/80 hover:text-white text-xs font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full transition whitespace-nowrap">
                שחרר ({done.length})
              </button>
            )}
          </div>
        </div>
        <div className="px-4 py-3">
          {!loading && reminders.length === 0 && (
            <p className="text-sm text-center text-gray-300 py-1 mb-2">אין תזכורות</p>
          )}
          {/* Pending reminders */}
          {pending.length > 0 && (
            <ul className="space-y-2 mb-2">
              {pending.map(r => (
                <li key={r.id} className="flex items-center gap-3 flex-row-reverse">
                  <button onClick={() => onToggle(r.id, true)}
                    className="w-7 h-7 rounded-full border-2 border-amber-300 flex items-center justify-center flex-shrink-0 hover:bg-amber-50 transition active:scale-95"
                    style={{ minWidth: 28, minHeight: 28 }} title="סמן כבוצע">
                    <span className="text-amber-400 text-sm">○</span>
                  </button>
                  <span className="flex-1 text-sm text-right text-gray-700">{r.text}</span>
                  <button onClick={() => onDelete(r.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
                </li>
              ))}
            </ul>
          )}
          {/* Done reminders — stay visible until manually released */}
          {done.length > 0 && (
            <>
              {pending.length > 0 && <div className="border-t border-amber-100 my-2" />}
              <ul className="space-y-1.5 mb-2">
                {done.map(r => (
                  <li key={r.id} className="flex items-center gap-3 flex-row-reverse opacity-50">
                    <button onClick={() => onToggle(r.id, false)}
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition active:scale-95"
                      style={{ minWidth: 28, minHeight: 28, background: '#F59E0B' }} title="בטל סימון">
                      <span className="text-white text-sm">✓</span>
                    </button>
                    <span className="flex-1 text-sm text-right text-gray-400 line-through">{r.text}</span>
                    <button onClick={() => onDelete(r.id)} className="text-gray-300 hover:text-red-400 text-base leading-none flex-shrink-0">×</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2 flex-row-reverse">
            <input type="text" value={newVal} onChange={e => onNewChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAdd()}
              placeholder="הוסף תזכורת..." dir="rtl"
              className="flex-1 border-2 border-amber-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 min-w-0 bg-amber-50/40" />
            <button onClick={onAdd} disabled={!newVal.trim()}
              className="text-white text-sm font-black px-4 py-2 rounded-xl disabled:opacity-40 transition shadow-sm"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)' }}>+</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function KidsSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [activeTab, setActiveTab] = useState<TabKey>('kids')
  const [events, setEvents] = useState<Event[]>([])

  // Standalone reminders — not tied to any date or person
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newReminder, setNewReminder] = useState('')
  const [loadingReminders, setLoadingReminders] = useState(true)

  // Grocery list
  const [groceries, setGroceries] = useState<Reminder[]>([])
  const [newGrocery, setNewGrocery] = useState('')
  const [loadingGroceries, setLoadingGroceries] = useState(true)

  // Family links
  interface FamilyLink { id: string; title: string; url: string }
  const [links, setLinks] = useState<FamilyLink[]>([])
  const [newLinkTitle, setNewLinkTitle] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [loadingLinks, setLoadingLinks] = useState(true)

  const [loadingEvents, setLoadingEvents] = useState(true)
  const [kidThemeIdx, setKidThemeIdx] = useState<Record<string,number>>({ami:0,alex:0,itan:0,assaf:0,danil:0})

  // Kid profile photos
  const [kidPhotos, setKidPhotos] = useState<Record<string, string>>({})
  const [showPhotoGallery, setShowPhotoGallery] = useState(false)
  const [photoGalleryKid, setPhotoGalleryKid] = useState('')
  const [showVideoModal, setShowVideoModal] = useState(false)

  // Now view
  const [nowEvents, setNowEvents] = useState<Event[]>([])
  const [loadingNow, setLoadingNow] = useState(false)
  const [expandedNowPerson, setExpandedNowPerson] = useState<string | null>(null)

  // Event modal
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event|null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [dupWarning, setDupWarning] = useState<DupWarning[] | null>(null)
  const emptyForm = useCallback((person = ''): EventForm => ({
    title:'', persons: person ? [person] : [], date: format(selectedDate,'yyyy-MM-dd'),
    start_time:'', end_time:'', location:'', notes:'',
    is_recurring: false, recurrence_days: [], meeting_link:'', attachment_url:''
  }), [selectedDate])
  const [eventForm, setEventForm] = useState<EventForm>(() => emptyForm())

  // Reactions — keyed by event_id
  const [reactions, setReactions] = useState<Record<string, { person: string; emoji: string }[]>>({})

  // WhatsApp send panel
  const [showWAPanel, setShowWAPanel] = useState(false)
  const [waMessage, setWaMessage] = useState('')
  const [waTo, setWaTo] = useState('group')
  const [waSending, setWaSending] = useState(false)
  const [waSentMsg, setWaSentMsg] = useState('')

  // Weather full panel
  const [showWeatherPanel, setShowWeatherPanel] = useState(false)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const dayOfWeek = DAY_NAMES[selectedDate.getDay()]

  const getTheme = (key: string): KidTheme =>
    KID_THEMES[key]?.[kidThemeIdx[key] ?? 0]
    ?? KID_THEMES[key]?.[0]
    ?? KID_THEME_PACKS[key]?.[0]
    ?? THEMES.blue

  const cycleTheme = (key: string) => {
    const len = KID_THEMES[key]?.length ?? KID_THEME_PACKS[key]?.length ?? 3
    setKidThemeIdx(prev => ({ ...prev, [key]: ((prev[key] ?? 0) + 1) % len }))
  }

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const res = await fetch(`/api/events?start=${dateStr}&end=${dateStr}&include_recurring=true`)
      if (res.ok) {
        const data: Event[] = await res.json()
        setEvents(data)
        // Batch-fetch reactions for all loaded events
        const ids = data.map(e => e.id)
        if (ids.length) {
          const rRes = await fetch(`/api/reactions?event_ids=${ids.join(',')}`)
          if (rRes.ok) {
            const rData: { event_id: string; person: string; emoji: string }[] = await rRes.json()
            const grouped: Record<string, { person: string; emoji: string }[]> = {}
            for (const r of rData) {
              if (!grouped[r.event_id]) grouped[r.event_id] = []
              grouped[r.event_id].push({ person: r.person, emoji: r.emoji })
            }
            setReactions(grouped)
          }
        }
      }
    } finally { setLoadingEvents(false) }
  }, [dateStr])

  // Load ALL standalone reminders (not tied to date)
  const loadReminders = useCallback(async () => {
    setLoadingReminders(true)
    try {
      const res = await fetch('/api/reminders?general=true')
      if (res.ok) setReminders(await res.json())
    } finally { setLoadingReminders(false) }
  }, [])

  // Load grocery list
  const loadGroceries = useCallback(async () => {
    setLoadingGroceries(true)
    try {
      const res = await fetch('/api/reminders?grocery=true')
      if (res.ok) setGroceries(await res.json())
    } finally { setLoadingGroceries(false) }
  }, [])

  // Load family links (stored in reminders with person='__link__', text='title||url')
  const loadLinks = useCallback(async () => {
    setLoadingLinks(true)
    try {
      const res = await fetch('/api/reminders?links=true')
      if (res.ok) {
        const raw: Reminder[] = await res.json()
        setLinks(raw.map(r => {
          const [title, ...urlParts] = r.text.split('||')
          return { id: r.id, title: title || r.text, url: urlParts.join('||') || '' }
        }))
      }
    } finally { setLoadingLinks(false) }
  }, [])

  // Load upcoming events for the "Now" view (next 7 days, all people)
  const loadNowEvents = useCallback(async () => {
    setLoadingNow(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const end   = format(addDays(new Date(), 7), 'yyyy-MM-dd')
      const res = await fetch(`/api/events?start=${today}&end=${end}&include_recurring=true`)
      if (res.ok) setNowEvents(await res.json())
    } finally { setLoadingNow(false) }
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])
  useEffect(() => { loadReminders() }, [loadReminders])
  useEffect(() => { loadGroceries() }, [loadGroceries])
  useEffect(() => { loadLinks() }, [loadLinks])
  useEffect(() => { loadNowEvents() }, [loadNowEvents])   // load on mount so data is ready

  // Reload + auto-refresh whenever Now tab is active
  useEffect(() => {
    if (activeTab === 'now') loadNowEvents()
  }, [activeTab]) // eslint-disable-line
  useEffect(() => {
    const id = setInterval(() => { if (activeTab === 'now') loadNowEvents() }, 60_000)
    return () => clearInterval(id)
  }, [activeTab, loadNowEvents])

  useEffect(() => {
    fetch('/api/kid-profiles')
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, string>) => {
        setKidPhotos(data)
      })
      .catch(() => {})
  }, [])

  function handleProfileChanged(kidKey: string, url: string) {
    setKidPhotos(prev => ({ ...prev, [kidKey]: url }))
  }

  // Events CRUD
  function openAddEvent(person = '') {
    setEditingEvent(null); setEventForm(emptyForm(person)); setShowModal(true)
  }
  function openEditEvent(event: Event) {
    setEditingEvent(event)
    setEventForm({
      title: event.title, persons: [event.person], date: event.date,
      start_time: event.start_time||'', end_time: event.end_time||'',
      location: event.location||'', notes: event.notes||'',
      is_recurring: event.is_recurring, recurrence_days: event.recurrence_days||[],
      meeting_link: event.meeting_link||'',
      attachment_url: event.attachment_url||''
    })
    setShowModal(true)
  }
  async function saveEvent(force = false) {
    if (!eventForm.title.trim() || !eventForm.persons.length) return

    // ── Duplicate check (new events only, skip when editing or force-saving) ─
    if (!force && !editingEvent) {
      const dups: DupWarning[] = []
      for (const person of eventForm.persons) {
        const existing = events.find(e =>
          e.person === person &&
          (eventForm.is_recurring || e.date === eventForm.date) &&
          titlesSimilar(e.title, eventForm.title)
        )
        if (existing) dups.push({ person, existingTitle: existing.title })
      }
      if (dups.length > 0) {
        setDupWarning(dups)
        return  // pause — wait for user to confirm or cancel
      }
    }

    setDupWarning(null)
    setSavingEvent(true)
    try {
      const basePayload = {
        title: eventForm.title, date: eventForm.date,
        start_time: eventForm.start_time||null, end_time: eventForm.end_time||null,
        location: eventForm.location||null, notes: eventForm.notes||null,
        meeting_link: eventForm.meeting_link||null,
        attachment_url: eventForm.attachment_url||null,
        is_recurring: eventForm.is_recurring,
        recurrence_days: eventForm.is_recurring ? eventForm.recurrence_days : null,
      }
      if (editingEvent) {
        // Edit: update existing event with first person; create new events for any added persons
        const primaryPerson = eventForm.persons[0] || editingEvent.person
        const payload = { ...basePayload, person: primaryPerson }
        const res = await fetch(`/api/events?id=${editingEvent.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
        if (res.ok) { const updated = await res.json(); setEvents(prev => prev.map(e => e.id===editingEvent.id ? {...e,...updated} : e)) }
        // Create events for additional persons added during edit (always bypass dup check)
        const extraPersons = eventForm.persons.slice(1)
        const newEvents: Event[] = []
        for (const person of extraPersons) {
          const r = await fetch('/api/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...basePayload, person }) })
          if (r.ok) { const c = await r.json(); if (c.id) newEvents.push(c) }
        }
        if (newEvents.length > 0) setEvents(prev => [...prev, ...newEvents])
      } else {
        // New: create one event per selected person
        const created: Event[] = []
        for (const person of eventForm.persons) {
          const res = await fetch('/api/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...basePayload, person }) })
          if (res.ok) { const c = await res.json(); if (c.id) created.push(c) }
        }
        setEvents(prev => [...prev, ...created])
      }
      setShowModal(false)
    } finally { setSavingEvent(false) }
  }
  async function toggleEvent(event: Event) {
    setEvents(prev => prev.map(e => e.id===event.id ? {...e, completed:!e.completed} : e))
    await fetch(`/api/events?id=${event.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({completed:!event.completed}) })
  }
  async function deleteEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id!==id))
    await fetch(`/api/events?id=${id}`, { method:'DELETE' })
  }

  // Reminders CRUD (standalone — no person/date)
  async function addReminder() {
    const text = newReminder.trim(); if (!text) return
    const res = await fetch('/api/reminders', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date: format(new Date(),'yyyy-MM-dd'), person: null, text, completed: false }) })
    if (res.ok) { const data = await res.json(); setReminders(prev => [...prev, data]); setNewReminder('') }
  }
  async function toggleReminder(id: string, done: boolean) {
    setReminders(prev => prev.map(r => r.id===id ? {...r, completed: done} : r))
    await fetch(`/api/reminders?id=${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ completed: done }) })
  }
  async function deleteReminder(id: string) {
    setReminders(prev => prev.filter(r => r.id!==id))
    await fetch(`/api/reminders?id=${id}`, { method:'DELETE' })
  }

  // Grocery CRUD
  async function addGrocery() {
    const text = newGrocery.trim(); if (!text) return
    const res = await fetch('/api/reminders', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date: format(new Date(),'yyyy-MM-dd'), person: '__grocery__', text, completed: false }) })
    if (res.ok) { const data = await res.json(); setGroceries(prev => [...prev, data]); setNewGrocery('') }
  }
  async function toggleGrocery(id: string, done: boolean) {
    setGroceries(prev => prev.map(g => g.id===id ? {...g, completed: done} : g))
    await fetch(`/api/reminders?id=${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ completed: done }) })
  }
  async function deleteGrocery(id: string) {
    setGroceries(prev => prev.filter(g => g.id!==id))
    await fetch(`/api/reminders?id=${id}`, { method:'DELETE' })
  }
  async function clearDoneGroceries() {
    const done = groceries.filter(g => g.completed)
    setGroceries(prev => prev.filter(g => !g.completed))
    await Promise.all(done.map(g => fetch(`/api/reminders?id=${g.id}`, { method:'DELETE' })))
  }

  // Links CRUD
  async function addLink() {
    const title = newLinkTitle.trim(); const url = newLinkUrl.trim()
    if (!title || !url) return
    const res = await fetch('/api/reminders', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date: format(new Date(),'yyyy-MM-dd'), person: '__link__', text: `${title}||${url}`, completed: false }) })
    if (res.ok) {
      const data = await res.json()
      setLinks(prev => [...prev, { id: data.id, title, url }])
      setNewLinkTitle(''); setNewLinkUrl('')
    }
  }
  async function deleteLink(id: string) {
    setLinks(prev => prev.filter(l => l.id !== id))
    await fetch(`/api/reminders?id=${id}`, { method:'DELETE' })
  }

  // Reactions
  async function toggleReaction(eventId: string, emoji: string) {
    const person = 'assaf'
    // Optimistic update
    setReactions(prev => {
      const current = prev[eventId] || []
      const exists = current.some(r => r.person === person && r.emoji === emoji)
      const updated = exists
        ? current.filter(r => !(r.person === person && r.emoji === emoji))
        : [...current, { person, emoji }]
      return { ...prev, [eventId]: updated }
    })
    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, person, emoji })
      })
    } catch { /* ignore — optimistic is fine */ }
  }

  // WhatsApp send function
  async function sendWhatsApp() {
    if (!waMessage.trim()) return
    setWaSending(true)
    setWaSentMsg('')
    try {
      const res = await fetch('/api/whatsapp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: waTo, body: waMessage.trim() }),
      })
      if (res.ok) {
        setWaSentMsg('✅ ההודעה נשלחה!')
        setWaMessage('')
        setTimeout(() => { setWaSentMsg(''); setShowWAPanel(false) }, 2000)
      } else {
        const { error } = await res.json()
        setWaSentMsg(`❌ שגיאה: ${error || 'לא ידוע'}`)
      }
    } catch (e) {
      setWaSentMsg('❌ שגיאת רשת')
    } finally {
      setWaSending(false)
    }
  }

  // Helpers
  function getPersonEvents(key: string) {
    return events.filter(e => {
      if (e.person !== key) return false
      if (e.is_recurring && e.recurrence_days) return e.recurrence_days.includes(dayOfWeek)
      return e.date === dateStr
    }).sort((a,b) => (a.start_time??'').localeCompare(b.start_time??''))
  }

  const dateLabel = format(selectedDate, 'EEEE, d בMMMM yyyy', { locale: he })

  // ── Time-aware helpers ─────────────────────────────────────────────────
  // Current time string for comparison e.g. "14:30"
  const nowTimeStr = format(new Date(), 'HH:mm')
  const todayStr2 = format(new Date(), 'yyyy-MM-dd')
  // Is an event in the past for today's date?
  function isEventPast(event: Event): boolean {
    if (event.is_recurring) return false // recurring events are never "past"
    if (event.date !== todayStr2) return false // only today's events
    if (!event.start_time) return false
    const endTime = event.end_time || event.start_time
    return endTime.slice(0, 5) < nowTimeStr
  }
  function isEventNext(event: Event, allEvents: Event[]): boolean {
    if (!event.start_time || event.is_recurring) return false
    if (event.date !== todayStr2) return false
    if (isEventPast(event)) return false
    // The first upcoming event of the day (earliest start_time that's in the future)
    const upcoming = allEvents
      .filter(e => e.date === todayStr2 && e.start_time && !isEventPast(e) && !e.is_recurring)
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    return upcoming[0]?.id === event.id
  }

  // ── "Now" view helpers ──────────────────────────────────────────────────
  function timeUntil(eventDate: string, eventTime: string): string {
    const now = new Date()
    const eventDt = new Date(`${eventDate}T${eventTime.slice(0,5)}:00`)
    const diffMs = eventDt.getTime() - now.getTime()
    if (diffMs <= 0) return 'עכשיו'
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 60) return `בעוד ${diffMin} דק׳`
    const diffHrs = Math.floor(diffMin / 60)
    if (diffHrs < 24) return `בעוד ${diffHrs} שע׳`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays === 1) return 'מחר'
    return `בעוד ${diffDays} ימים`
  }

  function nowDayLabel(eventDate: string): string {
    const today    = format(new Date(), 'yyyy-MM-dd')
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    // Always show actual Hebrew day name; add date for events beyond tomorrow
    if (eventDate === today || eventDate === tomorrow)
      return format(new Date(eventDate + 'T12:00:00'), 'EEEE', { locale: he })
    return format(new Date(eventDate + 'T12:00:00'), 'EEEE d/M', { locale: he })
  }

  // Dashboard helpers
  const PERSON_NAMES: Record<string,string> = { ami:'אמי', alex:'אלכס', itan:'איתן', assaf:'אסף', danil:'דניאל' }
  const PERSON_COLORS: Record<string,string> = { ami:'#E91E63', alex:'#8E24AA', itan:'#2E7D32', assaf:'#1D4ED8', danil:'#15803D' }

  function heatmapColor(personKey: string, count: number) {
    if (count === 0) return { bg: '#F3F4F6', text: '#D1D5DB' }
    const c = PERSON_COLORS[personKey] || '#6B7280'
    const alphas = ['33','66','99','cc']
    const alpha = alphas[Math.min(count - 1, 3)]
    return { bg: c + alpha, text: count >= 3 ? c : c }
  }

  return (
    <>
      <style>{`
        body { background: #F0F4F8; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          nav, header { display: none !important; }
          .print-table { display: block !important; }
          .screen-only { display: none !important; }
          @page { size: A4 landscape; margin: 5mm; }
        }
        @media screen { .print-table { display: none; } }
      `}</style>

      {showModal && (
        <EventModal form={eventForm} editing={!!editingEvent}
          onClose={() => { setShowModal(false); setDupWarning(null) }}
          onSave={() => saveEvent(false)}
          onSaveAnyway={() => saveEvent(true)}
          onDismissWarning={() => setDupWarning(null)}
          onChange={patch => { setEventForm(prev => ({ ...prev, ...patch })); setDupWarning(null) }}
          dupWarning={dupWarning} />
      )}

      {showVideoModal && (
        <VideoSummaryModal onClose={() => setShowVideoModal(false)} />
      )}

      {/* ── FULL WEATHER PANEL ────────────────────────────────────────── */}
      {showWeatherPanel && (
        <FullWeatherPanel onClose={() => setShowWeatherPanel(false)} />
      )}

      {/* ── WHATSAPP SEND PANEL ───────────────────────────────────────── */}
      {showWAPanel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full sm:max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden" dir="rtl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
              <h2 className="text-lg font-black text-white">📱 שלח הודעה לווצאפ</h2>
              <button onClick={() => setShowWAPanel(false)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Recipient selector */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 text-right">📨 שלח אל:</p>
                <div className="flex flex-wrap gap-2 flex-row-reverse">
                  {[
                    { key: 'group', label: '👨‍👩‍👧‍👦 קבוצה' },
                    { key: 'assaf', label: 'אסף' },
                    { key: 'danil', label: 'דניאל' },
                    { key: 'ami',   label: 'אמי' },
                    { key: 'alex',  label: 'אלכס' },
                    { key: 'itan',  label: 'איתן' },
                  ].map(p => (
                    <button key={p.key} type="button" onClick={() => setWaTo(p.key)}
                      className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all border-2 ${
                        waTo === p.key
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'
                      }`}
                      style={waTo === p.key ? { background: 'linear-gradient(135deg,#25D366,#128C7E)' } : {}}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={waMessage}
                onChange={e => { setWaMessage(e.target.value); setWaSentMsg('') }}
                placeholder="כתוב/י הודעה..."
                rows={4}
                className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 resize-none text-right"
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) sendWhatsApp() }}
              />
              {waSentMsg && (
                <p className={`text-sm font-bold text-right ${waSentMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{waSentMsg}</p>
              )}
              <div className="flex gap-2 flex-row-reverse">
                <button onClick={sendWhatsApp} disabled={waSending || !waMessage.trim()}
                  className="flex-1 py-2.5 rounded-2xl font-black text-white transition disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
                  {waSending ? '⏳ שולח...' : '📤 שלח'}
                </button>
                <button onClick={() => { setShowWAPanel(false); setWaMessage(''); setWaSentMsg('') }}
                  className="px-5 py-2.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition">
                  ביטול
                </button>
              </div>
              <p className="text-[11px] text-gray-300 text-center">Ctrl+Enter לשליחה מהירה</p>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING ACTION BUTTONS — left side column ───────────────── */}
      {/* Stack (bottom→top): WA 💬 → Weather 🌤️ → Chat 🤖 (ChatWidget)  */}
      {/* WA: bottom 24px */}
      <button onClick={() => setShowWAPanel(true)}
        title="שלח הודעת ווצאפ"
        className="fixed z-40 no-print w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition active:scale-90 hover:scale-105 text-xl"
        style={{ bottom: 24, left: 16, background: 'linear-gradient(135deg,#25D366,#128C7E)', boxShadow: '0 4px 14px rgba(37,211,102,0.5)' }}>
        💬
      </button>
      {/* Weather: bottom 80px */}
      <button onClick={() => setShowWeatherPanel(true)}
        title="תחזית מזג אוויר מלאה"
        className="fixed z-40 no-print w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition active:scale-90 hover:scale-105 text-xl"
        style={{ bottom: 80, left: 16, background: 'linear-gradient(135deg,#0EA5E9,#1D4ED8)', boxShadow: '0 4px 14px rgba(14,165,233,0.5)' }}>
        🌤️
      </button>
      {/* Chat 🤖 is at bottom 148px — rendered by ChatWidget in layout */}

      {/* ── PRINT (daily) ──────────────────────────────────────────────────── */}
      <div className="print-table w-full">
        <div style={{ fontFamily: 'Arial, sans-serif', direction: 'rtl', fontSize: 15 }}>
          <div style={{ textAlign: 'center', marginBottom: 6, borderBottom: '2.5px solid #000', paddingBottom: 5 }}>
            <div style={{ fontSize: 24, fontWeight: 900 }}>📅 לו&quot;ז משפחת אלוני — {format(selectedDate, 'd.M.yyyy', { locale: he })}</div>
            <div style={{ fontSize: 14, color: '#444', marginTop: 2 }}>{dateLabel}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {KIDS.map(kid => {
              const evs = getPersonEvents(kid.key)
              return (
                <div key={kid.key} style={{ border: '2px solid #222', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ background: '#222', color: '#fff', padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{kid.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>{evs.length === 0 ? 'יום חופשי' : `${evs.length} פעילויות`}</div>
                  </div>
                  <div style={{ padding: '6px 8px', minHeight: 40 }}>
                    {evs.length === 0 ? <div style={{ color: '#bbb', textAlign: 'center', fontSize: 14, padding: '8px 0' }}>—</div>
                    : evs.map((ev, i) => (
                      <div key={ev.id} style={{ marginBottom: i<evs.length-1?7:0, paddingBottom: i<evs.length-1?7:0, borderBottom: i<evs.length-1?'1px dashed #ccc':'none' }}>
                        <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>{ev.title}</div>
                        {ev.start_time && <div style={{ fontSize: 13, color: '#333', marginTop: 2 }} dir="ltr">⏰ {ev.start_time.slice(0,5)}{ev.end_time?`–${ev.end_time.slice(0,5)}`:''}</div>}
                        {ev.location && <div style={{ fontSize: 13, color: '#333', marginTop: 1 }}>📍 {ev.location}</div>}
                        {ev.notes && <div style={{ fontSize: 12, color: '#555', marginTop: 2, background: '#f5f5f5', padding: '2px 5px', borderRadius: 3 }}>📝 {ev.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── SCREEN ─────────────────────────────────────────────────────── */}
      <div className="screen-only max-w-6xl mx-auto px-3 pb-12">

        {/* ── Hero header (all-in-one) ───────────────────────────────── */}
        <div className="mb-5 no-print rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'linear-gradient(135deg,#0a0f1e 0%,#0f2744 40%,#1a3a6e 70%,#0f2744 100%)' }}>

          {/* Top strip: family name + actions */}
          <div className="px-3 pt-2 pb-2 sm:px-4 sm:pt-4 flex items-center justify-between gap-2 flex-row-reverse">

            {/* Right: family name + live dot */}
            <div className="flex items-center gap-2 flex-row-reverse shrink-0">
              <span className="text-lg leading-none">🏠</span>
              <h1 className="text-base font-black text-white tracking-tight leading-none">משפחת אלוני</h1>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Left: action buttons — mobile optimized */}
            <div className="flex items-center gap-1.5">
              {/* Primary: Add via inbox — always visible */}
              <a href="/inbox"
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-black rounded-2xl transition shadow-lg shadow-emerald-500/40 px-3 py-2.5 text-sm sm:px-5 sm:py-3 sm:text-base whitespace-nowrap">
                <span>✚</span>
                <span className="hidden xs:inline sm:inline">הכנס נתונים</span>
              </a>
              {/* Add event directly */}
              <button
                onClick={() => openAddEvent(['ami','alex','itan'].includes(activeTab) ? activeTab : '')}
                className="flex items-center gap-1 bg-blue-500/80 hover:bg-blue-400/80 active:bg-blue-600/80 text-white font-black rounded-2xl transition px-3 py-2.5 text-sm sm:px-4 sm:py-3 sm:text-base whitespace-nowrap"
                title="הוסף אירוע">
                <span>➕</span>
                <span className="hidden sm:inline">אירוע</span>
              </button>
              {/* AI video */}
              <button
                onClick={() => setShowVideoModal(true)}
                className="bg-purple-500/80 hover:bg-purple-400/80 active:bg-purple-600/80 text-white text-sm font-bold w-10 h-10 rounded-xl transition flex items-center justify-center"
                title="סיכום וידאו AI">
                🎬
              </button>
              {/* Print — desktop only */}
              <button onClick={() => window.print()}
                className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/70 hover:text-white text-sm w-10 h-10 rounded-xl transition hidden sm:flex items-center justify-center"
                title="הדפס">
                🖨️
              </button>
              {/* Logout */}
              <button onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/login' }}
                className="bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/80 text-xs px-2 py-2.5 rounded-xl transition hidden sm:block">
                יציאה
              </button>
            </div>
          </div>

          {/* Clock + compact weather row */}
          <div className="px-4 pt-1 pb-2 flex items-center justify-between gap-3">
            <div className="flex-1 flex justify-center">
              <LiveClock />
            </div>
            {/* Compact weather pill — click for full forecast */}
            <button
              onClick={() => setShowWeatherPanel(true)}
              title="לחץ לתחזית מלאה"
              className="flex-shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/25 rounded-xl px-3 py-1.5 transition-all active:scale-95 cursor-pointer">
              <WeatherWidget compact />
            </button>
          </div>

          {/* Date nav row — generous touch targets for mobile */}
          <div className="px-3 pb-3">
            {/* Current date label */}
            <div className="text-center mb-2">
              <span className="text-white/80 text-sm font-bold tracking-wide">
                {dateLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
              <button onClick={() => setSelectedDate(d => subDays(d, 1))}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white font-bold text-lg transition">‹</button>
              <button onClick={() => setSelectedDate(new Date())}
                className="flex-1 h-10 font-bold bg-amber-500/80 hover:bg-amber-400/80 active:bg-amber-600/80 text-white text-sm rounded-xl transition whitespace-nowrap max-w-[72px]">
                היום
              </button>
              <button onClick={() => setSelectedDate(addDays(new Date(), 1))}
                className="flex-1 h-10 font-bold bg-sky-500/70 hover:bg-sky-400/70 active:bg-sky-600/70 text-white text-sm rounded-xl transition whitespace-nowrap max-w-[72px]">
                מחר
              </button>
              <input type="date" value={dateStr} onChange={e => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
                className="bg-white/10 border border-white/20 text-white text-xs rounded-xl px-2 h-10 focus:outline-none focus:ring-2 focus:ring-white/40 w-[100px] sm:w-[110px]" />
              <button onClick={() => setSelectedDate(d => addDays(d, 1))}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white font-bold text-lg transition">›</button>
            </div>
          </div>

          {/* Separator */}
          <div className="mx-4 h-px bg-white/10" />

          {/* Tab bar */}
          <div className="px-4 py-2 flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex-shrink-0
                  ${activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/10'
                  }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── FAMILY TAB ─────────────────────────────────────────────── */}


        {/* ── KIDS TAB ───────────────────────────────────────────────── */}
        {activeTab === 'kids' && (
          loadingEvents ? <div className="text-center py-16 text-gray-400 text-xl">⏳ טוען...</div> : (
            <>
              {/* ── Kids cards ─────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {KIDS.map(kid => {
                  const theme = getTheme(kid.key)
                  const evs = getPersonEvents(kid.key)
                  const nextEv = evs.filter(e => !isEventPast(e) && e.start_time).sort((a,b) => (a.start_time??'').localeCompare(b.start_time??''))[0]
                  return (
                    <div key={kid.key} className="rounded-3xl overflow-hidden shadow-xl flex flex-col"
                      style={{ background: theme.cardBg, border: `2px solid ${theme.border}33` }}>

                      {/* Hero header — full-width gradient with large centered photo */}
                      <div className="relative h-48 flex flex-col items-center justify-end pb-4"
                        style={{ background: theme.gradient ?? theme.headerGrad }}>
                        {/* Background pattern (subtle circles) */}
                        <div className="absolute inset-0 opacity-10 overflow-hidden pointer-events-none"
                          style={{ background: `radial-gradient(circle at 30% 50%, white 1px, transparent 1px) 0 0 / 20px 20px` }} />

                        {/* Large photo */}
                        <button
                          onClick={() => cycleTheme(kid.key)}
                          className="relative w-28 h-28 rounded-full overflow-hidden shadow-2xl border-4 border-white/60 hover:scale-105 transition-transform"
                          title="לחץ לשנות עיצוב">
                          {(kidPhotos[kid.key] || kid.photo)
                            ? <img src={kidPhotos[kid.key] || kid.photo!} alt={kid.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-5xl"
                                style={{ background: theme.border + '44' }}>
                                {kid.key === 'ami' ? '🌸' : kid.key === 'itan' ? '⚽' : '🎵'}
                              </div>
                          }
                        </button>

                        {/* Name + theme badge */}
                        <div className="text-center mt-2 z-10">
                          <div className="font-black text-2xl text-white drop-shadow-lg">{kid.name}</div>
                          <div className="text-white/70 text-[11px] mt-0.5">{theme.emoji ?? '🎨'} {theme.name ?? theme.label}</div>
                        </div>

                        {/* Edit photo button — top left corner */}
                        <button
                          onClick={() => { setPhotoGalleryKid(kid.key); setShowPhotoGallery(true) }}
                          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur text-white text-base flex items-center justify-center hover:bg-black/50 transition border border-white/20"
                          title="שנה תמונה">
                          📷
                        </button>
                      </div>

                      {/* Stats bar */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b"
                        style={{ background: theme.noteBg + '88', borderColor: theme.border + '22' }}>
                        <div className="text-xs font-bold" style={{ color: theme.textColor + 'aa' }}>
                          {evs.length === 0 ? 'יום חופשי 🎉' : `${evs.length} פעילויות היום`}
                        </div>
                        {nextEv && nextEv.start_time && (
                          <div className="text-xs font-black" style={{ color: theme.accent }}>
                            ⏰ {nextEv.start_time.slice(0,5)} {nextEv.title.slice(0,20)}
                          </div>
                        )}
                        <button onClick={() => openAddEvent(kid.key)}
                          className="text-xs font-black px-2.5 py-1 rounded-xl transition"
                          style={{ background: theme.badgeBg, color: theme.badgeText }}>
                          ➕ הוסף
                        </button>
                      </div>

                      {/* Events list */}
                      <div className="flex-1 px-3 pt-2 pb-3 space-y-2">
                        {evs.length === 0
                          ? <div className="text-center py-6 text-4xl opacity-20">🎈</div>
                          : evs.map(ev => <EventCard key={ev.id} event={ev} theme={theme} onToggle={toggleEvent} onDelete={deleteEvent} onEdit={openEditEvent} reactions={reactions[ev.id]||[]} onReact={emoji => toggleReaction(ev.id, emoji)} isPast={isEventPast(ev)} isNext={isEventNext(ev, events)} />)
                        }
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── Adults mini-tiles (only when they have events today) ─ */}
              {(() => {
                const adultsWithEvents = ADULTS.map(a => ({ ...a, evs: getPersonEvents(a.key) })).filter(a => a.evs.length > 0)
                if (adultsWithEvents.length === 0) return null
                const adultThemes = { assaf: ADULT_THEMES.assaf, danil: ADULT_THEMES.danil }
                return (
                  <div className="mt-4">
                    <div className="text-xs font-bold text-white/50 mb-2 text-right">גם היום:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {adultsWithEvents.map(adult => {
                        const theme = getTheme(adult.key)
                        return (
                          <div key={adult.key} className="rounded-2xl overflow-hidden shadow-md flex flex-col"
                            style={{ background: theme.bg, border: `2px solid ${theme.border}44` }}>
                            {/* Compact header */}
                            <div className="px-4 py-3 flex items-center gap-3 flex-row-reverse" style={{ background: theme.headerGrad }}>
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                                style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)' }}>{adult.emoji}</div>
                              <div className="flex-1 text-right">
                                <div className="font-black text-base text-white">{adult.name}</div>
                                <div className="text-white/60 text-xs">{adult.evs.length} אירועים היום</div>
                              </div>
                              <button onClick={() => openAddEvent(adult.key)}
                                className="text-white/70 hover:text-white text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition flex-shrink-0">
                                ➕
                              </button>
                            </div>
                            {/* Events list — compact */}
                            <div className="px-3 py-2 space-y-1.5">
                              {adult.evs.map(ev => (
                                <div key={ev.id} className="flex items-center gap-2 flex-row-reverse rounded-xl px-2.5 py-1.5 group/ae"
                                  style={{ background: theme.accent + '12' }}>
                                  {ev.start_time && (
                                    <span className="text-xs font-black flex-shrink-0" dir="ltr" style={{ color: theme.accent }}>
                                      {ev.start_time.slice(0,5)}
                                    </span>
                                  )}
                                  <span className="flex-1 text-sm font-bold text-right truncate" style={{ color: theme.textColor }}>{ev.title}</span>
                                  {ev.location && <span className="text-xs text-gray-400 truncate max-w-[80px]">📍 {ev.location}</span>}
                                  <div className="flex gap-0.5 opacity-0 group-hover/ae:opacity-100 transition flex-shrink-0">
                                    <button onClick={() => openEditEvent(ev)} className="text-gray-300 hover:text-blue-500 text-xs">✏️</button>
                                    <button onClick={() => deleteEvent(ev.id)} className="text-gray-300 hover:text-red-500 text-xs">🗑️</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </>
          )
        )}

        {/* ── PARENTS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'parents' && (
          loadingEvents
            ? <div className="text-center py-16 text-gray-400 text-xl">⏳ טוען...</div>
            : (
            <div className="max-w-4xl mx-auto" dir="rtl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'assaf', name: 'אסף',    color: '#1D4ED8', emoji: '💼', themeKey: 'assaf' },
                  { key: 'danil', name: 'דניאל',  color: '#15803D', emoji: '🌿', themeKey: 'danil' },
                ].map(parent => {
                  const theme = getTheme(parent.themeKey ?? parent.key)
                  const evs = getPersonEvents(parent.key)
                  const photo = kidPhotos[parent.key]
                  return (
                    <div key={parent.key} className="rounded-3xl overflow-hidden shadow-lg"
                      style={{ background: theme?.cardBg ?? '#fff', border: `2px solid ${parent.color}33` }}>
                      {/* Hero header */}
                      <div className="relative h-36 flex flex-col items-center justify-end pb-3"
                        style={{ background: theme?.gradient ?? `${parent.color}22` }}>
                        <div className="absolute inset-0 opacity-10 pointer-events-none"
                          style={{ background: `radial-gradient(circle at 70% 50%, white 1px, transparent 1px) 0 0 / 20px 20px` }} />

                        {/* Large photo */}
                        <button onClick={() => cycleTheme(parent.key)}
                          className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/60 shadow-2xl hover:scale-105 transition-transform flex-shrink-0">
                          {photo
                            ? <img src={photo} alt={parent.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-4xl"
                                style={{ background: parent.color + '22' }}>{parent.emoji}</div>
                          }
                        </button>
                        <div className="text-center mt-1.5">
                          <div className="font-black text-xl text-white drop-shadow">{parent.name}</div>
                          <div className="text-white/60 text-xs">{evs.length > 0 ? `${evs.length} אירועים היום` : 'חופשי היום 🎉'}</div>
                        </div>

                        {/* Action buttons — top corners */}
                        <button onClick={() => { setPhotoGalleryKid(parent.key); setShowPhotoGallery(true) }}
                          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white text-sm flex items-center justify-center hover:bg-black/50 transition border border-white/20">
                          📷
                        </button>
                        <button onClick={() => openAddEvent(parent.key)}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white text-sm font-black flex items-center justify-center hover:bg-black/50 transition border border-white/20">
                          +
                        </button>
                      </div>

                      {/* Events */}
                      <div className="p-3 space-y-2">
                        {evs.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-sm">אין אירועים היום</div>
                        ) : evs.map(ev => (
                          <EventCard key={ev.id} event={ev} theme={theme ?? KID_THEMES.assaf[0]} onToggle={toggleEvent} onDelete={deleteEvent} onEdit={openEditEvent} reactions={reactions[ev.id] || []} onReact={emoji => toggleReaction(ev.id, emoji)} isPast={isEventPast(ev)} isNext={isEventNext(ev, events)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        )}

        {/* ── LINKS TAB ──────────────────────────────────────────────── */}
        {/* ── NOW TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'now' && (() => {
          const nowDt     = new Date()
          const nowStr    = format(nowDt, 'HH:mm')
          const todayNow  = format(nowDt, 'yyyy-MM-dd')
          const tmrwNow   = format(addDays(nowDt, 1), 'yyyy-MM-dd')
          const DAY_EN    = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

          // Expand recurring events into concrete daily occurrences for next 7 days
          const expanded: (Event & { _occDate: string })[] = []
          for (let d = 0; d < 7; d++) {
            const dt      = addDays(nowDt, d)
            const dateStr = format(dt, 'yyyy-MM-dd')
            const dayName = DAY_EN[dt.getDay()]
            for (const ev of nowEvents) {
              if (!ev.is_recurring) {
                if (ev.date === dateStr) expanded.push({ ...ev, _occDate: dateStr })
              } else if (ev.recurrence_days?.includes(dayName)) {
                expanded.push({ ...ev, date: dateStr, _occDate: dateStr })
              }
            }
          }

          // Filter to only upcoming (after now), sort by date+time
          const allUpcoming = expanded
            .filter(ev => {
              if (ev._occDate === todayNow) {
                if (!ev.start_time) return true          // all-day → always show today
                return ev.start_time.slice(0, 5) >= nowStr
              }
              return ev._occDate > todayNow
            })
            .sort((a, b) => {
              if (a._occDate !== b._occDate) return a._occDate.localeCompare(b._occDate)
              if (!a.start_time) return -1
              if (!b.start_time) return 1
              return a.start_time.localeCompare(b.start_time)
            })

          // All of today's events per person (past + future), sorted by time
          const allTodayExpanded = expanded
            .filter(ev => ev._occDate === todayNow)
            .sort((a, b) => {
              if (!a.start_time) return -1
              if (!b.start_time) return 1
              return a.start_time.localeCompare(b.start_time)
            })

          const personData = FAMILY_PEOPLE.map(p => ({
            person: p,
            upcoming: allUpcoming.filter(ev => ev.person === p.key).slice(0, 2),
            allToday: allTodayExpanded.filter(ev => ev.person === p.key),
          })).filter(p => p.upcoming.length > 0)

          if (loadingNow) return (
            <div className="flex flex-col items-center justify-center py-28 gap-4">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <div className="text-white/50 font-bold text-sm">טוען אירועים...</div>
            </div>
          )

          if (personData.length === 0) return (
            <div className="text-center py-28" dir="rtl">
              <div className="text-7xl mb-4">🌙</div>
              <div className="text-white font-black text-2xl">הכל פנוי!</div>
              <div className="text-white/40 text-sm mt-2">אין אירועים בשבוע הקרוב לאף אחד</div>
            </div>
          )

          return (
            <div className="max-w-xl mx-auto space-y-3 px-2 pt-1 pb-4" dir="rtl">

              {/* Date/time strip */}
              <div className="flex items-center gap-2 px-1 py-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="text-white/45 text-xs font-bold">
                  {format(nowDt, 'EEEE, d בMMMM', { locale: he })} · {nowStr}
                </span>
              </div>

              {personData.map(({ person, upcoming, allToday }) => {
                const isExpanded = expandedNowPerson === person.key
                return (
                <div key={person.key}
                  className="rounded-3xl overflow-hidden shadow-2xl"
                  style={{ background: 'rgba(20,20,35,0.7)', border: `2px solid ${isExpanded ? person.color + 'aa' : person.color + '55'}`, backdropFilter: 'blur(16px)', transition: 'border-color 0.2s' }}>

                  {/* Person header — clickable to expand full day */}
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3 text-right transition-all active:opacity-70"
                    style={{ background: `${person.color}${isExpanded ? '35' : '22'}`, borderBottom: `1px solid ${person.color}33` }}
                    onClick={() => setExpandedNowPerson(isExpanded ? null : person.key)}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: person.color + '33', border: `2px solid ${person.color}66` }}>
                      {person.emoji}
                    </div>
                    <span className="font-black text-white text-lg">{person.name}</span>
                    <span className="mr-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: person.color + '25', color: person.color }}>
                      {upcoming.length === 1 ? '1 קרוב' : '2 קרובים'}
                    </span>
                    {allToday.length > 0 && (
                      <span className="text-white/40 text-sm transition-transform duration-200"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        ▾
                      </span>
                    )}
                  </button>

                  {/* Upcoming events (next 2) */}
                  {upcoming.map((ev, idx) => {
                    const isToday = ev._occDate === todayNow
                    const isTmrw  = ev._occDate === tmrwNow
                    // Always show actual day name; add date for events beyond tomorrow
                    const dayTag  = (isToday || isTmrw)
                                  ? format(new Date(ev._occDate + 'T12:00:00'), 'EEEE', { locale: he })
                                  : format(new Date(ev._occDate + 'T12:00:00'), 'EEEE d/M', { locale: he })
                    const until   = ev.start_time ? timeUntil(ev._occDate, ev.start_time) : null

                    return (
                      <div key={ev.id + ev._occDate}
                        className="px-5 py-4"
                        style={idx > 0 ? { borderTop: '1px solid rgba(255,255,255,0.07)' } : {}}>
                        <div className="flex items-start gap-4">

                          {/* Time block */}
                          <div className="shrink-0 text-center w-16">
                            <div className="text-white font-black text-2xl leading-none tabular-nums">
                              {ev.start_time ? ev.start_time.slice(0, 5) : '📅'}
                            </div>
                            <div className="mt-1.5 text-[11px] font-black px-2 py-0.5 rounded-lg"
                              style={{ background: person.color + '30', color: person.color }}>
                              {dayTag}
                            </div>
                          </div>

                          {/* Gradient bar */}
                          <div className="w-0.5 self-stretch rounded-full flex-shrink-0"
                            style={{ background: `linear-gradient(to bottom, ${person.color}cc, ${person.color}11)` }} />

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-black text-base leading-snug">
                              {ev.title}
                              {ev.is_recurring && (
                                <span className="text-white/35 text-xs font-normal mr-1.5">🔁</span>
                              )}
                            </div>
                            {ev.location && (
                              <div className="flex items-center gap-1 mt-1.5 text-white/55 text-sm">
                                <span className="flex-shrink-0">📍</span>
                                <span className="truncate">{ev.location}</span>
                              </div>
                            )}
                            {ev.notes && !ev.location && (
                              <div className="mt-1.5 text-white/45 text-sm truncate">
                                💬 {ev.notes}
                              </div>
                            )}
                            {until && (
                              <div className="inline-flex items-center gap-1 mt-2 text-xs font-black px-3 py-1 rounded-full"
                                style={{ background: person.color + '22', color: person.color, border: `1px solid ${person.color}44` }}>
                                ⏰ {until}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* ── Foldable full-day view ───────────────────────── */}
                  {isExpanded && allToday.length > 0 && (
                    <div style={{ borderTop: `1px solid ${person.color}33` }}>
                      <div className="flex items-center gap-2 px-5 py-2"
                        style={{ background: person.color + '15' }}>
                        <span className="text-xs font-black" style={{ color: person.color }}>
                          📅 כל אירועי היום — {format(new Date(todayNow + 'T12:00:00'), 'EEEE d בMMMM', { locale: he })}
                        </span>
                        <span className="mr-auto text-white/30 text-xs">{allToday.length} אירועים</span>
                      </div>

                      {allToday.map((ev, idx) => {
                        const isPastEv = ev.start_time ? ev.start_time.slice(0,5) < nowStr : false
                        const isNowEv  = !isPastEv && ev.start_time
                          ? ev.start_time.slice(0,5) <= nowStr && (ev.end_time ? ev.end_time.slice(0,5) > nowStr : ev.start_time.slice(0,5) === nowStr)
                          : false

                        return (
                          <div key={ev.id + '_full_' + idx}
                            className="flex items-center gap-3 px-5 py-2.5"
                            style={{
                              borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                              opacity: isPastEv ? 0.4 : 1,
                            }}>
                            {/* Time */}
                            <div className="shrink-0 w-12 text-center">
                              {isNowEv && <div className="w-2 h-2 rounded-full mx-auto mb-0.5 animate-pulse" style={{ background: person.color }} />}
                              <div className="font-black tabular-nums leading-none text-sm"
                                style={{ color: isNowEv ? person.color : 'rgba(255,255,255,0.7)', textDecoration: isPastEv ? 'line-through' : undefined }}>
                                {ev.start_time ? ev.start_time.slice(0,5) : '📅'}
                              </div>
                              {ev.end_time && <div className="text-[10px] text-white/25 mt-0.5 tabular-nums">{ev.end_time.slice(0,5)}</div>}
                            </div>
                            {/* Dot */}
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: isNowEv ? person.color : 'rgba(255,255,255,0.2)' }} />
                            {/* Title */}
                            <div className="flex-1 min-w-0">
                              <div className={`leading-snug truncate text-sm ${isNowEv ? 'font-black text-white' : 'font-semibold text-white/75'}`}
                                style={{ textDecoration: isPastEv ? 'line-through' : undefined }}>
                                {ev.title}
                                {ev.is_recurring && <span className="text-white/25 text-xs mr-1">🔁</span>}
                              </div>
                              {ev.location && <div className="text-white/35 text-xs truncate mt-0.5">📍 {ev.location}</div>}
                            </div>
                            {isNowEv && (
                              <div className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse"
                                style={{ background: person.color + '33', color: person.color, border: `1px solid ${person.color}66` }}>
                                עכשיו
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )})}
            </div>
          )
        })()}

        {activeTab === 'links' && (
          <div className="max-w-2xl mx-auto">
            <LinksPanel
              links={links} newLinkTitle={newLinkTitle} newLinkUrl={newLinkUrl} loading={loadingLinks}
              onTitleChange={setNewLinkTitle} onUrlChange={setNewLinkUrl}
              onAdd={addLink} onDelete={deleteLink} />
          </div>
        )}

        {/* ── REMINDERS + GROCERY — always at bottom ───────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4 max-w-4xl mx-auto">
          <RemindersPanel
            reminders={reminders} newVal={newReminder} loading={loadingReminders}
            onNewChange={setNewReminder} onAdd={addReminder}
            onToggle={toggleReminder} onDelete={deleteReminder} />
          <GroceryPanel
            items={groceries} newVal={newGrocery} loading={loadingGroceries}
            onNewChange={setNewGrocery} onAdd={addGrocery}
            onToggle={toggleGrocery} onDelete={deleteGrocery} onClearDone={clearDoneGroceries} />
        </div>

      </div>

      {/* ── Kid Photo Gallery ──────────────────────────────────────────── */}
      {showPhotoGallery && (() => {
        const allPeople = [
          ...KIDS,
          { key: 'assaf', name: 'אסף',   photo: null as string|null, initials: 'א' },
          { key: 'danil', name: 'דניאל', photo: null as string|null, initials: 'ד' },
        ]
        const kid = allPeople.find(k => k.key === photoGalleryKid)
        if (!kid) return null
        return (
          <KidPhotoGallery
            kid={kid}
            onClose={() => setShowPhotoGallery(false)}
            onProfileChanged={handleProfileChanged}
          />
        )
      })()}
    </>
  )
}
