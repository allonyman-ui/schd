"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
type DayData = {
  date: string;
  day: string;
  hotel: string;
  hotelColor: string;
  emoji: string;
  title: string;
  items: { time: string; text: string }[];
  links?: { url: string; label: string }[];
};

type HotelData = {
  name: string;
  dates: string;
  nights: string;
  address: string;
  booking: string;
  phone: string;
  rating: string;
  color: string;
  bgGlass: string;
  borderColor: string;
  emoji: string;
  highlights: string[];
  url: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const hotels: HotelData[] = [
  {
    name: "NYX Esperia Palace Hotel",
    dates: "26–28 מרץ",
    nights: "2 לילות",
    address: "Stadiou 22, Athina — סינטגמה / מרכז",
    booking: "6198749745",
    phone: "+30 21 6001 9229",
    rating: "4.4 ⭐",
    color: "#60a5fa",
    bgGlass: "rgba(37,99,235,0.15)",
    borderColor: "rgba(96,165,250,0.35)",
    emoji: "🏙️",
    highlights: [
      "גג עם בר ונוף ישיר לאקרופוליס מוואר בלילה",
      "5 דקות הליכה מכיכר סינטגמה",
      "ספא, חדרים מעוצבים, שליטה דיגיטלית בחדר",
      "קרוב לתחנת מטרו — נוח לכל מקום",
    ],
    url: "https://www.leonardo-hotels.com/nyx-esperia-palace-athens",
  },
  {
    name: "Somewhere Vouliagmeni",
    dates: "28–30 מרץ",
    nights: "2 לילות",
    address: "Agiou Panteleimonos, Vouliagmeni — ריביירה אתונאית",
    booking: "6158400949",
    phone: "+30 21 0967 0000",
    rating: "4.8 ⭐",
    color: "#38bdf8",
    bgGlass: "rgba(14,165,233,0.15)",
    borderColor: "rgba(56,189,248,0.35)",
    emoji: "🌊",
    highlights: [
      "ממול לחוף הים — נוף לים מהמרפסת",
      "ארוחת בוקר חלומית כלולה",
      "2 דקות מלגונת ווואליגמני הייחודית",
      "צוות אישי וחם במיוחד — דירוג 4.8!",
    ],
    url: "https://www.somewhereinathens.com",
  },
  {
    name: "MONO Lofts",
    dates: "30 מרץ – 2 אפריל",
    nights: "3 לילות",
    address: "Esopou 3, Athina 105 54 — פסירי / לב אתונה",
    booking: "5870464642",
    phone: "+30 698 221 5518",
    rating: "4.2 ⭐",
    color: "#4ade80",
    bgGlass: "rgba(22,163,74,0.15)",
    borderColor: "rgba(74,222,128,0.35)",
    emoji: "🏘️",
    highlights: [
      "לופטים מרווחים — מושלם למשפחה עם 3 ילדים",
      "מטבחון מאובזר — חסכון בארוחות",
      "2 דקות ממונסטירקי, 10 דקות מהאקרופוליס",
      "מסעדות וקפות ממש מחוץ לבניין",
    ],
    url: "https://goo.gl/maps/MonoLoftsAthens",
  },
];

const days: DayData[] = [
  {
    date: "26 מרץ",
    day: "חמישי",
    hotel: "NYX Esperia",
    hotelColor: "#60a5fa",
    emoji: "✈️",
    title: "הגעה והתמצאות",
    items: [
      { time: "🌅 בוקר/צהריים", text: "הגעה לאתונה, מטרו M3 מהשדה לסינטגמה (40 דקות), צ׳ק-אין NYX" },
      { time: "☀️ אחה״צ",        text: "רחוב ארמו (5 דקות הליכה) — Zara, Nike, H&M, Sephora, Foot Locker" },
      { time: "🌆 סוף אחה״צ",   text: "שוק מונסטירקי — ממצאי וינטג׳, עיצובים יווניים, ריח של אוכל רחוב" },
      { time: "🌙 ערב",           text: "גג NYX — בר עם נוף לאקרופוליס מוואר. ברוכים הבאים לאתונה!" },
    ],
    links: [{ url: "https://etickets.tap.gr", label: "🎟️ כרטיסי אקרופוליס — הזמינו מראש" }],
  },
  {
    date: "27 מרץ",
    day: "שישי",
    hotel: "NYX Esperia",
    hotelColor: "#60a5fa",
    emoji: "🏛️",
    title: "האקרופוליס ולב ההיסטוריה",
    items: [
      { time: "🌅 בוקר מוקדם", text: "יציאה לפני 8:30 — לאקרופוליס לפני ההמון. ילדים מתחת 18 — חינם!" },
      { time: "☀️ בוקר",        text: "אקרופוליס — הפרתנון, הארקטיון, הפרופילאה. נוף על כל אתונה" },
      { time: "☀️ צהריים",      text: "מוזיאון האקרופוליס — רצפת זכוכית עם חפירות חיות מתחתיה" },
      { time: "🌆 אחה״צ",        text: "אגורה העתיקה ומקדש הפייסטוס — לב הדמוקרטיה היוונית (כרטיס משולב)" },
      { time: "🌆 סוף אחה״צ",   text: "טיול בפלאקה — סמטאות ציוריות, חנויות, גלידה" },
      { time: "🌙 ערב",           text: "מסעדה על גג עם נוף לאקרופוליס מוואר — O Kostas לסואבלקי אגדי" },
    ],
    links: [
      { url: "https://etickets.tap.gr", label: "🎟️ כרטיסים לאקרופוליס ואתרים" },
      { url: "https://www.theacropolismuseum.gr", label: "🏛️ מוזיאון האקרופוליס" },
    ],
  },
  {
    date: "28 מרץ",
    day: "שבת",
    hotel: "NYX → Somewhere",
    hotelColor: "#c084fc",
    emoji: "🛍️",
    title: "שוק פשפשים ומעבר לווואליגמני",
    items: [
      { time: "🌅 בוקר",        text: "שוק הפשפשים מונסטירקי — ביום שבת הכי חי! אנטיקים, תקליטים, וינטג׳" },
      { time: "☀️ צהריים",      text: "כיכר אגיאס איריניס — קפה תוסס, מוזיקה, חנויות רקורדס" },
      { time: "🌆 אחה״צ",        text: "צ׳ק-אאוט מ-NYX, נסיעה ל-Somewhere Vouliagmeni (35 דקות)" },
      { time: "🌙 ערב",           text: "הגעה לווואליגמני, צ׳ק-אין, ארוחת ערב על הים — ברוכים הבאים לריביירה!" },
    ],
    links: [{ url: "https://www.somewhereinathens.com", label: "🌊 Somewhere Vouliagmeni" }],
  },
  {
    date: "29 מרץ",
    day: "ראשון",
    hotel: "Somewhere",
    hotelColor: "#38bdf8",
    emoji: "🏖️",
    title: "חוף, לגונה וגליפדה",
    items: [
      { time: "🌅 בוקר",        text: "ארוחת בוקר חלומית ב-Somewhere (כלולה) — מהטובות ביוון לפי האורחים" },
      { time: "☀️ בוקר",        text: "חוף ווואליגמני ממש מחוץ למלון — שחייה, שזלונגים, ים שקט ונקי" },
      { time: "☀️ צהריים",      text: "לגונת ווואליגמני — אגם מלוחים טבעי ייחודי, 2 דקות הליכה" },
      { time: "🌆 אחה״צ",        text: "נסיעה לגליפדה (10 דקות) — קניות בוטיקים, Miami vibes, אופנת חוף" },
      { time: "🌙 ערב",           text: "ארוחת דגים טריים על שפת הים — Balux Cafe או פסאראקיה מקומי" },
    ],
    links: [{ url: "https://www.baluxcafe.com", label: "🍽️ Balux Cafe Glyfada — הזמנת מקום" }],
  },
  {
    date: "30 מרץ",
    day: "שני",
    hotel: "Somewhere → MONO",
    hotelColor: "#c084fc",
    emoji: "🚢",
    title: "בוקר בחוף ומעבר לפסירי",
    items: [
      { time: "🌅 בוקר",        text: "בוקר אחרון בווואליגמני — שחייה, קפה על הים" },
      { time: "☀️ צהריים",      text: "פיראוס — ביקור בספינת המלחמה האגדית Averof (מוזיאון צף!)" },
      { time: "🌆 אחה״צ",        text: "צ׳ק-אין MONO Lofts בפסירי — הכירו את השכונה הכי cool באתונה" },
      { time: "🌆 סוף אחה״צ",   text: "סיור גרפיטי ואמנות רחוב בפסירי — Aiolou St, כיכר אביסינייס" },
      { time: "🌙 ערב",           text: "ארוחה ראשונה בפסירי — טברנה מקומית עם מוזיקה חיה" },
    ],
    links: [{ url: "https://www.alternativeathens.com/street-art-tour", label: "🎨 סיור גרפיטי — Alternative Athens" }],
  },
  {
    date: "31 מרץ",
    day: "שלישי",
    hotel: "MONO Lofts",
    hotelColor: "#4ade80",
    emoji: "🔭",
    title: "מדע, קסם ומוזיאונים",
    items: [
      { time: "🌅 בוקר",        text: "קפה בוקר בכיכר פסירי — אחת הכיכרות הכי תוססות באתונה" },
      { time: "☀️ בוקר",        text: "מוזיאון האשליות — חדר הפוך, מנהרת סחרחרת, אשליות אופטיות. סלפי!" },
      { time: "☀️ צהריים",      text: "מוזיאון הטכנולוגיה היוונית Kotsanas — מחשב אנלוגי מ-100 לפנה״ס" },
      { time: "🌆 אחה״צ",        text: "פלנטריום Eugenides — סרטי IMAX תחת כיפת כוכבים" },
      { time: "🌙 ערב",           text: "קולנוע פתוח תחת הכוכבים עם נוף לאקרופוליס — בדקו Athens Voice" },
    ],
    links: [
      { url: "https://www.museumofillusions.gr", label: "🔮 מוזיאון האשליות" },
      { url: "https://www.eugenidesplanetarium.gr", label: "🌟 פלנטריום Eugenides" },
      { url: "https://www.athensvoice.gr", label: "📅 Athens Voice — מה קורה הערב" },
    ],
  },
  {
    date: "1 אפריל",
    day: "רביעי",
    hotel: "MONO Lofts",
    hotelColor: "#4ade80",
    emoji: "⚽",
    title: "ספורט ואדרנלין",
    items: [
      { time: "🌅 בוקר",        text: "האצטדיון הפנאתנאיקי 1896 — ריצה על מסלול השיש, מוזיאון אולימפי" },
      { time: "☀️ צהריים",      text: "Adventure Park מלאקסה (40 דקות) — zip-line, טיפוס עצים, קשתות" },
      { time: "🌆 אחה״צ",        text: "חזרה לפסירי — קניות אחרונות בקולונקי ובאקסרכיה" },
      { time: "🌙 ערב",           text: "Kuzina על הגג עם נוף לאקרופוליס — ארוחת ערב חגיגית (הזמינו מראש!)" },
    ],
    links: [
      { url: "https://www.panathenaic-stadium.gr", label: "🏟️ האצטדיון הפנאתנאיקי" },
      { url: "https://www.adventurepark.gr", label: "🌲 Adventure Park — הזמנה" },
      { url: "https://www.kuzina.gr", label: "🍽️ Kuzina — הזמנת מקום" },
    ],
  },
  {
    date: "2 אפריל",
    day: "חמישי",
    hotel: "MONO Lofts → טיסה",
    hotelColor: "#f87171",
    emoji: "🛍️",
    title: "קניות אחרונות ונסיעה הביתה",
    items: [
      { time: "🌅 בוקר",        text: "ארוחת בוקר אחרונה בפסירי — ספנקופיטה וקפה פרפ׳ בכיכר" },
      { time: "☀️ בוקר",        text: "קולונקי — Ancient Greek Sandals, Korres, בוטיקים יווניים" },
      { time: "☀️ צהריים",      text: "צ׳ק-אאוט MONO Lofts, אחסון מזוודות, שוטטות אחרונה" },
      { time: "🌆 אחה״צ",        text: "מטרו M3 לשדה התעופה (40 דקות) — Tax Free על קניות מעל 50€!" },
    ],
    links: [
      { url: "https://www.ancient-greek-sandals.com", label: "👡 Ancient Greek Sandals" },
      { url: "https://www.korres.com", label: "🌿 Korres — קוסמטיקה יוונית" },
    ],
  },
];

const quickLinks = [
  { url: "https://etickets.tap.gr",                label: "🎟️ כרטיסי אקרופוליס",  desc: "הזמנה רשמית"      },
  { url: "https://www.hellenicseaways.gr",          label: "⛴️ מעבורות לאיים",      desc: "לוחות זמנים"      },
  { url: "https://www.athensvoice.gr",              label: "📅 Athens Voice",        desc: "אירועים ומה קורה" },
  { url: "https://www.alternativeathens.com",       label: "🗺️ Alternative Athens",  desc: "סיורים מקוריים"   },
  { url: "https://athensforkids.com",               label: "👶 Athens For Kids",     desc: "לילדים"           },
  { url: "https://www.visitgreece.gr",              label: "🇬🇷 Visit Greece",        desc: "המדריך הרשמי"     },
];

const tips = [
  {
    title: "💶 כסף וחיסכון",
    items: [
      "ילדים מתחת 18 — חינם ברוב האתרים הממשלתיים",
      "כרטיס משולב 7 אתרים = 30€ — חוסך הרבה",
      "כרטיס מטרו יומי = 4.50€ לאדם",
      "Tax Free בשדה על קניות מעל 50€ — שמרו קבלות!",
    ],
  },
  {
    title: "🚇 תחבורה",
    items: [
      "מטרו M3 ישיר משדה התעופה — 40 דקות, כ-10€",
      "מונסטירקי ← סינטגמה: 2 תחנות מטרו",
      "Bolt / FreeNow — עדיפים על מוניות רגילות",
      "רוב האטרקציות ממרכז — מגיעים ברגל!",
    ],
  },
  {
    title: "🌡️ מזג אוויר ולבוש",
    items: [
      "מרץ-אפריל: 18–24°C ביום, נעים מאוד",
      "קרם הגנה חובה — גם ביום מעונן",
      "נעלי הליכה נוחות — הרבה אבני ריצוף",
      "בקבוק מים — מזרקות חינמיות בכל מקום",
    ],
  },
];

// ─── Hotel Card ────────────────────────────────────────────────────────────────
function HotelCard({ hotel }: { hotel: HotelData }) {
  return (
    <a href={hotel.url} target="_blank" rel="noopener noreferrer"
      className="block rounded-3xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-2xl"
      style={{ background: hotel.bgGlass, border: `1.5px solid ${hotel.borderColor}`, backdropFilter: 'blur(16px)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-3xl mb-1">{hotel.emoji}</div>
          <h3 className="font-black text-lg leading-tight" style={{ color: hotel.color }}>{hotel.name}</h3>
          <div className="text-sm text-white/50 mt-0.5">{hotel.dates} · {hotel.nights}</div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white/90 flex-shrink-0"
          style={{ background: hotel.bgGlass, border: `1px solid ${hotel.borderColor}` }}>
          {hotel.rating}
        </span>
      </div>
      <div className="text-sm text-white/60 mb-2 flex items-start gap-1.5">
        <span>📍</span><span>{hotel.address}</span>
      </div>
      <div className="text-sm text-white/60 mb-3 flex items-center gap-1.5">
        <span>🔖</span>
        <span className="font-mono text-xs px-2 py-0.5 rounded-lg text-white/80"
          style={{ background: 'rgba(255,255,255,0.08)' }}>{hotel.booking}</span>
        <span className="text-white/40 text-xs">{hotel.phone}</span>
      </div>
      <ul className="space-y-1.5">
        {hotel.highlights.map((h, i) => (
          <li key={i} className="text-sm text-white/75 flex items-start gap-2">
            <span style={{ color: hotel.color }} className="shrink-0 mt-0.5">✓</span>
            {h}
          </li>
        ))}
      </ul>
    </a>
  );
}

// ─── Day Card ──────────────────────────────────────────────────────────────────
function DayCard({ day, isActive, onClick }: { day: DayData; isActive: boolean; onClick: () => void }) {
  return (
    <div className="rounded-3xl overflow-hidden transition-all"
      style={{ border: `1.5px solid ${isActive ? day.hotelColor + '60' : 'rgba(255,255,255,0.08)'}` }}>
      <button onClick={onClick} className="w-full text-right p-4 flex items-center justify-between gap-3 transition-colors"
        style={{ background: isActive ? `${day.hotelColor}20` : 'rgba(255,255,255,0.04)' }}>
        <span className={`text-lg transition-transform ${isActive ? "rotate-90" : ""}`} style={{ color: isActive ? day.hotelColor : 'rgba(255,255,255,0.3)' }}>‹</span>
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-2 mb-0.5">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: day.hotelColor + '25', color: day.hotelColor }}>
              {day.hotel}
            </span>
          </div>
          <div className="font-black text-base text-white/90">{day.emoji} {day.day} {day.date} — {day.title}</div>
        </div>
      </button>

      {isActive && (
        <div className="px-4 pb-4 pt-3" style={{ background: 'rgba(0,0,0,0.25)' }}>
          <div className="space-y-3">
            {day.items.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs font-medium text-white/40 shrink-0 pt-0.5 min-w-[90px] text-right">{item.time}</span>
                <span className="text-sm text-white/80 flex-1">{item.text}</span>
              </div>
            ))}
          </div>
          {day.links && day.links.length > 0 && (
            <div className="mt-4 pt-3 flex flex-wrap gap-2 justify-end"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {day.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full transition-all hover:brightness-125"
                  style={{ background: day.hotelColor + '22', border: `1px solid ${day.hotelColor}55`, color: day.hotelColor }}>
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AthensPage() {
  const [activeDay, setActiveDay] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<"days" | "hotels" | "tips">("days");

  return (
    <div className="min-h-screen" dir="rtl"
      style={{ background: 'linear-gradient(160deg,#05101f 0%,#0b1a34 35%,#0d1f3a 60%,#08111f 100%)' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-8 pb-6"
        style={{ background: 'linear-gradient(180deg, rgba(30,58,138,0.6) 0%, transparent 100%)' }}>

        {/* Back button */}
        <Link href="/"
          className="absolute top-4 right-4 flex items-center gap-1.5 text-sm font-bold text-white/60 hover:text-white transition px-3 py-1.5 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          ← חזרה
        </Link>

        <div className="max-w-2xl mx-auto text-center pt-6">
          <div className="text-6xl mb-3 drop-shadow-2xl">🏛️</div>
          <h1 className="text-4xl font-black text-white mb-2" style={{ textShadow: '0 2px 20px rgba(96,165,250,0.5)' }}>
            אתונה 2026
          </h1>
          <p className="text-blue-300/70 text-sm mb-5">מדריך משפחתי · 26 מרץ – 2 אפריל · 3 מלונות</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {[
              { emoji: "👨‍👩‍👧‍👦", text: "3 ילדים 10–14" },
              { emoji: "🗓️",        text: "7 לילות" },
              { emoji: "📍",        text: "פסירי, ווואליגמני, סינטגמה" },
            ].map((chip, i) => (
              <div key={i} className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 text-white/80 font-medium"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                <span>{chip.emoji}</span><span>{chip.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PDF Button ───────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 -mt-2 mb-4">
        <a href="/athens-guide.pdf" download
          className="flex items-center justify-center gap-2 w-full font-black py-3 px-4 rounded-2xl shadow-lg transition-all hover:brightness-110 active:scale-98 text-sm"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)', color: '#1a0a00', boxShadow: '0 4px 16px rgba(245,158,11,0.4)' }}>
          📥 הורד את המדריך המלא PDF
        </a>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 mb-4">
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {([
            { id: "days"   as const, label: "📅 תוכנית ימים" },
            { id: "hotels" as const, label: "🏨 מלונות"       },
            { id: "tips"   as const, label: "💡 טיפים"         },
          ]).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2.5 px-3 rounded-xl text-sm font-black transition-all"
              style={activeTab === tab.id
                ? { background: 'rgba(96,165,250,0.25)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.35)' }
                : { color: 'rgba(255,255,255,0.45)', border: '1px solid transparent' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 pb-16">

        {/* Days */}
        {activeTab === "days" && (
          <div className="space-y-2">
            {/* Hotel legend */}
            <div className="flex gap-3 flex-wrap justify-end mb-3 px-1">
              {[
                { color: "#60a5fa", label: "NYX Esperia" },
                { color: "#38bdf8", label: "Somewhere"   },
                { color: "#4ade80", label: "MONO Lofts"  },
              ].map((h, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-white/50">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: h.color }} />
                  {h.label}
                </div>
              ))}
            </div>
            {days.map((day, i) => (
              <DayCard key={i} day={day} isActive={activeDay === i}
                onClick={() => setActiveDay(activeDay === i ? null : i)} />
            ))}
          </div>
        )}

        {/* Hotels */}
        {activeTab === "hotels" && (
          <div className="space-y-4">
            <div className="rounded-2xl p-3 text-sm text-right text-blue-300/80"
              style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(96,165,250,0.2)' }}>
              💡 אתם מתחילים במרכז, אז עוברים לחוף לסוף שבוע, ואז חוזרים למרכז — תכנון מושלם!
            </div>
            {hotels.map((hotel, i) => <HotelCard key={i} hotel={hotel} />)}
          </div>
        )}

        {/* Tips */}
        {activeTab === "tips" && (
          <div className="space-y-4">
            {/* Quick Links */}
            <div>
              <h3 className="font-black text-white/80 mb-3 text-right">🔗 לינקים חיוניים</h3>
              <div className="grid grid-cols-2 gap-2">
                {quickLinks.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-2xl p-3 text-right transition-all hover:-translate-y-0.5"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="font-bold text-sm text-white/85">{link.label}</div>
                    <div className="text-xs text-white/40 mt-0.5">{link.desc}</div>
                  </a>
                ))}
              </div>
            </div>

            {/* Tips sections */}
            {tips.map((section, i) => (
              <div key={i} className="rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 className="font-black text-white/85 mb-3 text-right">{section.title}</h3>
                <ul className="space-y-2">
                  {section.items.map((item, j) => (
                    <li key={j} className="text-sm text-white/65 text-right flex items-start gap-2 justify-end">
                      <span>{item}</span>
                      <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
