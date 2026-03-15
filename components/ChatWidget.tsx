'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { format } from 'date-fns'

interface Message { role: 'user' | 'assistant'; content: string }

const QUICK_PROMPTS = [
  'מה קורה היום?',
  'מי הכי עסוק השבוע?',
  'תעזור לי לתכנן את מחר',
  'תזכיר לי מה חשוב השבוע',
]

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-blue-400"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  )
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [contextLoaded, setContextLoaded] = useState(false)
  const [eventContext, setEventContext] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  // Fetch today's events as context (once)
  const loadContext = useCallback(async () => {
    if (contextLoaded) return
    setContextLoaded(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const res = await fetch(`/api/events?include_recurring=true&start=${today}&end=${today}`)
      if (res.ok) {
        const evs = await res.json()
        if (evs.length > 0) {
          const lines = evs.map((e: { title: string; person: string; start_time?: string }) =>
            `• ${e.title} (${e.person})${e.start_time ? ' בשעה ' + e.start_time.slice(0, 5) : ''}`
          )
          setEventContext(lines.join('\n'))
        }
      }
    } catch { /* silent */ }
  }, [contextLoaded])

  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText || streaming) return

    await loadContext()
    setInput('')

    const userMsg: Message = { role: 'user', content: userText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)

    // Add empty assistant message for streaming into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: eventContext || undefined,
        }),
      })

      if (!res.ok || !res.body) throw new Error('stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const chunk = accumulated
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: chunk }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: '⚠️ שגיאה בחיבור. נסה שוב.' }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }, [input, messages, streaming, loadContext, eventContext])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const clearChat = () => setMessages([])

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        .chat-slide-up {
          animation: slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* ── Floating button ── */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) loadContext() }}
        className="fixed bottom-6 left-6 z-[9998] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95 no-print"
        style={{ background: open ? 'linear-gradient(135deg,#4F46E5,#7C3AED)' : 'linear-gradient(135deg,#3B82F6,#6366F1)' }}
        aria-label="פתח צ'אט עם Claude"
        title="שוחח עם Claude"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className="fixed bottom-24 left-6 z-[9997] w-[340px] sm:w-[380px] flex flex-col rounded-3xl shadow-2xl overflow-hidden no-print chat-slide-up"
          style={{ maxHeight: '70vh', border: '1.5px solid #E0E7FF', background: '#fff' }}
          dir="rtl"
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3 flex-row-reverse"
            style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-xl flex-shrink-0">🤖</div>
            <div className="flex-1 text-right">
              <div className="font-black text-white text-sm leading-tight">Claude — עוזר משפחת אלוני</div>
              <div className="text-indigo-200 text-[10px] mt-0.5">מזהה לוח זמנים · עונה בעברית</div>
            </div>
            {messages.length > 0 && (
              <button onClick={clearChat} className="text-white/50 hover:text-white text-xs transition flex-shrink-0" title="נקה שיחה">
                🗑️
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
            style={{ background: '#F8F9FF' }}>
            {messages.length === 0 && (
              <div className="text-center py-4">
                <div className="text-4xl mb-2">👋</div>
                <div className="text-sm font-bold text-gray-600">שלום! אני Claude, העוזר של משפחת אלוני.</div>
                <div className="text-xs text-gray-400 mt-1">שאל אותי על לוח הזמנים, תכנון, ועוד.</div>
                {/* Quick prompts */}
                <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                  {QUICK_PROMPTS.map(q => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="text-xs bg-white border border-indigo-200 text-indigo-600 rounded-full px-2.5 py-1 hover:bg-indigo-50 transition font-medium">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-right ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm'
                  }`}
                >
                  {msg.content === '' && msg.role === 'assistant' ? <TypingDots /> : msg.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 bg-white flex gap-2 flex-row-reverse items-end">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="כתוב הודעה..."
              disabled={streaming}
              dir="rtl"
              className="flex-1 border-2 border-indigo-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 disabled:opacity-50 bg-gray-50 text-right"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
            >
              {streaming ? <span className="animate-spin text-sm">⏳</span> : <span className="text-base">↑</span>}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
