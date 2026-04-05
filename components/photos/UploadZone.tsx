'use client'

import { useCallback, useRef, useState } from 'react'
import type { Trip } from '@/lib/trip-media'
import { FAMILY_MEMBERS } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────
type ItemStatus = 'pending' | 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  status: ItemStatus
  progress: number   // 0-100
  error?: string
}

interface Props {
  trip: Trip
  onUploaded?: () => void
}

// ── Constants ──────────────────────────────────────────────────────
const CONCURRENCY = 3          // simultaneous uploads
const XHR_TIMEOUT_MS = 120_000 // 2 min per file

const MEMBER_COLORS: Record<string, string> = {
  alex:  '#1d4ed8',
  itan:  '#15803d',
  ami:   '#be123c',
  danil: '#7c3aed',
  assaf: '#b45309',
}

// Mime fallback map for common types iOS/Android strip
const MIME_FALLBACK: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4:  'video/mp4',
  mov:  'video/quicktime',
  avi:  'video/x-msvideo',
  mkv:  'video/x-matroska',
  webm: 'video/webm',
  m4v:  'video/mp4',
}

function getMimeType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_FALLBACK[ext] ?? 'application/octet-stream'
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── Component ──────────────────────────────────────────────────────
export default function UploadZone({ trip, onUploaded }: Props) {
  const [uploader, setUploader]     = useState<string | null>(null)
  const [items, setItems]           = useState<UploadItem[]>([])
  const [isRunning, setIsRunning]   = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const cameraInputRef= useRef<HTMLInputElement>(null)

  // Use a ref-map so upload workers always see the latest item state
  // without stale closures. itemsRef mirrors state for reads inside async code.
  const itemsRef = useRef<Map<string, UploadItem>>(new Map())

  function updateItem(id: string, patch: Partial<UploadItem>) {
    itemsRef.current.set(id, { ...itemsRef.current.get(id)!, ...patch })
    setItems(Array.from(itemsRef.current.values()))
  }

  // ── Add files ────────────────────────────────────────────────────
  function addFiles(files: FileList | null) {
    if (!files || !files.length) return
    const newItems: UploadItem[] = Array.from(files).map(file => ({
      id: uid(),
      file,
      status: 'pending',
      progress: 0,
    }))
    newItems.forEach(it => itemsRef.current.set(it.id, it))
    setItems(Array.from(itemsRef.current.values()))
  }

  // ── Upload one file ───────────────────────────────────────────────
  async function uploadOne(item: UploadItem, uploaderName: string): Promise<void> {
    updateItem(item.id, { status: 'uploading', progress: 0 })
    const file = item.file
    const mimeType = getMimeType(file)

    try {
      // Step 1 — presign
      const presignRes = await fetchWithTimeout('/api/upload-media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id:      trip.id,
          trip_slug:    trip.slug,
          uploader:     uploaderName,
          filename:     file.name,
          content_type: mimeType,
          file_size:    file.size,
        }),
      }, 30_000)

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error(err.error ?? `Presign ${presignRes.status}`)
      }
      const { signed_url, media_id } = await presignRes.json()

      // Step 2 — PUT directly to Supabase (with XHR for progress)
      await xhrUpload(signed_url, file, mimeType, (pct) => {
        updateItem(item.id, { progress: pct })
      })

      // Step 3 — confirm
      const confirmRes = await fetchWithTimeout('/api/upload-media/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id }),
      }, 15_000)
      if (!confirmRes.ok) throw new Error(`Confirm ${confirmRes.status}`)

      updateItem(item.id, { status: 'done', progress: 100 })
    } catch (e: unknown) {
      updateItem(item.id, { status: 'error', error: (e as Error).message })
    }
  }

  // ── Start all uploads with concurrency pool ───────────────────────
  const startUpload = useCallback(async () => {
    if (!uploader || isRunning) return
    setIsRunning(true)
    setShowErrors(false)

    // Collect pending IDs in order
    const queue = Array.from(itemsRef.current.values())
      .filter(it => it.status === 'pending' || it.status === 'error')
      .map(it => it.id)

    // Reset errors to pending for retry
    queue.forEach(id => {
      const it = itemsRef.current.get(id)!
      if (it.status === 'error') updateItem(id, { status: 'pending', progress: 0, error: undefined })
    })

    let qi = 0 // queue index
    async function worker() {
      while (qi < queue.length) {
        const id = queue[qi++]
        const item = itemsRef.current.get(id)
        if (!item || item.status === 'done') continue
        await uploadOne(item, uploader!)
      }
    }

    // Launch N workers concurrently
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    setIsRunning(false)
    const allDone = Array.from(itemsRef.current.values()).every(it => it.status === 'done')
    if (allDone) onUploaded?.()
    else setShowErrors(true)
  }, [uploader, isRunning, trip, onUploaded])

  // ── Remove a pending item ─────────────────────────────────────────
  function removeItem(id: string) {
    itemsRef.current.delete(id)
    setItems(Array.from(itemsRef.current.values()))
  }

  function clearDone() {
    Array.from(itemsRef.current.entries()).forEach(([id, it]) => {
      if (it.status === 'done') itemsRef.current.delete(id)
    })
    setItems(Array.from(itemsRef.current.values()))
  }

  // ── Derived stats ─────────────────────────────────────────────────
  const total     = items.length
  const pending   = items.filter(it => it.status === 'pending').length
  const uploading = items.filter(it => it.status === 'uploading').length
  const done      = items.filter(it => it.status === 'done').length
  const errors    = items.filter(it => it.status === 'error').length
  const overallPct = total ? Math.round(
    items.reduce((s, it) => s + (it.status === 'done' ? 100 : it.progress), 0) / total
  ) : 0

  const canUpload = !isRunning && uploader && (pending + errors) > 0
  const allFinished = total > 0 && done === total

  // Items to show in list: uploading + errors (max 20); skip done to save DOM
  const visibleItems = items.filter(it => it.status === 'uploading' || it.status === 'error').slice(0, 20)

  return (
    <div className="flex flex-col gap-5">
      {/* ── Person selector ── */}
      <div>
        <p className="text-white/60 text-sm mb-2 text-right">מי אתה/את?</p>
        <div className="flex flex-wrap gap-2">
          {FAMILY_MEMBERS.map(m => (
            <button
              key={m.name}
              onClick={() => setUploader(m.name)}
              disabled={isRunning}
              className="flex-1 min-w-[72px] py-3 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-50"
              style={
                uploader === m.name
                  ? { background: MEMBER_COLORS[m.name], color: '#fff', boxShadow: `0 0 20px ${MEMBER_COLORS[m.name]}80` }
                  : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }
              }
            >
              {m.hebrewName}
            </button>
          ))}
        </div>
      </div>

      {/* ── File picker buttons ── */}
      <div className="flex gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
        >
          <span className="text-2xl">🖼️</span>
          <span>גלריה</span>
        </button>
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 py-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
        >
          <span className="text-2xl">📷</span>
          <span>מצלמה</span>
        </button>
      </div>

      <input ref={fileInputRef}   type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
      <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={e => addFiles(e.target.files)} />

      {/* ── Queue summary ── */}
      {total > 0 && (
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {/* Counts row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-3 text-white/60">
              {pending + uploading > 0 && <span>⏳ {pending + uploading}</span>}
              {done   > 0 && <span className="text-green-400">✅ {done}</span>}
              {errors > 0 && <span className="text-red-400">❌ {errors}</span>}
            </div>
            <span className="text-white font-bold">{total} קבצים</span>
          </div>

          {/* Overall progress bar */}
          {isRunning && (
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          )}

          {/* Active uploads (only show uploading + error items) */}
          {visibleItems.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {visibleItems.map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-xs truncate">{item.file.name}</p>
                    {item.status === 'uploading' && (
                      <div className="mt-0.5 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                    {item.status === 'error' && (
                      <p className="text-red-400 text-xs mt-0.5 truncate">{item.error}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm">
                    {item.status === 'uploading' && (
                      <span className="text-white/50 text-xs">{item.progress}%</span>
                    )}
                    {item.status === 'error' && (
                      <button onClick={() => removeItem(item.id)} className="text-white/30 hover:text-white/60 text-xs">✕</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Clear done */}
          {done > 0 && !isRunning && (
            <button onClick={clearDone} className="text-xs text-white/30 hover:text-white/60 transition text-left">
              נקה {done} שהועלו ✓
            </button>
          )}
        </div>
      )}

      {/* ── Upload button ── */}
      {!allFinished && (
        <button
          onClick={startUpload}
          disabled={!canUpload}
          className="w-full py-4 rounded-2xl font-black text-base transition-all active:scale-[0.97] disabled:opacity-40"
          style={{ background: canUpload ? '#2563eb' : 'rgba(255,255,255,0.1)', color: '#fff' }}
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              מעלה {done}/{total} ({overallPct}%)
            </span>
          ) : errors > 0 ? (
            `נסה שוב ${errors} שנכשלו`
          ) : (
            `העלה ${pending} קובץ${pending !== 1 ? 'ים' : ''}`
          )}
        </button>
      )}

      {/* ── All done ── */}
      {allFinished && (
        <div className="text-center py-4 rounded-2xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-white font-black">כל הקבצים הועלו!</p>
          <p className="text-white/50 text-sm mt-1">{done} קבצים נוספו לאלבום</p>
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

function xhrUpload(
  url: string,
  file: File,
  mimeType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.timeout = XHR_TIMEOUT_MS

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
    }
    xhr.onerror   = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))

    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', mimeType)
    xhr.send(file)
  })
}
