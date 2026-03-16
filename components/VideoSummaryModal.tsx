'use client'

import { useState, useRef, useCallback } from 'react'
import { format, addDays } from 'date-fns'
import { he } from 'date-fns/locale'

interface FetchedEvent {
  id: string; title: string; person: string; date: string
  start_time: string | null; location: string | null
  is_recurring: boolean; recurrence_days: string[] | null
}

const PEOPLE_ORDER = ['ami', 'alex', 'itan', 'assaf', 'danil']
const DAY_KEYS     = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

const PERSON_COLORS: Record<string, [string, string]> = {
  ami:   ['#C2185B', '#F06292'],
  alex:  ['#6A1B9A', '#BA68C8'],
  itan:  ['#1B5E20', '#66BB6A'],
  assaf: ['#0D47A1', '#42A5F5'],
  danil: ['#004D40', '#4DB6AC'],
}
const PERSON_NAMES: Record<string, string> = {
  ami: 'אמי', alex: 'אלכס', itan: 'איתן', assaf: 'אסף', danil: 'דניאל',
}
const PERSON_EMOJI: Record<string, string> = {
  ami: '🌸', alex: '🎵', itan: '⚽', assaf: '💼', danil: '🌿',
}

const HE_QUOTES = [
  { text: 'המשפחה היא המקום שבו החיים מתחילים והאהבה לעולם לא מסתיימת', attr: '— פתגם עברי' },
  { text: 'ביחד כל יום הופך להרפתקה', attr: '— לב המשפחה' },
  { text: 'הזמן שמבלים יחד הוא המתנה הכי יקרה', attr: '— לב המשפחה' },
  { text: 'כל יום הוא הזדמנות חדשה ליצור זיכרונות', attr: '— פתגם עברי' },
  { text: 'המשפחה — שם כל חלום מתחיל', attr: '— לב המשפחה' },
  { text: 'אהבה היא מה שהופך בית לבית אמיתי', attr: '— פתגם עברי' },
  { text: 'יחד אנחנו חזקים יותר מכל אחד לבד', attr: '— לב המשפחה' },
]

// ── Canvas utilities ─────────────────────────────────────────────────────

function easeOut(t: number) { return 1 - Math.pow(1 - t, 3) }
function easeInOut(t: number) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r)
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r)
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r)
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w }
    else cur = test
  }
  if (cur) lines.push(cur)
  return lines
}

function darkBg(ctx: CanvasRenderingContext2D, W: number, H: number,
  c1 = '#0a0f1e', c2 = '#0f2744', c3 = '#1a3a6e') {
  const g = ctx.createLinearGradient(0,0,W,H)
  g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c3)
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H)
}

// ── Section renderers ────────────────────────────────────────────────────

function renderIntro(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, date: Date) {
  darkBg(ctx, W, H)

  // Soft glow circles
  ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = '#60A5FA'
  ctx.beginPath(); ctx.arc(W*.8,H*.12,W*.4,0,Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.arc(W*.1,H*.88,W*.32,0,Math.PI*2); ctx.fill()
  ctx.restore()

  const a = clamp(t*3,0,1)
  ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

  ctx.font = `${W*.21}px Arial`
  ctx.fillText('🏠', W/2, H*.27)

  ctx.font = `900 ${W*.11}px Arial`; ctx.fillStyle = '#FFFFFF'
  ctx.fillText('משפחת אלוני', W/2, H*.42)

  ctx.font = `bold ${W*.075}px Arial`; ctx.fillStyle = '#94A3B8'
  ctx.fillText(format(date,'EEEE',{locale:he}), W/2, H*.51)

  ctx.font = `${W*.062}px Arial`; ctx.fillStyle = '#60A5FA'
  ctx.fillText(format(date,'d MMMM yyyy',{locale:he}), W/2, H*.59)

  // Growing divider line
  const lp = clamp((t-.3)*2.5,0,1)
  ctx.globalAlpha = lp*a; ctx.strokeStyle='#3B82F6'; ctx.lineWidth=3
  const lw = W*.5*easeOut(lp)
  ctx.beginPath(); ctx.moveTo(W/2-lw/2,H*.65); ctx.lineTo(W/2+lw/2,H*.65); ctx.stroke()

  ctx.globalAlpha = 1
}

function renderPerson(
  ctx: CanvasRenderingContext2D, W: number, H: number, t: number,
  person: string, events: FetchedEvent[],
) {
  const [c1, c2] = PERSON_COLORS[person]
  const g = ctx.createLinearGradient(0,0,0,H)
  g.addColorStop(0,c1); g.addColorStop(0.55,'#0d1117'); g.addColorStop(1,'#030712')
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H)

  ctx.save(); ctx.globalAlpha=.1; ctx.fillStyle=c2
  ctx.beginPath(); ctx.arc(W*.88,H*.07,W*.48,0,Math.PI*2); ctx.fill()
  ctx.restore()

  let alpha=1
  if(t<.1) alpha=easeOut(t/.1)
  else if(t>.9) alpha=easeOut((1-t)/.1)
  ctx.globalAlpha=alpha; ctx.textAlign='center'; ctx.textBaseline='middle'

  ctx.font=`${W*.2}px Arial`
  ctx.fillText(PERSON_EMOJI[person], W/2, H*.14)

  ctx.font=`900 ${W*.12}px Arial`; ctx.fillStyle='#FFFFFF'
  ctx.fillText(PERSON_NAMES[person], W/2, H*.26)

  // Event count badge
  const cnt = events.length
  const badgeLabel = cnt===0 ? 'יום חופשי 🎉' : cnt===1 ? 'אירוע 1' : `${cnt} אירועים`
  ctx.font=`bold ${W*.045}px Arial`; ctx.fillStyle = cnt===0 ? 'rgba(255,255,255,.4)' : c2
  ctx.fillText(badgeLabel, W/2, H*.325)

  // Divider
  ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.lineWidth=1.5
  ctx.beginPath(); ctx.moveTo(W*.1,H*.36); ctx.lineTo(W*.9,H*.36); ctx.stroke()

  if (events.length===0) {
    ctx.globalAlpha=1; return
  }

  // ── Events (all of them, with scroll if needed) ─────────────────────
  const CARD_H  = events.length <= 4 ? H*.095 : H*.075
  const GAP     = events.length <= 4 ? H*.012 : H*.008
  const START_Y = H*.37
  const MAX_H   = H*.58   // visible window height
  const totalH  = events.length*(CARD_H+GAP)
  const scrollDist = Math.max(0, totalH - MAX_H)
  // Scroll starts at t=0.3 and ends at t=0.85
  const scrollT    = clamp((t-.3)/.55,0,1)
  const scrollY    = scrollDist * easeInOut(scrollT)

  // Clip to event area
  ctx.save()
  ctx.beginPath()
  ctx.rect(W*.03, START_Y-4, W*.94, MAX_H+8)
  ctx.clip()

  for (let i=0; i<events.length; i++) {
    const ev = events[i]
    const cardY = START_Y + i*(CARD_H+GAP) - scrollY

    // Skip if fully outside clip
    if (cardY+CARD_H < START_Y-10 || cardY > START_Y+MAX_H+10) continue

    // Slide-in on first appearance
    const slideDelay = .08 + i*.05
    const slideT = clamp((t-slideDelay)/.18,0,1)
    const offX = (1-easeOut(slideT)) * W*.55

    ctx.save(); ctx.translate(-offX,0)

    drawRoundRect(ctx, W*.05, cardY, W*.9, CARD_H, 12)
    ctx.fillStyle='rgba(255,255,255,.11)'; ctx.fill()
    ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.lineWidth=1; ctx.stroke()

    // Accent bar
    ctx.fillStyle=c2
    drawRoundRect(ctx, W*.05, cardY, 5, CARD_H, 2); ctx.fill()

    // Title
    ctx.font=`bold ${CARD_H*.42}px Arial`; ctx.fillStyle='#FFFFFF'
    ctx.textAlign='right'; ctx.textBaseline='middle'
    let ttl = ev.title
    const maxTW = W*.72
    while (ctx.measureText(ttl).width > maxTW && ttl.length>2) ttl=ttl.slice(0,-1)
    if (ttl!==ev.title) ttl+='…'
    ctx.fillText(ttl, W*.93, cardY+CARD_H*.32)

    // Time + location
    ctx.font=`${CARD_H*.3}px Arial`; ctx.fillStyle='rgba(255,255,255,.6)'
    const parts: string[] = []
    if (ev.start_time) parts.push(`⏰ ${ev.start_time.slice(0,5)}`)
    if (ev.location)   parts.push(`📍 ${ev.location.slice(0,16)}`)
    if (!ev.start_time && !ev.location && ev.is_recurring) parts.push('🔄 קבוע')
    if (parts.length) ctx.fillText(parts.join('  '), W*.93, cardY+CARD_H*.72)

    ctx.restore()
  }

  ctx.restore() // end clip

  // Scroll indicator dots (right edge)
  if (scrollDist > 0) {
    const steps = Math.ceil(events.length/3)
    const curStep = Math.floor(scrollT*(steps-1)+.5)
    ctx.save(); ctx.globalAlpha=.7
    for (let d=0;d<steps;d++) {
      ctx.fillStyle = d===curStep ? '#FFFFFF' : 'rgba(255,255,255,.3)'
      ctx.beginPath()
      ctx.arc(W*.965, START_Y + (MAX_H/(steps-1||1))*d + MAX_H/steps*.5, 4, 0, Math.PI*2)
      ctx.fill()
    }
    ctx.restore()
  }

  ctx.globalAlpha=1
}

function renderFamilySummary(
  ctx: CanvasRenderingContext2D, W: number, H: number, t: number,
  byPerson: Record<string, FetchedEvent[]>, date: Date,
) {
  darkBg(ctx, W, H, '#0d1117','#111827','#0f2744')

  const a = clamp(t*3,0,1)
  ctx.globalAlpha=a; ctx.textAlign='center'; ctx.textBaseline='middle'

  // Title
  ctx.font=`900 ${W*.075}px Arial`; ctx.fillStyle='#FFFFFF'
  ctx.fillText('📊 סיכום היום', W/2, H*.08)
  ctx.font=`${W*.05}px Arial`; ctx.fillStyle='#64748B'
  ctx.fillText(format(date,'EEEE, d MMMM',{locale:he}), W/2, H*.14)

  // Divider
  ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1.5
  ctx.beginPath(); ctx.moveTo(W*.08,H*.175); ctx.lineTo(W*.92,H*.175); ctx.stroke()

  // Person rows
  const ROW_H = H*.13
  const ROW_GAP = H*.01
  const START_Y = H*.19

  PEOPLE_ORDER.forEach((person, idx) => {
    const evs = byPerson[person] ?? []
    const [c1, c2] = PERSON_COLORS[person]
    const rowY = START_Y + idx*(ROW_H+ROW_GAP)

    // Slide in from left
    const slideT = clamp((t-.05-idx*.05)/.25,0,1)
    const offX = (1-easeOut(slideT))*W*.6

    ctx.save(); ctx.translate(-offX,0); ctx.globalAlpha=a

    // Card background
    drawRoundRect(ctx, W*.04, rowY, W*.92, ROW_H, 14)
    ctx.fillStyle = evs.length>0 ? `rgba(255,255,255,.07)` : 'rgba(255,255,255,.03)'
    ctx.fill()

    // Left color strip
    ctx.fillStyle = evs.length>0 ? c1 : 'rgba(255,255,255,.08)'
    drawRoundRect(ctx, W*.04, rowY, 5, ROW_H, 2); ctx.fill()

    // Person emoji + name
    ctx.font=`${ROW_H*.38}px Arial`; ctx.textAlign='right'; ctx.textBaseline='middle'
    ctx.fillText(PERSON_EMOJI[person], W*.93, rowY+ROW_H*.35)
    ctx.font=`bold ${ROW_H*.28}px Arial`; ctx.fillStyle=evs.length>0?'#FFFFFF':'rgba(255,255,255,.35)'
    ctx.fillText(PERSON_NAMES[person], W*.93, rowY+ROW_H*.7)

    // Event count badge
    const cnt = evs.length
    if (cnt>0) {
      ctx.font=`900 ${ROW_H*.34}px Arial`; ctx.fillStyle=c2; ctx.textAlign='left'
      ctx.fillText(`${cnt}`, W*.12, rowY+ROW_H*.35)
      ctx.font=`${ROW_H*.22}px Arial`; ctx.fillStyle='rgba(255,255,255,.5)'
      ctx.fillText(cnt===1?'אירוע':'אירועים', W*.12, rowY+ROW_H*.7)
    } else {
      ctx.font=`${ROW_H*.22}px Arial`; ctx.fillStyle='rgba(255,255,255,.2)'; ctx.textAlign='left'
      ctx.fillText('חופשי', W*.12, rowY+ROW_H*.5)
    }

    // First event title (if any)
    if (evs.length>0) {
      ctx.font=`${ROW_H*.24}px Arial`; ctx.fillStyle='rgba(255,255,255,.65)'; ctx.textAlign='center'
      let ttl = evs[0].title
      const maxTW = W*.45
      while (ctx.measureText(ttl).width>maxTW && ttl.length>2) ttl=ttl.slice(0,-1)
      if (ttl!==evs[0].title) ttl+='…'
      const timeStr = evs[0].start_time ? ` · ${evs[0].start_time.slice(0,5)}` : ''
      ctx.fillText(ttl+timeStr, W*.5, rowY+ROW_H*.5)
    }

    ctx.restore()
  })

  ctx.globalAlpha=1
}

function renderQuote(ctx: CanvasRenderingContext2D, W: number, H: number, t: number,
  quote: { text: string; attr: string }) {
  darkBg(ctx, W, H, '#0a0f1e','#0f172a','#0a0f1e')

  // Glow
  ctx.save(); ctx.globalAlpha=.06; ctx.fillStyle='#A855F7'
  ctx.beginPath(); ctx.arc(W*.5,H*.45,W*.5,0,Math.PI*2); ctx.fill(); ctx.restore()

  const a = clamp(t*2.5,0,1)
  ctx.globalAlpha=a; ctx.textAlign='center'; ctx.textBaseline='middle'

  // Opening quote mark (decorative)
  ctx.font=`${W*.28}px Arial`; ctx.fillStyle='rgba(168,85,247,.25)'
  ctx.fillText('❝', W/2, H*.3)

  // Quote text — wrapped
  ctx.font=`bold ${W*.065}px Arial`; ctx.fillStyle='#FFFFFF'
  const lines = wrapText(ctx, quote.text, W*.8)
  const lineH = W*.082
  const totalTextH = lines.length*lineH
  const textStartY = H*.42 - totalTextH/2
  lines.forEach((line, i) => {
    ctx.fillText(line, W/2, textStartY + i*lineH)
  })

  // Attribution (skip if empty — custom message)
  if (quote.attr) {
    const attrY = textStartY + lines.length*lineH + H*.06
    ctx.font=`${W*.048}px Arial`; ctx.fillStyle='rgba(168,85,247,.8)'
    ctx.fillText(quote.attr, W/2, attrY)
  }

  // Family sign-off
  ctx.font=`900 ${W*.075}px Arial`; ctx.fillStyle='rgba(255,255,255,.9)'
  ctx.fillText('🏠 משפחת אלוני ❤️', W/2, H*.85)

  ctx.globalAlpha=1
}

function renderOutro(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  darkBg(ctx, W, H)
  ctx.globalAlpha = clamp(1-t*3,0,1)  // quick fade to black
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H)
  ctx.globalAlpha=1
}

// ── Main render orchestrator ─────────────────────────────────────────────

function renderFrame(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  elapsed: number,
  byPerson: Record<string, FetchedEvent[]>,
  targetDate: Date,
  quote: { text: string; attr: string },
  lunchText = '',
  customMsg = '',
): number /* total duration */ {
  const activePeople = PEOPLE_ORDER.filter(p => (byPerson[p]?.length ?? 0) > 0)
  const showPeople   = activePeople.length > 0 ? activePeople : PEOPLE_ORDER.slice(0,3)

  const INTRO     = 2
  const PER_P     = 3.5
  const LUNCH_DUR = lunchText ? 3 : 0
  const MSG_DUR   = customMsg ? 3 : 0
  const SUMMARY   = 3
  const QUOTE_DUR = 4
  const OUTRO     = 1
  const TOTAL     = INTRO + showPeople.length*PER_P + LUNCH_DUR + SUMMARY + MSG_DUR + QUOTE_DUR + OUTRO

  ctx.clearRect(0,0,W,H); ctx.direction='rtl'

  const PERSON_END  = INTRO + showPeople.length*PER_P
  const LUNCH_END   = PERSON_END + LUNCH_DUR
  const SUMMARY_END = LUNCH_END + SUMMARY
  const MSG_END     = SUMMARY_END + MSG_DUR
  const QUOTE_END   = MSG_END + QUOTE_DUR

  if (elapsed < INTRO) {
    renderIntro(ctx, W, H, elapsed/INTRO, targetDate)
  } else if (elapsed < PERSON_END) {
    const off = elapsed - INTRO
    const idx = Math.min(Math.floor(off/PER_P), showPeople.length-1)
    const pt  = (off % PER_P) / PER_P
    renderPerson(ctx, W, H, pt, showPeople[idx], byPerson[showPeople[idx]] ?? [])
  } else if (lunchText && elapsed < LUNCH_END) {
    renderLunch(ctx, W, H, (elapsed-PERSON_END)/LUNCH_DUR, lunchText)
  } else if (elapsed < SUMMARY_END) {
    renderFamilySummary(ctx, W, H, (elapsed-LUNCH_END)/SUMMARY, byPerson, targetDate)
  } else if (customMsg && elapsed < MSG_END) {
    renderCustomMessage(ctx, W, H, (elapsed-SUMMARY_END)/MSG_DUR, customMsg)
  } else if (elapsed < QUOTE_END) {
    const quoteOrCustom = customMsg
      ? { text: customMsg, attr: '' }
      : quote
    renderQuote(ctx, W, H, (elapsed-MSG_END)/QUOTE_DUR, quoteOrCustom)
  } else {
    renderOutro(ctx, W, H, (elapsed-QUOTE_END)/OUTRO)
  }

  return TOTAL
}

// ── Lunch slide renderer ─────────────────────────────────────────────────

function renderLunch(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, lunch: string) {
  const g = ctx.createLinearGradient(0,0,0,H)
  g.addColorStop(0,'#7C2D12'); g.addColorStop(0.5,'#451A03'); g.addColorStop(1,'#1C0A00')
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H)

  ctx.save(); ctx.globalAlpha=.08; ctx.fillStyle='#FB923C'
  ctx.beginPath(); ctx.arc(W*.8,H*.15,W*.4,0,Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.arc(W*.2,H*.8,W*.35,0,Math.PI*2); ctx.fill()
  ctx.restore()

  const a = Math.min(t*3,1)
  ctx.globalAlpha=a; ctx.textAlign='center'; ctx.textBaseline='middle'

  ctx.font=`${W*.22}px Arial`
  ctx.fillText('🍽️', W/2, H*.27)

  ctx.font=`900 ${W*.09}px Arial`; ctx.fillStyle='#FFFFFF'
  ctx.fillText('ארוחת צהריים', W/2, H*.42)

  ctx.strokeStyle='rgba(251,146,60,.4)'; ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(W*.15,H*.49); ctx.lineTo(W*.85,H*.49); ctx.stroke()

  // Wrap and render the lunch text
  ctx.font=`bold ${W*.068}px Arial`; ctx.fillStyle='#FB923C'
  const lines = wrapText(ctx, lunch, W*.82)
  const lineH = W*.085
  const startY = H*.55 - (lines.length-1)*lineH/2
  lines.forEach((ln, i) => ctx.fillText(ln, W/2, startY+i*lineH))

  ctx.globalAlpha=1
}

// ── Custom message slide renderer ────────────────────────────────────────

function renderCustomMessage(ctx: CanvasRenderingContext2D, W: number, H: number, t: number,
  message: string) {
  const g = ctx.createLinearGradient(0,0,W,H)
  g.addColorStop(0,'#0f0c29'); g.addColorStop(0.5,'#302b63'); g.addColorStop(1,'#24243e')
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H)

  ctx.save(); ctx.globalAlpha=.07; ctx.fillStyle='#818CF8'
  ctx.beginPath(); ctx.arc(W*.5,H*.45,W*.55,0,Math.PI*2); ctx.fill(); ctx.restore()

  const a = Math.min(t*3,1)
  ctx.globalAlpha=a; ctx.textAlign='center'; ctx.textBaseline='middle'

  ctx.font=`${W*.25}px Arial`
  ctx.fillText('💬', W/2, H*.28)

  ctx.font=`bold ${W*.068}px Arial`; ctx.fillStyle='#FFFFFF'
  const lines = wrapText(ctx, message, W*.82)
  const lineH = W*.088
  const startY = H*.46 - (lines.length-1)*lineH/2
  lines.forEach((ln, i) => ctx.fillText(ln, W/2, startY+i*lineH))

  ctx.globalAlpha=1
}

// ── Modal component ───────────────────────────────────────────────────────

type Status = 'picking' | 'loading' | 'generating' | 'done' | 'error'

export default function VideoSummaryModal({ onClose, defaultDate }: {
  onClose: () => void; defaultDate?: Date
}) {
  const today = new Date(); today.setHours(12,0,0,0)

  const [status,        setStatus]        = useState<Status>('picking')
  const [targetDate,    setTargetDate]    = useState<Date>(defaultDate ?? today)
  const [lunch,         setLunch]         = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [progress,      setProgress]      = useState(0)
  const [videoUrl,      setVideoUrl]      = useState<string | null>(null)
  const [errorMsg,      setErrorMsg]      = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef  = useRef(false)

  const dateStr = targetDate.toISOString().split('T')[0]

  const QUICK = [
    { label: 'היום', date: today },
    { label: 'מחר',  date: addDays(today,1) },
    { label: '+2',   date: addDays(today,2) },
    { label: '+3',   date: addDays(today,3) },
  ]

  const generate = useCallback(async (forDate: Date, lunchText: string, msgText: string) => {
    abortRef.current = false
    setStatus('loading'); setProgress(0)

    const dateKey   = forDate.toISOString().split('T')[0]
    const dayOfWeek = DAY_KEYS[forDate.getDay()]

    let allEvents: FetchedEvent[] = []
    try {
      const res = await fetch(`/api/events?start=${dateKey}&end=${dateKey}&include_recurring=true`)
      if (res.ok) allEvents = await res.json()
    } catch { /* empty */ }

    // Group by person, filter recurring by day-of-week
    const byPerson: Record<string, FetchedEvent[]> = {}
    for (const p of PEOPLE_ORDER) byPerson[p] = []
    for (const ev of allEvents) {
      if (!byPerson[ev.person]) continue
      if (ev.is_recurring) {
        if (ev.recurrence_days?.includes(dayOfWeek)) byPerson[ev.person].push(ev)
      } else {
        byPerson[ev.person].push(ev)
      }
    }
    for (const p of PEOPLE_ORDER)
      byPerson[p].sort((a,b) => (a.start_time??'').localeCompare(b.start_time??''))

    // Pick quote (use custom message if provided, else pick by day-of-week)
    const quote = HE_QUOTES[forDate.getDay() % HE_QUOTES.length]

    setStatus('generating')

    const canvas = canvasRef.current
    if (!canvas) return

    const W=720, H=1280
    canvas.width=W; canvas.height=H
    const ctx=canvas.getContext('2d')!

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4'

    let stream: MediaStream
    try { stream=canvas.captureStream(30) }
    catch { setErrorMsg('הדפדפן לא תומך ביצירת וידאו מ-Canvas'); setStatus('error'); return }

    const chunks: BlobPart[] = []
    let recorder: MediaRecorder
    try { recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:4_000_000}) }
    catch { try { recorder=new MediaRecorder(stream) } catch { setErrorMsg('MediaRecorder לא נתמך'); setStatus('error'); return } }

    recorder.ondataavailable = e => { if (e.data.size>0) chunks.push(e.data) }
    const done = new Promise<Blob>(resolve => {
      recorder.onstop = () => resolve(new Blob(chunks,{type:recorder.mimeType||'video/webm'}))
    })

    recorder.start(200)
    const startTime = performance.now()
    let totalDur = 25

    await new Promise<void>(resolve => {
      const frame = () => {
        if (abortRef.current) { recorder.stop(); resolve(); return }
        const elapsed = (performance.now()-startTime)/1000
        totalDur = renderFrame(ctx,W,H,elapsed,byPerson,forDate,quote,lunchText,msgText)
        setProgress(Math.min(99,Math.floor((elapsed/totalDur)*100)))
        if (elapsed<totalDur) { requestAnimationFrame(frame) }
        else { recorder.stop(); resolve() }
      }
      requestAnimationFrame(frame)
    })

    if (abortRef.current) { setStatus('picking'); return }
    const blob = await done
    setVideoUrl(URL.createObjectURL(blob))
    setStatus('done')
  }, [])

  const handleClose = () => {
    abortRef.current = true
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    onClose()
  }

  const resetToPickDate = () => {
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null) }
    setStatus('picking')
  }

  const isToday    = dateStr === today.toISOString().split('T')[0]
  const isTomorrow = dateStr === addDays(today,1).toISOString().split('T')[0]
  const dateLabel  = isToday ? 'היום' : isTomorrow ? 'מחר' : format(targetDate,'EEEE, d/M',{locale:he})

  return (
    <div className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4"
      onClick={e => e.target===e.currentTarget && handleClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-black text-gray-900">🎬 סיכום יומי — וידאו AI</h2>
          <button onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg leading-none transition">×</button>
        </div>

        <div className="px-5 pb-5">

          {/* ── DATE PICKER ── */}
          {status==='picking' && (
            <div>
              <p className="text-gray-500 text-sm mb-3 text-center">בחר/י יום ליצירת הוידאו</p>
              <div className="flex gap-2 mb-3 justify-center flex-wrap">
                {QUICK.map(q => {
                  const qs = q.date.toISOString().split('T')[0]
                  const active = qs===dateStr
                  return (
                    <button key={qs}
                      onClick={() => setTargetDate(new Date(qs+'T12:00:00'))}
                      className={`px-3 py-1.5 rounded-xl text-sm font-bold transition border-2 ${
                        active ? 'bg-purple-600 text-white border-purple-600'
                               : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>
                      {q.label}
                    </button>
                  )
                })}
              </div>
              <input type="date" value={dateStr}
                onChange={e => { if (e.target.value) setTargetDate(new Date(e.target.value+'T12:00:00')) }}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:border-purple-400 text-gray-700 mb-3" />

              <div className="bg-purple-50 rounded-2xl px-4 py-3 mb-4 text-center">
                <p className="text-xs text-purple-400 mb-0.5">יוצר וידאו ל:</p>
                <p className="font-black text-purple-700 text-base">{format(targetDate,'EEEE',{locale:he})}</p>
                <p className="text-purple-600 text-sm">{format(targetDate,'d MMMM yyyy',{locale:he})}</p>
              </div>

              {/* Lunch */}
              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-500 mb-1 text-right">
                  🍽️ ארוחת צהריים <span className="font-normal text-gray-400">(אופציונלי)</span>
                </label>
                <input
                  type="text"
                  value={lunch}
                  onChange={e => setLunch(e.target.value)}
                  placeholder="מה לארוחת צהריים היום?"
                  dir="rtl"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none focus:border-orange-400 text-gray-700"
                />
              </div>

              {/* Custom message */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1 text-right">
                  💬 הודעה אישית <span className="font-normal text-gray-400">(תחליף את הציטוט)</span>
                </label>
                <input
                  type="text"
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="כתוב/י הודעה אישית למשפחה..."
                  dir="rtl"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none focus:border-purple-400 text-gray-700"
                />
              </div>

              <button onClick={() => generate(targetDate, lunch, customMessage)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black px-8 py-3 rounded-2xl text-base shadow-lg hover:scale-105 active:scale-95 transition-transform w-full">
                ✨ צור וידאו
              </button>
            </div>
          )}

          {/* ── GENERATING ── */}
          {(status==='loading' || status==='generating') && (
            <div className="py-2">
              <div className="rounded-2xl overflow-hidden mb-4 shadow-lg"
                style={{aspectRatio:'9/16',background:'#0a0f1e'}}>
                <canvas ref={canvasRef} className="w-full h-full object-contain" style={{display:'block'}} />
              </div>
              <p className="font-bold text-gray-700 text-sm text-center mb-2">
                {status==='loading' ? 'טוען נתונים…' : `מייצר וידאו ל${dateLabel}… ${progress}%`}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-300"
                  style={{width:`${progress}%`}} />
              </div>
              {status==='generating' && (
                <p className="text-xs text-gray-400 text-center mt-2">הוידאו מוצג בזמן אמת</p>
              )}
            </div>
          )}

          {/* ── DONE ── */}
          {status==='done' && videoUrl && (
            <div>
              <p className="text-center text-sm font-bold text-gray-600 mb-2">
                📅 {format(targetDate,'EEEE, d MMMM yyyy',{locale:he})}
              </p>
              <div className="rounded-2xl overflow-hidden mb-3 shadow-lg bg-black" style={{aspectRatio:'9/16'}}>
                <video src={videoUrl} controls autoPlay loop playsInline
                  className="w-full h-full object-contain" />
              </div>
              <div className="flex gap-2">
                <a href={videoUrl} download={`family-${dateStr}.webm`}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition">
                  ⬇️ הורד
                </a>
                <button onClick={resetToPickDate}
                  className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold py-2.5 rounded-xl text-sm transition">
                  📅 יום אחר
                </button>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {status==='error' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-red-600 text-sm mb-4">{errorMsg}</p>
              <button onClick={resetToPickDate} className="text-purple-600 underline text-sm font-bold">חזור</button>
            </div>
          )}

          {status!=='loading' && status!=='generating' && (
            <canvas ref={canvasRef} className="hidden" />
          )}
        </div>
      </div>
    </div>
  )
}
