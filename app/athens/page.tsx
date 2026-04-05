'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// ── Athens coordinates ─────────────────────────────────────────────────────
const ATHENS_LAT = '37.9838'
const ATHENS_LON = '23.7275'

// ── Weather helpers ────────────────────────────────────────────────────────
function weatherIcon(code: number) {
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
const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const MONTHS_HE = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ']

// ── Action types from AI ────────────────────────────────────────────────────
type AIAction =
  | { type: 'navigate_tab'; tab: 'days' | 'hotels' | 'food' | 'shopping' }
  | { type: 'open_day'; day_index: number }
  | { type: 'add_day_item'; day_index: number; item: { time: string; text: string } }
  | { type: 'remove_day_item'; day_index: number; item_index: number }
  | { type: 'update_day_tip'; day_index: number; tip: string }
  | { type: 'scroll_to_top' }

type DayItem = { time: string; text: string }
type DayData = typeof DAYS[0] & { items: DayItem[] }

// ── Data ───────────────────────────────────────────────────────────────────
const HOTELS = [
  {
    name: 'NYX Esperia Palace Hotel',
    dates: '26–28 מרץ', nights: '2 לילות',
    address: 'Stadiou 22, Athina — סינטגמה',
    booking: '6198749745', phone: '+30 21 6001 9229', rating: '4.4 ⭐',
    color: '#3B82F6', emoji: '🏙️',
    highlights: ['גג עם בר ונוף לאקרופוליס מוואר','5 דקות מכיכר סינטגמה','ספא, חדרים מעוצבים, שליטה דיגיטלית','קרוב לתחנת מטרו'],
    url: 'https://www.leonardo-hotels.com/nyx-esperia-palace-athens',
  },
  {
    name: 'Somewhere Vouliagmeni',
    dates: '28–30 מרץ', nights: '2 לילות',
    address: 'Agiou Panteleimonos — ריביירה אתונאית',
    booking: '6158400949', phone: '+30 21 0967 0000', rating: '4.8 ⭐',
    color: '#06B6D4', emoji: '🌊',
    highlights: ['ממול לחוף — נוף לים מהמרפסת','ארוחת בוקר חלומית כלולה','2 דקות מלגונת ווואליגמני','דירוג 4.8 — מהגבוהים שראינו!'],
    url: 'https://www.somewhereinathens.com',
  },
  {
    name: 'MONO Lofts',
    dates: '30 מרץ – 2 אפריל', nights: '3 לילות',
    address: 'Esopou 3, Psirri — לב אתונה',
    booking: '5870464642', phone: '+30 698 221 5518', rating: '4.2 ⭐',
    color: '#10B981', emoji: '🏘️',
    highlights: ['לופטים מרווחים — מושלם ל-5 אנשים','מטבחון מאובזר לחיסכון','2 דקות ממונסטירקי','מסעדות וקפות ממש בחוץ'],
    url: 'https://goo.gl/maps/MonoLoftsAthens',
  },
]

const DAYS = [
  {
    date: '26 מרץ', isoDate: '2026-03-26', day: 'חמישי', hotel: 'NYX Esperia', hotelColor: '#3B82F6', emoji: '✈️',
    title: 'הגעה — טיסה + הסעה + סינטגמה',
    items: [
      { time: '14:00', text: '✈️ יציאה מנמל התעופה בן גוריון — טיסה LY543, אחרי 2:15 שעות נחיתה!' },
      { time: '16:15', text: '🛬 נחיתה בשדה התעופה E. Venizelos — הורדת מזוודות (1 מזוודה לאדם מובלת)' },
      { time: '17:00', text: '🚐 הסעה מוזמנת — Athens Taxi Hub הזמנה #184353 — מיניוואן ל-5 + 7 מזוודות, €82 שולם ✅' },
      { time: '18:00', text: '🏨 צ\'ק-אין NYX Esperia Palace — Stadiou 22, סינטגמה' },
      { time: '18:30', text: '🛍️ רחוב ארמו (5 דקות הליכה) — Zara, Nike, H&M, Sephora, Foot Locker' },
      { time: '20:00', text: '🏛️ שוק מונסטירקי — וינטג\', עיצובים יווניים, ריח של אוכל רחוב' },
      { time: '21:30', text: '🌃 גג NYX — בר עם נוף לאקרופוליס מוואר. ברוכים הבאים לאתונה! 🎉' },
    ],
    links: [{ url: 'https://etickets.tap.gr', label: '🎟️ הזמינו כרטיסי אקרופוליס מראש' }],
    tip: 'מומלץ להזמין כרטיסים לאקרופוליס עוד היום!',
  },
  {
    date: '27 מרץ', isoDate: '2026-03-27', day: 'שישי', hotel: 'NYX Esperia', hotelColor: '#3B82F6', emoji: '🏛️',
    title: 'האקרופוליס ולב ההיסטוריה',
    items: [
      { time: '8:00', text: '🌅 יציאה לפני 8:30 — לאקרופוליס לפני ההמון. ילדים מתחת 18 — חינם!' },
      { time: '9:00', text: '🏛️ האקרופוליס — הפרתנון, הארקטיון, הפרופילאה. נוף על כל אתונה' },
      { time: '11:00', text: '🏺 מוזיאון האקרופוליס — רצפת זכוכית עם חפירות חיות מתחתיה' },
      { time: '13:00', text: '🏟️ אגורה העתיקה ומקדש הפייסטוס — לב הדמוקרטיה היוונית (כרטיס משולב 30€)' },
      { time: '16:00', text: '🚶 פלאקה — סמטאות ציוריות, חנויות מתנות, גלידה 🍦' },
      { time: '20:00', text: '🍢 O Kostas לסואבלקי אגדי מ-1950 — ממש ליד מונסטירקי' },
    ],
    links: [
      { url: 'https://etickets.tap.gr', label: '🎟️ כרטיסים לאקרופוליס' },
      { url: 'https://www.theacropolismuseum.gr', label: '🏛️ מוזיאון האקרופוליס' },
    ],
    tip: 'צאו לפני 8:30 — פחות תיירים, פחות חום, פחות תורים!',
  },
  {
    date: '28 מרץ', isoDate: '2026-03-28', day: 'שבת', hotel: 'NYX → Somewhere', hotelColor: '#8B5CF6', emoji: '🛍️',
    title: 'שוק פשפשים → ריביירה',
    items: [
      { time: '8:30', text: '🛍️ שוק הפשפשים מונסטירקי — ביום שבת הכי חי! אנטיקים, תקליטים, וינטג\'' },
      { time: '10:30', text: '☕ כיכר אגיאס איריניס — קפה תוסס, מוזיקה, חנויות רקורדס' },
      { time: '13:00', text: '🏨 צ\'ק-אאוט מ-NYX, נסיעה ל-Somewhere Vouliagmeni (35 דקות)' },
      { time: '15:00', text: '🌊 הגעה לווואליגמני, צ\'ק-אין, רגליים בים!' },
      { time: '20:00', text: '🐟 ארוחת ערב על הים — ברוכים הבאים לריביירה האתונאית! 🌅' },
    ],
    links: [{ url: 'https://www.somewhereinathens.com', label: '🌊 Somewhere Vouliagmeni' }],
    tip: 'שוק הפשפשים הכי חי ביום שבת — הגיעו בבוקר מוקדם!',
  },
  {
    date: '29 מרץ', isoDate: '2026-03-29', day: 'ראשון', hotel: 'Somewhere', hotelColor: '#06B6D4', emoji: '🏖️',
    title: 'חוף, לגונה וגליפדה',
    items: [
      { time: '8:30', text: '🥐 ארוחת בוקר חלומית ב-Somewhere (כלולה!) — מהטובות ביוון לפי האורחים' },
      { time: '10:00', text: '🏊 חוף ווואליגמני ממש מחוץ למלון — שחייה, שזלונגים, ים שקט ונקי' },
      { time: '12:00', text: '💧 לגונת ווואליגמני — אגם מלוחים טבעי ייחודי, 2 דקות הליכה' },
      { time: '15:00', text: '🛍️ נסיעה לגליפדה (10 דקות) — קניות בוטיקים, Miami vibes' },
      { time: '19:00', text: '🦐 ארוחת דגים טריים על שפת הים — Balux Cafe או פסאראקיה מקומי' },
    ],
    links: [
      { url: 'https://www.baluxcafe.com', label: '🍽️ Balux Cafe — הזמנת מקום' },
      { url: 'https://www.vouliagmeni-lake.gr', label: '💧 לגונת ווואליגמני' },
    ],
    tip: 'הזמינו שולחן ב-Balux מראש לשבת/ראשון — מתמלא מהר!',
  },
  {
    date: '30 מרץ', isoDate: '2026-03-30', day: 'שני', hotel: 'Somewhere → MONO', hotelColor: '#8B5CF6', emoji: '🚢',
    title: 'בוקר בחוף → פיראוס → פסירי',
    items: [
      { time: '9:00', text: '☕ בוקר אחרון בווואליגמני — שחייה אחרונה, קפה על הים' },
      { time: '11:00', text: '🚢 פיראוס — ביקור בספינת המלחמה האגדית Averof מ-1911 (מוזיאון צף!)' },
      { time: '14:00', text: '🏨 צ\'ק-אין MONO Lofts בפסירי — הכירו את השכונה הכי cool באתונה' },
      { time: '15:30', text: '🎨 סיור גרפיטי ואמנות רחוב בפסירי — Aiolou St, כיכר אביסינייס' },
      { time: '20:00', text: '🍻 ארוחה ראשונה בפסירי — טברנה מקומית עם מוזיקה חיה' },
    ],
    links: [
      { url: 'https://www.averof.mil.gr', label: '⚓ ספינת Averof — מוזיאון' },
      { url: 'https://www.alternativeathens.com/street-art-tour', label: '🎨 סיור גרפיטי' },
    ],
    tip: 'Diporto — מסעדה מ-1887 מתחת לאדמה ליד Varvakios. לא בגוגל, שאלו מקומיים!',
  },
  {
    date: '31 מרץ', isoDate: '2026-03-31', day: 'שלישי', hotel: 'MONO Lofts', hotelColor: '#10B981', emoji: '🔭',
    title: 'מדע, קסם ומוזיאונים',
    items: [
      { time: '9:00', text: '☕ קפה בוקר בכיכר פסירי — אחת הכיכרות הכי תוססות באתונה' },
      { time: '10:00', text: '🪞 מוזיאון האשליות — חדר הפוך, מנהרת סחרחרת, אשליות אופטיות. סלפי חובה!' },
      { time: '12:30', text: '⚙️ Kotsanas — מוזיאון הטכנולוגיה היוונית. מחשב אנלוגי מ-100 לפנה"ס!' },
      { time: '15:00', text: '🌟 פלנטריום Eugenides (אוטובוס 15 דקות) — סרטי IMAX תחת כיפת כוכבים' },
      { time: '20:00', text: '🎬 קולנוע פתוח תחת הכוכבים עם נוף לאקרופוליס — Athens Voice' },
    ],
    links: [
      { url: 'https://www.museumofillusions.gr', label: '🪞 מוזיאון האשליות' },
      { url: 'https://kotsanas.com', label: '⚙️ Kotsanas' },
      { url: 'https://www.eugenidesplanetarium.gr', label: '🌟 פלנטריום Eugenides' },
    ],
    tip: 'ילדים בגיל 10–14 מתים על מוזיאון האשליות — תאריכים מראש!',
  },
  {
    date: '1 אפריל', isoDate: '2026-04-01', day: 'רביעי', hotel: 'MONO Lofts', hotelColor: '#10B981', emoji: '⚡',
    title: 'ספורט ואדרנלין',
    items: [
      { time: '9:00', text: '🏟️ האצטדיון הפנאתנאיקי 1896 — ריצה על מסלול השיש, מוזיאון אולימפי' },
      { time: '12:00', text: '🌲 Adventure Park מלאקסה (40 דקות) — zip-line, טיפוס עצים, קשתות' },
      { time: '16:30', text: '🛍️ חזרה לפסירי — קניות אחרונות בקולונקי ובאקסרכיה' },
      { time: '20:00', text: '🍷 Kuzina על הגג עם נוף לאקרופוליס — ארוחת ערב חגיגית (הזמינו מראש!)' },
    ],
    links: [
      { url: 'https://www.panathenaic-stadium.gr', label: '🏟️ האצטדיון הפנאתנאיקי' },
      { url: 'https://www.adventurepark.gr', label: '🌲 Adventure Park' },
      { url: 'https://www.kuzina.gr', label: '🍽️ Kuzina — הזמנה' },
    ],
    tip: 'Kuzina חייבים להזמין מראש — אחד המקומות הכי אהובים באתונה!',
  },
  {
    date: '2 אפריל', isoDate: '2026-04-02', day: 'חמישי', hotel: 'MONO → טיסה', hotelColor: '#EF4444', emoji: '🛍️',
    title: 'קניות אחרונות + טיסה הביתה',
    items: [
      { time: '8:00', text: '🥐 ארוחת בוקר אחרונה בפסירי — ספנקופיטה וקפה פרפ\' בכיכר' },
      { time: '9:00', text: '👡 קולונקי — Ancient Greek Sandals, Korres, בוטיקים יווניים' },
      { time: '11:00', text: '🧳 צ\'ק-אאוט MONO Lofts, אחסון מזוודות, שוטטות אחרונה' },
      { time: '12:00', text: '🕐 יציאה לשדה — מטרו M3 (40 דקות) | Tax Free על קניות מעל 50€!' },
      { time: '10:31', text: '🛫 המראה — טיסה LY7544 לתל אביב, נחיתה 11:32 ✈️ להתראות אתונה!' },
    ],
    links: [
      { url: 'https://www.ancient-greek-sandals.com', label: '👡 Ancient Greek Sandals' },
      { url: 'https://www.korres.com', label: '🌿 Korres — קוסמטיקה' },
    ],
    tip: 'שמרו קבלות מעל 50€ — ניתן להחזר מע"מ Tax Free בשדה!',
  },
]

const FOOD_SPOTS = [
  { name: 'O Kostas', type: 'סואבלקי', area: 'מונסטירקי', price: '€2–4', emoji: '🥙', desc: 'סואבלקי אגדי מ-1950, ממש ליד מונסטירקי. תור קצר — שווה כל שנייה', must: true },
  { name: 'Bairaktaris', type: 'גריל יווני', area: 'מונסטירקי', price: '€12–18', emoji: '🔥', desc: 'טברנה ותיקה עם גריל מסורתי בכיכר מונסטירקי עצמה', must: false },
  { name: 'Kuzina', type: 'מסעדת גג', area: 'פסירי', price: '€20–30', emoji: '🍷', desc: 'על גג עם נוף ישיר לאקרופוליס — הזמינו מראש!', must: true },
  { name: 'Balux Cafe Glyfada', type: 'דגים / חוף', area: 'גליפדה', price: '€20–35', emoji: '🐟', desc: 'ביצ\'ית עם רגליים בחול, דגים טריים, נוף לים', must: true },
  { name: 'Diporto', type: 'ביתית', area: 'ליד Varvakios', price: '€10–15', emoji: '🏛️', desc: 'מסעדה מ-1887 מתחת לאדמה. לא בגוגל — שאלו מקומיים! גורמה מחתרת', must: true },
  { name: 'To Steki tou Ilia', type: 'בשרים', area: 'קולונקי', price: '€15–22', emoji: '🥩', desc: 'עצמות טלה מסורתיות — חייבים לנסות', must: false },
]

const SHOPPING = [
  { area: 'רחוב ארמו', desc: 'Zara, Nike, H&M, Sephora, Foot Locker, Flying Tiger', dist: '5 דקות', tag: 'הייסטריט' },
  { area: 'קולונקי', desc: 'Ancient Greek Sandals, Korres, Folli Follie, בוטיקים יווניים', dist: '20 דקות', tag: 'מקומי ויוקרתי' },
  { area: 'אקסרכיה', desc: "Yesterday's Bread — וינטג' מפריז. ספרים, רקורדס, cool", dist: '15 דקות', tag: 'הכי cool' },
  { area: 'שוק מונסטירקי', desc: 'אנטיקים, תכשיטים, סובניר, עיצוב — ראשי בשבת ובראשון!', dist: '2 דקות', tag: 'שוק' },
  { area: 'גליפדה', desc: 'בוטיקים חוף, Miami vibes, מותגים', dist: '20 דקות נסיעה', tag: 'ים + קניות' },
]

const QUICK_LINKS = [
  { url: 'https://etickets.tap.gr', label: '🎟️ כרטיסי אקרופוליס', desc: 'הזמנה רשמית — קנו מראש' },
  { url: 'https://www.hellenicseaways.gr', label: '⛴️ מעבורות לאיים', desc: 'לוחות זמנים ועלויות' },
  { url: 'https://www.athensvoice.gr', label: '📅 Athens Voice', desc: 'אירועים ומה קורה הערב' },
  { url: 'https://www.alternativeathens.com', label: '🗺️ Alternative Athens', desc: 'סיורים מקוריים' },
  { url: 'https://athensforkids.com', label: '👶 Athens For Kids', desc: 'סיורים לילדים' },
  { url: 'https://www.visitgreece.gr', label: '🇬🇷 Visit Greece', desc: 'המדריך הרשמי' },
]

// ── Types ──────────────────────────────────────────────────────────────────
interface WeatherDay { date: string; min: number; max: number; rain: number; code: number }
interface WeatherData {
  current: { temp: number; rain: number; code: number }
  forecast5: WeatherDay[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: AIAction[]
  suggested_event?: {
    title: string; date: string; start_time?: string; end_time?: string
    location?: string; notes?: string; person?: string
  }
}

// ── WeatherStrip ────────────────────────────────────────────────────────────
function WeatherStrip({ data }: { data: WeatherData }) {
  return (
    <div className="px-4 pb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{weatherIcon(data.current.code)}</span>
        <span className="text-white font-black text-xl">{Math.round(data.current.temp)}°</span>
        {data.current.rain > 20 && (
          <span className="text-sky-300 text-sm font-bold">💧{data.current.rain}%</span>
        )}
        <span className="text-white/35 text-xs ml-1">אתונה עכשיו</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(data.forecast5 || []).map((d, i) => {
          const dt = d.date ? new Date(d.date + 'T12:00:00') : new Date()
          const dayName = DAYS_HE[dt.getDay()]
          const monthDay = `${dt.getDate()} ${MONTHS_HE[dt.getMonth()]}`
          return (
            <div key={i}
              className="flex-shrink-0 flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 min-w-[58px]"
              style={{
                background: i === 0 ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.07)',
                border: i === 0 ? '1.5px solid rgba(59,130,246,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
              }}>
              <span className="text-[10px] font-bold text-white/50">{dayName}</span>
              <span className="text-[10px] text-white/35">{monthDay}</span>
              <span className="text-lg leading-none">{weatherIcon(d.code)}</span>
              <span className="text-xs font-black text-white tabular-nums">{Math.round(d.min)}°–{Math.round(d.max)}°</span>
              {d.rain > 20 && <span className="text-[9px] text-sky-300 font-bold">💧{d.rain}%</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── HotelCard ───────────────────────────────────────────────────────────────
function HotelCard({ h }: { h: typeof HOTELS[0] }) {
  return (
    <a href={h.url} target="_blank" rel="noopener noreferrer"
      className="block rounded-2xl p-4 transition-all active:scale-[0.98]"
      style={{ background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${h.color}40` }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xl mb-1">{h.emoji}</div>
          <div className="font-black text-base text-white leading-tight">{h.name}</div>
          <div className="text-xs text-white/50 mt-0.5">{h.dates} · {h.nights}</div>
        </div>
        <div className="shrink-0">
          <div className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{ background: h.color + '99' }}>
            {h.rating}
          </div>
        </div>
      </div>
      <div className="text-xs text-white/55 mb-2">📍 {h.address}</div>
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <code className="text-xs px-2 py-0.5 rounded text-white/75 font-mono" style={{ background: 'rgba(255,255,255,0.08)' }}>#{h.booking}</code>
        <span className="text-xs text-white/35">{h.phone}</span>
      </div>
      <div className="space-y-1">
        {h.highlights.map((hi, i) => (
          <div key={i} className="text-xs text-white/70 flex items-start gap-1.5">
            <span className="shrink-0 mt-0.5" style={{ color: h.color }}>✓</span>{hi}
          </div>
        ))}
      </div>
    </a>
  )
}

// ── AddItemRow ───────────────────────────────────────────────────────────────
function AddItemRow({ color, onAdd }: { color: string; onAdd: (item: DayItem) => void }) {
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState('')
  const [text, setText] = useState('')
  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full text-right text-[11px] font-bold py-1.5 px-2 rounded-xl transition"
      style={{ color: color + 'aa', background: color + '12', border: `1px dashed ${color}35` }}>
      + הוסף פעילות
    </button>
  )
  return (
    <div className="flex gap-2 items-center mt-1" dir="rtl">
      <input value={time} onChange={e => setTime(e.target.value)} placeholder="09:00"
        className="w-14 text-xs rounded-lg px-2 py-1.5 text-white text-right focus:outline-none"
        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }} />
      <input value={text} onChange={e => setText(e.target.value)} placeholder="תיאור הפעילות..."
        className="flex-1 text-xs rounded-lg px-2 py-1.5 text-white text-right focus:outline-none"
        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onAdd({ time: time || '?', text }); setTime(''); setText(''); setOpen(false) } }} />
      <button onClick={() => { if (text.trim()) { onAdd({ time: time || '?', text }); setTime(''); setText(''); setOpen(false) } }}
        className="text-xs px-3 py-1.5 rounded-lg font-black transition active:scale-95"
        style={{ background: color + '30', border: `1px solid ${color}50`, color }}>
        ✓
      </button>
      <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white text-xs px-1 transition">✕</button>
    </div>
  )
}

// ── DayCard ─────────────────────────────────────────────────────────────────
function DayCard({ d, isOpen, onToggle, onRemoveItem, onAddItem }: {
  d: DayData; isOpen: boolean; onToggle: () => void;
  onRemoveItem?: (itemIndex: number) => void;
  onAddItem?: (item: DayItem) => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ border: `1.5px solid ${isOpen ? d.hotelColor + '60' : 'rgba(255,255,255,0.1)'}` }}>
      <button onClick={onToggle}
        className="w-full text-right px-4 py-3.5 flex items-center justify-between gap-3 transition-all"
        style={{ background: isOpen ? d.hotelColor + '20' : 'rgba(255,255,255,0.04)' }}>
        <span className={`text-white/40 text-lg transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>›</span>
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-2 mb-0.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white/70"
              style={{ background: d.hotelColor + '35' }}>{d.hotel}</span>
          </div>
          <div className="font-black text-sm text-white leading-tight">
            {d.emoji} {d.day} {d.date} — {d.title}
          </div>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 py-4 space-y-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {d.items.map((item, i) => (
            <div key={i} className="flex gap-2 items-start group">
              <span className="text-[11px] font-black shrink-0 pt-0.5 w-10 text-right tabular-nums"
                style={{ color: d.hotelColor }}>{item.time}</span>
              <span className="text-sm text-white/80 flex-1 leading-relaxed">{item.text}</span>
              {onRemoveItem && (
                <button onClick={() => onRemoveItem(i)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition text-xs px-1 py-0.5 rounded"
                  title="הסר פעילות">
                  ✕
                </button>
              )}
            </div>
          ))}
          {onAddItem && (
            <AddItemRow color={d.hotelColor} onAdd={onAddItem} />
          )}
          {d.tip && (
            <div className="mt-3 pt-3 text-xs text-amber-300/80 flex items-start gap-1.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span>💡</span><span>{d.tip}</span>
            </div>
          )}
          {d.links.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {d.links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 rounded-full font-medium transition-all active:scale-95"
                  style={{ background: d.hotelColor + '25', border: `1px solid ${d.hotelColor}50`, color: d.hotelColor }}>
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── AthensAI ────────────────────────────────────────────────────────────────
function AthensAI({ onAction, days }: {
  onAction: (actions: AIAction[]) => void;
  days: DayData[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'שלום! 🏛️ אני העוזר החכם שלכם לטיול באתונה. אני מכיר את כל פרטי הטיול — מלונות, תוכנית הימים, מסעדות, קניות, טיסות ופרטי הסעה. שאלו אותי כל דבר, או הגידו "הוסף לתוכנית" כדי לשמור אירוע בלוח הזמנים המשפחתי! 🇬🇷' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedEvents, setSavedEvents] = useState<Set<number>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/athens-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history }),
      })
      if (res.ok) {
        const data = await res.json()
        const newMsg = {
          role: 'assistant' as const,
          content: data.response,
          suggested_event: data.suggested_event || undefined,
          actions: data.actions?.length ? data.actions : undefined,
        }
        setMessages(prev => [...prev, newMsg])
        if (data.actions?.length) {
          onAction(data.actions)
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'מצטער, הייתה שגיאה. נסי שוב! 😅' }])
      }
    } finally { setLoading(false) }
  }, [input, loading, messages])

  const saveEvent = async (ev: NonNullable<ChatMessage['suggested_event']>, idx: number) => {
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ev.title, date: ev.date,
          start_time: ev.start_time || null, end_time: ev.end_time || null,
          location: ev.location || null,
          notes: (ev.notes ? ev.notes + ' ' : '') + '[אתונה 2026]',
          person: ev.person || 'family',
        }),
      })
      if (res.ok) setSavedEvents(prev => new Set([...prev, idx]))
    } catch { /* ignore */ }
  }

  const SUGGESTIONS = [
    'מה הכי כדאי לעשות ביום ראשון?',
    'פתח את יום 27 מרץ והוסף ביקור במוזיאון האשליות אחרי הצהריים',
    'הסר את ביקור האגורה מיום שישי ועדכן את הטיפ',
    'הוסף ארוחת ערב ב-Kuzina ביום 1 אפריל ב-20:00 ללוח',
    'קח אותי ללשונית המסעדות',
    'כמה זמן לוקח להגיע מהמלון לאקרופוליס?',
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-white/35 text-right px-1">
        שאלו על אתונה, בקשו המלצות, או הגידו &quot;הוסף לתוכנית&quot; כדי לשמור אירוע בלוח המשפחתי
      </div>
      {/* Quick suggestion chips */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => { setInput(s) }}
              className="text-xs px-3 py-1.5 rounded-full transition active:scale-95 text-right"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
              {s}
            </button>
          ))}
        </div>
      )}
      {/* Messages */}
      <div className="space-y-3 max-h-[45vh] overflow-y-auto pb-1 pr-0.5">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col gap-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className="max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                background: m.role === 'user'
                  ? 'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(99,102,241,0.3))'
                  : 'rgba(255,255,255,0.08)',
                border: m.role === 'user'
                  ? '1.5px solid rgba(99,102,241,0.35)'
                  : '1.5px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.88)',
              }}>
              {m.content}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="flex flex-wrap gap-1 max-w-[88%]">
                {m.actions.map((a, ai) => {
                  const labels: Record<string, string> = {
                    navigate_tab: '🔀 ניווט ללשונית',
                    open_day: '📅 פתח יום',
                    add_day_item: '➕ הוספת פעילות',
                    remove_day_item: '🗑️ הסרת פעילות',
                    update_day_tip: '💡 עדכון טיפ',
                    scroll_to_top: '⬆️ גלול לראש',
                  }
                  return (
                    <span key={ai} className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc' }}>
                      {labels[a.type] || a.type}
                    </span>
                  )
                })}
              </div>
            )}
            {m.suggested_event && (
              <div className="max-w-[88%] px-3 py-2.5 rounded-2xl text-xs"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.3)' }}>
                <div className="text-emerald-300 font-black mb-1.5">📅 אירוע מוצע ללוח המשפחתי</div>
                <div className="text-white/80 space-y-0.5 text-right">
                  <div>📌 <strong>{m.suggested_event.title}</strong></div>
                  {m.suggested_event.date && <div>🗓️ {m.suggested_event.date}</div>}
                  {m.suggested_event.start_time && (
                    <div>⏰ {m.suggested_event.start_time}{m.suggested_event.end_time ? `–${m.suggested_event.end_time}` : ''}</div>
                  )}
                  {m.suggested_event.location && <div>📍 {m.suggested_event.location}</div>}
                  {m.suggested_event.person && <div>👤 {m.suggested_event.person}</div>}
                </div>
                <button
                  onClick={() => saveEvent(m.suggested_event!, i)}
                  disabled={savedEvents.has(i)}
                  className="mt-2.5 w-full py-2 rounded-xl font-black text-xs transition active:scale-95 disabled:opacity-60"
                  style={{
                    background: savedEvents.has(i) ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.3)',
                    border: '1px solid rgba(16,185,129,0.5)',
                    color: '#6ee7b7',
                  }}>
                  {savedEvents.has(i) ? '✅ נשמר בלוח המשפחתי!' : '➕ הוסף ללוח הזמנים המשפחתי'}
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="px-4 py-3 rounded-2xl text-sm"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.1)' }}>
              <span className="text-white/40">חושב על תשובה</span>
              <span className="text-white/25 animate-pulse"> ...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="שאלו על אתונה, בקשו המלצות, הוסיפו אירוע..."
          rows={2}
          dir="rtl"
          className="flex-1 rounded-2xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)' }}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="h-14 px-5 rounded-2xl flex items-center justify-center gap-2 font-black text-base transition active:scale-90 disabled:opacity-40 shrink-0"
          style={{ background: 'linear-gradient(135deg,#1565C0,#0D47A1)', boxShadow: '0 4px 16px rgba(13,71,161,0.55)', border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff', minWidth: 80 }}>
          {loading ? <span className="text-sm animate-pulse">...</span> : <><span className="text-lg">🏛️</span><span>שלח</span></>}
        </button>
      </div>
    </div>
  )
}

// ── Tutorial overlay ────────────────────────────────────────────────────────
const SLIDES = [
  {
    step: 1, emoji: '🏠', title: 'כניסה לאפליקציה',
    desc: 'פתחו את allonys.com — תראו את מסך הבחירה. לחצו על כרטיס אתונה כדי להיכנס.',
    screen: (
      <div className="flex flex-col gap-2 p-3 h-full justify-center">
        <div className="text-center mb-2"><div className="text-3xl">👨‍👩‍👧‍👦</div><div className="text-white text-xs font-black mt-1">משפחת אלוני</div></div>
        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="flex items-center gap-2"><div className="text-2xl">📅</div><div><div className="text-white text-xs font-black">לוח זמנים משפחתי</div><div className="text-white/40 text-[9px]">אירועים, תזכורות, ילדים</div></div></div>
        </div>
        <div className="rounded-2xl p-3 animate-pulse" style={{ background: 'linear-gradient(135deg,rgba(21,101,192,0.5),rgba(13,71,161,0.4))', border: '2px solid rgba(59,130,246,0.7)', boxShadow: '0 0 18px rgba(59,130,246,0.5)' }}>
          <div className="flex items-center gap-2"><div className="text-2xl">🏛️</div><div><div className="text-white text-xs font-black">טיול אתונה</div><div className="text-white/60 text-[9px]">8 ימים · 3 מלונות · AI</div></div></div>
          <div className="mt-1.5 flex gap-0.5 h-0.5 rounded-full overflow-hidden"><div className="flex-1 bg-blue-600"/><div className="flex-1 bg-white/70"/><div className="flex-1 bg-blue-600"/><div className="flex-1 bg-white/70"/><div className="flex-1 bg-blue-600"/></div>
        </div>
        <div className="text-center mt-1"><div className="text-[9px] text-amber-300 font-black animate-bounce">← לחצו כאן</div></div>
      </div>
    ),
  },
  {
    step: 2, emoji: '🌤️', title: 'מזג האוויר באתונה',
    desc: 'בראש הדף תמצאו את מזג האוויר הנוכחי ותחזית ל-5 ימים קדימה, מעודכן בזמן אמת.',
    screen: (
      <div className="flex flex-col gap-1.5 p-3 h-full">
        <div className="flex items-center gap-1.5 mb-1"><span className="text-xl">☀️</span><span className="text-white font-black text-lg">22°</span><span className="text-white/40 text-[9px] mr-1">אתונה עכשיו</span></div>
        <div className="flex gap-1">
          {['ד׳','ה׳','ו׳','ש׳','א׳'].map((d,i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 rounded-xl py-1.5" style={{ background: i===0?'rgba(59,130,246,0.3)':'rgba(255,255,255,0.07)', border: i===0?'1.5px solid rgba(59,130,246,0.6)':'1px solid rgba(255,255,255,0.1)', boxShadow: i===0?'0 0 10px rgba(59,130,246,0.4)':'' }}>
              <span className="text-[8px] text-white/50">{d}</span>
              <span className="text-sm">{['☀️','🌤️','⛅','☀️','☀️'][i]}</span>
              <span className="text-[9px] text-white font-black">{['20-24','18-23','17-22','19-25','21-26'][i]}°</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-2 mt-1" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="text-[8px] text-blue-300 font-black mb-1">✈️ פרטי טיסה + הסעה</div>
          <div className="text-[8px] text-white/60">🛫 LY543 · 14:00 ת"א → 16:15 אתונה</div>
          <div className="text-[8px] text-white/60">🚐 הסעה #184353 · 17:00 · €82 ✅</div>
        </div>
      </div>
    ),
  },
  {
    step: 3, emoji: '📅', title: 'תוכנית 8 ימים',
    desc: 'לחצו על כרטיס יום כלשהו לפתוח אותו — תראו את כל הפעילויות עם שעות, טיפים ולינקים.',
    screen: (
      <div className="flex flex-col gap-1.5 p-3 h-full">
        <div className="text-[9px] text-white/40 mb-1 text-right">📅 ימים</div>
        {[
          { d: '26 מרץ', t: 'הגעה — טיסה + סינטגמה', c: '#3B82F6', open: false },
          { d: '27 מרץ', t: 'האקרופוליס ולב ההיסטוריה', c: '#3B82F6', open: true },
          { d: '28 מרץ', t: 'שוק פשפשים → ריביירה', c: '#8B5CF6', open: false },
        ].map((item, i) => (
          <div key={i} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${item.open ? item.c+'70' : 'rgba(255,255,255,0.1)'}`, boxShadow: item.open ? `0 0 12px ${item.c}40` : '' }}>
            <div className="px-2.5 py-2 flex items-center justify-between" style={{ background: item.open ? item.c+'25' : 'rgba(255,255,255,0.04)' }}>
              <span className="text-white/40 text-sm">{item.open ? '↓' : '›'}</span>
              <div className="text-right"><div className="text-[8px] text-white/50">{item.d}</div><div className="text-[9px] font-black text-white">{item.t}</div></div>
            </div>
            {item.open && (
              <div className="px-2.5 py-2 space-y-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
                {[['8:00','🌅 יציאה לאקרופוליס לפני ההמון'],['11:00','🏺 מוזיאון האקרופוליס'],['16:00','🚶 פלאקה — גלידה וסמטאות']].map(([t,tx],j)=>(
                  <div key={j} className="flex gap-2"><span className="text-[8px] font-black w-8 text-right shrink-0" style={{color:item.c}}>{t}</span><span className="text-[8px] text-white/70">{tx}</span></div>
                ))}
                <div className="text-[8px] text-amber-300/70 mt-1 pt-1 border-t border-white/5">💡 צאו לפני 8:30 — פחות תיירים!</div>
              </div>
            )}
          </div>
        ))}
      </div>
    ),
  },
  {
    step: 4, emoji: '🏨', title: 'כרטיסי מלונות',
    desc: 'לשונית "מלונות" מציגה את 3 המלונות עם מספרי הזמנה, טלפון, דירוג, וכל הפרטים בלחיצה אחת.',
    screen: (
      <div className="flex flex-col gap-2 p-3 h-full">
        <div className="text-[9px] text-white/40 mb-0.5 text-right">🏨 מלונות</div>
        {[
          { n: 'NYX Esperia', d: '26–28 מרץ', c: '#3B82F6', e: '🏙️', b: '6198749745', r: '4.4 ⭐' },
          { n: 'Somewhere Vouliagmeni', d: '28–30 מרץ', c: '#06B6D4', e: '🌊', b: '6158400949', r: '4.8 ⭐' },
          { n: 'MONO Lofts', d: '30 מרץ–2 אפריל', c: '#10B981', e: '🏘️', b: '5870464642', r: '4.2 ⭐' },
        ].map((h, i) => (
          <div key={i} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${h.c}40` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: h.c+'99', fontSize: 9 }}>{h.r}</div>
              <div className="flex items-center gap-1"><span className="text-base">{h.e}</span><div className="text-right"><div className="text-[9px] font-black text-white">{h.n}</div><div className="text-[8px] text-white/40">{h.d}</div></div></div>
            </div>
            <div className="text-[8px] text-white/40 font-mono">#{h.b}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    step: 5, emoji: '🍽️', title: 'מסעדות וקניות',
    desc: 'לשוניות "אוכל" ו"קניות" נותנות המלצות ממוינות עם מחירים, ולינקים לכל המקומות.',
    screen: (
      <div className="flex flex-col gap-2 p-3 h-full">
        <div className="flex gap-1 mb-1">
          {['📅','🏨','🍽️','🛍️','🤖'].map((t,i) => (
            <div key={i} className="flex-1 text-center py-1 rounded-xl text-sm transition"
              style={{ background: i===2?'#fff':i===3?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.06)', color: i===2?'#050e1e':i===3?'#fff':'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: i===2||i===3?900:400, boxShadow: i===2?'0 2px 8px rgba(255,255,255,0.2)':'' }}>
              {t}
            </div>
          ))}
        </div>
        {[
          { n: 'O Kostas', t: 'סואבלקי', p: '€2–4', e: '🥙', must: true },
          { n: 'Kuzina', t: 'גג + נוף', p: '€20–30', e: '🍷', must: true },
          { n: 'Balux Cafe', t: 'דגים/חוף', p: '€20–35', e: '🐟', must: true },
        ].map((f, i) => (
          <div key={i} className="rounded-xl p-2" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1"><span className="text-sm">{f.e}</span><div><div className="text-[9px] font-black text-white">{f.n}</div><div className="text-[8px] text-white/40">{f.t}</div></div></div>
              <div className="flex flex-col items-end gap-0.5"><span className="text-[8px] text-white/50">{f.p}</span><span className="text-[7px] font-black px-1 py-0.5 rounded-full" style={{background:'rgba(245,158,11,0.2)',color:'#fbbf24'}}>חובה!</span></div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    step: 6, emoji: '🤖', title: 'AI אסיסטנט אתונה',
    desc: 'לחצו על 🤖 AI ושאלו כל שאלה על הטיול — מסעדות, מסלולים, מזג אוויר, עצות. ה-AI מכיר את כל פרטי הטיול.',
    screen: (
      <div className="flex flex-col gap-2 p-3 h-full">
        <div className="text-[8px] text-white/35 text-right mb-1">🤖 AI אסיסטנט</div>
        <div className="flex flex-wrap gap-1 mb-1">
          {['מה לעשות ביום ראשון?','איפה לאכול עם ילדים?'].map((s,i)=>(
            <div key={i} className="text-[8px] px-2 py-1 rounded-full" style={{background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.3)',color:'#93c5fd'}}>{s}</div>
          ))}
        </div>
        <div className="flex items-start"><div className="max-w-[80%] px-2.5 py-2 rounded-2xl text-[8px] leading-relaxed text-white/85" style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.1)'}}>שלום! 🏛️ אני מכיר את כל פרטי הטיול — מלונות, ימים, טיסות ועוד. שאלו אותי כל דבר!</div></div>
        <div className="flex items-end justify-end"><div className="max-w-[75%] px-2.5 py-2 rounded-2xl text-[8px] text-white/85 animate-pulse" style={{background:'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(99,102,241,0.3))',border:'1px solid rgba(99,102,241,0.35)'}}>איפה הכי טוב לאכול ביום הראשון?</div></div>
        <div className="flex items-start mt-auto"><div className="max-w-[80%] px-2.5 py-2 rounded-2xl text-[8px] leading-relaxed text-white/85" style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.1)'}}>ביום הראשון אני ממליץ לעלות לגג NYX עם נוף לאקרופוליס, ואחר כך ל-O Kostas לסואבלקי הכי טעים! 🥙</div></div>
      </div>
    ),
  },
  {
    step: 7, emoji: '➕', title: 'הוספת אירוע ללוח',
    desc: 'בקשו מה-AI להוסיף פעילות — הוא יציג כרטיס אירוע מוצע. לחצו "הוסף ללוח המשפחתי" ונשמר אוטומטית!',
    screen: (
      <div className="flex flex-col gap-2 p-3 h-full">
        <div className="flex items-end justify-end"><div className="max-w-[80%] px-2.5 py-2 rounded-2xl text-[8px] text-white/85" style={{background:'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(99,102,241,0.3))',border:'1px solid rgba(99,102,241,0.35)'}}>הוסף ביקור באקרופוליס ב-27 מרץ בשעה 9:00</div></div>
        <div className="flex items-start"><div className="w-full px-2.5 py-2 rounded-2xl text-[8px] leading-relaxed text-white/85" style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.1)'}}>בשמחה! הכנתי אירוע לאקרופוליס 🏛️</div></div>
        <div className="rounded-xl p-2.5 animate-pulse" style={{background:'rgba(16,185,129,0.12)',border:'1.5px solid rgba(16,185,129,0.45)',boxShadow:'0 0 12px rgba(16,185,129,0.3)'}}>
          <div className="text-emerald-300 font-black text-[9px] mb-1.5">📅 אירוע מוצע</div>
          <div className="space-y-0.5 text-[8px] text-white/80">
            <div>📌 <strong>ביקור באקרופוליס</strong></div>
            <div>🗓️ 2026-03-27</div>
            <div>⏰ 09:00–12:00</div>
            <div>📍 האקרופוליס, אתונה</div>
          </div>
          <div className="mt-2 w-full py-1.5 rounded-lg text-center text-[9px] font-black" style={{background:'rgba(16,185,129,0.35)',border:'1px solid rgba(16,185,129,0.6)',color:'#6ee7b7',boxShadow:'0 0 8px rgba(16,185,129,0.4)'}}>
            ➕ הוסף ללוח הזמנים המשפחתי
          </div>
        </div>
        <div className="text-center text-[8px] text-emerald-400 font-black animate-bounce">← לחצו כאן לשמירה!</div>
      </div>
    ),
  },
]

function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [slide, setSlide] = useState(0)
  const total = SLIDES.length
  const cur = SLIDES[slide]
  const isLast = slide === total - 1

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}>

      {/* Close */}
      <button onClick={onClose}
        className="absolute top-5 left-4 text-white/40 hover:text-white text-sm px-3 py-1.5 rounded-2xl transition"
        style={{ background: 'rgba(255,255,255,0.07)' }}>
        ✕ סגור
      </button>

      {/* Step label */}
      <div className="text-white/30 text-xs font-bold mb-3">{slide + 1} / {total}</div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.12)' }}>

        {/* Phone mockup */}
        <div className="mx-auto mt-5 mb-0" style={{ width: 180 }}>
          <div className="rounded-[24px] overflow-hidden mx-auto"
            style={{ background: 'linear-gradient(160deg,#060f1f,#091525)', border: '2px solid rgba(255,255,255,0.15)', height: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', position: 'relative' }}>
            {/* Notch */}
            <div className="mx-auto mt-1.5 w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
            {/* Content */}
            <div style={{ height: 'calc(100% - 16px)', overflow: 'hidden' }}>
              {cur.screen}
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="px-6 py-5 text-center">
          <div className="text-3xl mb-2">{cur.emoji}</div>
          <div className="text-white font-black text-lg mb-2">{cur.title}</div>
          <p className="text-white/55 text-sm leading-relaxed">{cur.desc}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-4">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)}
              className="rounded-full transition-all"
              style={{ width: i === slide ? 20 : 6, height: 6, background: i === slide ? '#3B82F6' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-2 px-5 pb-5">
          {slide > 0 && (
            <button onClick={() => setSlide(s => s - 1)}
              className="flex-1 py-3 rounded-2xl text-sm font-bold transition active:scale-95 text-white/60"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              ‹ הקודם
            </button>
          )}
          <button
            onClick={() => isLast ? onClose() : setSlide(s => s + 1)}
            className="flex-1 py-3 rounded-2xl text-sm font-black transition active:scale-95 text-white"
            style={{ background: isLast ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#1565C0,#0D47A1)', boxShadow: '0 4px 14px rgba(21,101,192,0.4)' }}>
            {isLast ? '✅ הבנתי, בואו נתחיל!' : 'הבא ›'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AthensPage() {
  const [tab, setTab] = useState<'days' | 'hotels' | 'food' | 'shopping' | 'ai'>('days')
  const [openDay, setOpenDay] = useState<number | null>(0)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [days, setDays] = useState<DayData[]>(DAYS as unknown as DayData[])
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleAIActions = useCallback((actions: AIAction[]) => {
    for (const action of actions) {
      if (action.type === 'navigate_tab') {
        setTab(action.tab)
        showToast(`🔀 עברת ללשונית ${action.tab === 'days' ? 'ימים' : action.tab === 'hotels' ? 'מלונות' : action.tab === 'food' ? 'אוכל' : 'קניות'}`)
      } else if (action.type === 'open_day') {
        setTab('days')
        setOpenDay(action.day_index)
        showToast(`📅 נפתח יום ${action.day_index + 1}`)
      } else if (action.type === 'add_day_item') {
        const idx = action.day_index
        if (idx >= 0 && idx < days.length) {
          setDays(prev => prev.map((d, i) => i === idx
            ? { ...d, items: [...d.items, action.item].sort((a, b) => a.time.localeCompare(b.time)) }
            : d
          ))
          setTab('days')
          setOpenDay(idx)
          showToast(`➕ נוספה פעילות ל-${days[idx]?.date || `יום ${idx + 1}`}`)
        }
      } else if (action.type === 'remove_day_item') {
        const idx = action.day_index
        if (idx >= 0 && idx < days.length) {
          setDays(prev => prev.map((d, i) => i === idx
            ? { ...d, items: d.items.filter((_, j) => j !== action.item_index) }
            : d
          ))
          showToast(`🗑️ הוסרה פעילות מיום ${idx + 1}`)
        }
      } else if (action.type === 'update_day_tip') {
        const idx = action.day_index
        if (idx >= 0 && idx < days.length) {
          setDays(prev => prev.map((d, i) => i === idx ? { ...d, tip: action.tip } : d))
          showToast(`💡 עודכן טיפ ליום ${idx + 1}`)
        }
      } else if (action.type === 'scroll_to_top') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }, [days, showToast])

  useEffect(() => {
    fetch(`/api/weather?lat=${ATHENS_LAT}&lon=${ATHENS_LON}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!d.error) setWeather(d) })
      .catch(() => {})
  }, [])

  const PAGE_TABS = [
    { key: 'days' as const, label: '📅 ימים' },
    { key: 'hotels' as const, label: '🏨 מלונות' },
    { key: 'food' as const, label: '🍽️ אוכל' },
    { key: 'shopping' as const, label: '🛍️ קניות' },
    { key: 'ai' as const, label: '🤖 AI' },
  ]

  return (
    <div className="min-h-screen" dir="rtl"
      style={{ background: 'linear-gradient(160deg,#050e1e 0%,#091629 40%,#040d1a 100%)' }}>

      {/* Tutorial overlay */}
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <Link href="/kids"
          className="flex items-center gap-1.5 text-white/45 hover:text-white text-xs font-bold px-3 py-2 rounded-2xl transition active:scale-95"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          ‹ חזרה
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-bold px-3 py-2 rounded-2xl transition active:scale-95"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            title="מדריך שימוש">
            ? מדריך
          </button>
          <a href="/athens-guide.pdf" download
            className="flex items-center gap-1.5 text-amber-300/75 text-xs font-bold px-3 py-2 rounded-2xl transition active:scale-95"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
            📥 PDF
          </a>
        </div>
      </div>

      {/* Title block */}
      <div className="text-center px-4 py-4">
        <div className="text-5xl mb-2">🏛️</div>
        <h1 className="text-2xl font-black text-white mb-1">אתונה 2026</h1>
        <p className="text-white/35 text-xs mb-3">26 מרץ – 2 אפריל · 3 מלונות · 5 מטיילים</p>
        <div className="flex justify-center gap-2 flex-wrap">
          {[
            { e: '✈️', t: 'LY543 — 14:00 ת"א' },
            { e: '🛬', t: 'LY7544 — 10:31 חזרה' },
            { e: '🚐', t: 'הסעה #184353 ✅' },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-white/65"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span>{c.e}</span><span>{c.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weather + AI mini-tile row */}
      <div className="px-4 pb-0">
        <div className="flex gap-3 items-start">
          {/* Weather takes up most of the space */}
          <div className="flex-1 min-w-0">
            {weather && <WeatherStrip data={weather} />}
          </div>
          {/* AI quick-access tile */}
          <button onClick={() => setTab('ai')}
            className="shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-3 transition active:scale-95"
            style={{
              background: 'linear-gradient(160deg,rgba(99,102,241,0.25),rgba(59,130,246,0.2))',
              border: '1.5px solid rgba(99,102,241,0.45)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
              width: 70,
              marginTop: 2,
            }}>
            <span className="text-2xl">🤖</span>
            <span className="text-[10px] font-black text-white/80">AI</span>
            <span className="text-[9px] text-indigo-300/70 leading-tight text-center">שאל<br/>אותי</span>
          </button>
        </div>
      </div>

      {/* Flight + Taxi info card */}
      <div className="mx-4 mb-4 rounded-2xl p-3.5" style={{ background: 'rgba(59,130,246,0.1)', border: '1.5px solid rgba(59,130,246,0.22)' }}>
        <div className="text-xs font-black text-blue-300 mb-2.5">✈️ פרטי טיסה + הסעה</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-white/70 mb-2.5">
          <div className="space-y-1">
            <div className="text-white/35 font-bold text-[10px]">הלוך</div>
            <div>🛫 LY543 | יציאה 14:00 ת"א</div>
            <div>🛬 16:15 אתונה Venizelos</div>
            <div className="text-white/35 text-[10px]">Economy · 1 מזוודה לאדם</div>
          </div>
          <div className="space-y-1">
            <div className="text-white/35 font-bold text-[10px]">חזרה</div>
            <div>🛫 LY7544 | 10:31 אתונה</div>
            <div>🛬 11:32 בן גוריון</div>
            <div className="text-white/35 text-[10px]">Economy Lite · ללא מזוודה</div>
          </div>
        </div>
        <div className="pt-2.5 text-xs text-white/60 flex items-start gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="shrink-0">🚐</span>
          <span>Athens Taxi Hub #184353 · מיניוואן ל-5 נוסעים · 7 מזוודות + 4 יד · יציאה 17:00 משדה → NYX · €82 שולם ✅</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="px-3 pb-3 flex gap-1.5 overflow-x-auto">
        {PAGE_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-2xl text-sm font-black whitespace-nowrap flex-shrink-0 transition-all active:scale-95"
            style={{
              background: tab === t.key ? '#fff' : 'rgba(255,255,255,0.07)',
              color: tab === t.key ? '#050e1e' : 'rgba(255,255,255,0.5)',
              border: tab === t.key ? 'none' : '1px solid rgba(255,255,255,0.1)',
              boxShadow: tab === t.key ? '0 4px 14px rgba(255,255,255,0.15)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Glow divider */}
      <div className="h-px mx-4 mb-4" style={{ background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.35) 30%,rgba(99,102,241,0.35) 70%,transparent)' }} />

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-24">

        {/* DAYS TAB */}
        {tab === 'days' && (
          <div className="space-y-2.5">
            <div className="flex gap-3 justify-end text-[10px] text-white/30 flex-wrap mb-2">
              {[{ c: '#3B82F6', l: 'NYX Esperia' }, { c: '#06B6D4', l: 'Somewhere' }, { c: '#10B981', l: 'MONO Lofts' }].map((h, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: h.c }} />{h.l}
                </div>
              ))}
            </div>
            {days.map((d, i) => (
              <DayCard
                key={i}
                d={d}
                isOpen={openDay === i}
                onToggle={() => setOpenDay(openDay === i ? null : i)}
                onRemoveItem={(itemIndex) => {
                  setDays(prev => prev.map((day, di) => di === i
                    ? { ...day, items: day.items.filter((_, j) => j !== itemIndex) }
                    : day
                  ))
                }}
                onAddItem={(item) => {
                  setDays(prev => prev.map((day, di) => di === i
                    ? { ...day, items: [...day.items, item].sort((a, b) => a.time.localeCompare(b.time)) }
                    : day
                  ))
                }}
              />
            ))}
          </div>
        )}

        {/* HOTELS TAB */}
        {tab === 'hotels' && (
          <div className="space-y-4">
            <div className="rounded-2xl px-4 py-3 text-xs text-blue-200/75"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
              💡 מתחילים במרכז → עוברים לחוף לסוף שבוע → חוזרים למרכז לשלושה ימים אחרונים. תכנון מושלם!
            </div>
            {HOTELS.map((h, i) => <HotelCard key={i} h={h} />)}
          </div>
        )}

        {/* FOOD TAB */}
        {tab === 'food' && (
          <div className="space-y-3">
            <div className="text-xs text-white/35 mb-1">🍽️ המסעדות הכי שוות לפי סוג ואזור</div>
            {FOOD_SPOTS.map((f, i) => (
              <div key={i} className="rounded-2xl p-3.5"
                style={{
                  background: f.must ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.05)',
                  border: f.must ? '1.5px solid rgba(245,158,11,0.22)' : '1.5px solid rgba(255,255,255,0.1)',
                }}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{f.emoji}</span>
                    <div>
                      <div className="font-black text-sm text-white">{f.name}</div>
                      <div className="text-[10px] text-white/40">{f.type} · {f.area}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-bold text-white/55">{f.price}</span>
                    {f.must && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>חובה!</span>}
                  </div>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
            <div className="rounded-2xl p-4 mt-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="font-black text-sm text-white mb-3">🇬🇷 חובה לנסות — קלאסיקות יווניות</div>
              {[
                { n: 'סואבלקי / גירוס', p: '€2–4', t: 'אוכל רחוב #1 — ילדים מתים על זה!' },
                { n: 'ספנקופיטה', p: '€2–3', t: 'ארוחת בוקר קלאסית בכל מאפייה' },
                { n: 'קפה פרפ\' / קפה זהב', p: '€3–5', t: 'קפה יווני קר — התמכרות מובטחת ☕' },
                { n: 'גלידה יוונית (גלוס)', p: '€2–4', t: 'בכל פינה, בכל שעה 🍦' },
                { n: 'יוגורט יווני + דבש', p: '€4–6', t: 'ארוחת בוקר מלכותית מקומית' },
              ].map((item, i) => (
                <div key={i} className="flex items-start justify-between py-1.5 gap-3"
                  style={{ borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div className="text-xs text-white/60 flex-1">{item.t}</div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-black text-white">{item.n}</div>
                    <div className="text-[10px] text-white/35">{item.p}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SHOPPING TAB */}
        {tab === 'shopping' && (
          <div className="space-y-3">
            <div className="text-xs text-white/35 mb-1">🛍️ לבני 10–14 — הכי רלוונטי</div>
            {SHOPPING.map((s, i) => (
              <div key={i} className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2 py-0.5 rounded-full text-white/70" style={{ background: 'rgba(255,255,255,0.1)' }}>{s.tag}</span>
                    <span className="text-[10px] text-white/30">📍 {s.dist}</span>
                  </div>
                  <div className="font-black text-sm text-white">{s.area}</div>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">{s.desc}</p>
              </div>
            ))}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.18)' }}>
              <div className="font-black text-sm text-emerald-300 mb-3">✨ מה שאסור להחמיץ</div>
              {[
                { n: 'Ancient Greek Sandals', d: 'סנדלי עור יווניים קלאסיים — מתנה מושלמת. בקולונקי.' },
                { n: 'Korres', d: 'קוסמטיקה יוונית טבעית — הרבה יותר זולה מחו"ל!' },
                { n: 'Folli Follie', d: 'תכשיטים יווניים מפורסמים — בכל הקניונים' },
                { n: "Yesterday's Bread", d: 'וינטג\' מפריז ואמסטרדם — גנבת לב אקסרכיה' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5"
                  style={{ borderBottom: i < 3 ? '1px solid rgba(16,185,129,0.1)' : 'none' }}>
                  <span className="text-emerald-400 shrink-0 mt-0.5">›</span>
                  <div>
                    <div className="text-xs font-black text-white">{item.n}</div>
                    <div className="text-[10px] text-white/45">{item.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="font-black text-sm text-white/75 mb-2">💡 טיפים לקניות</div>
              {[
                'משא ומתן מקובל בשוק — לא בחנויות רגילות',
                'שמרו קבלות מחנויות מעל 50€ — Tax Free בשדה התעופה!',
                'רוב חנויות הרחוב סגורות ביום ראשון — השוק פתוח!',
                'שוק פשפשים מונסטירקי הכי חי ביום שבת בבוקר',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-white/55 py-1">
                  <span className="text-amber-400 shrink-0">•</span>{tip}
                </div>
              ))}
            </div>
            <div>
              <div className="font-black text-sm text-white/65 mb-2">🔗 לינקים חיוניים</div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_LINKS.map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-2xl p-3 transition-all active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="text-xs font-bold text-white/80">{l.label}</div>
                    <div className="text-[10px] text-white/35 mt-0.5">{l.desc}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI TAB */}
        {tab === 'ai' && <AthensAI onAction={handleAIActions} days={days} />}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl text-sm font-black text-white shadow-2xl transition-all no-print"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.95),rgba(59,130,246,0.95))', border: '1.5px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
