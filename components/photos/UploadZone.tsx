'use client'

import { useRef, useState } from 'react'
import type { Trip } from '@/lib/trip-media'
import { FAMILY_MEMBERS } from '@/lib/types'

interface UploadItem {
  file: File
  preview: string | null
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface Props {
  trip: Trip
  onUploaded?: () => void
}

const MEMBER_COLORS: Record<string, string> = {
  alex: '#1d4ed8',
  itan: '#15803d',
  ami:  '#be123c',
  danil:'#7c3aed',
  assaf:'#b45309',
}

export default function UploadZone({ trip, onUploaded }: Props) {
  const [uploader, setUploader] = useState<string | null>(null)
  const [items, setItems] = useState<UploadItem[]>([])
  const [allDone, setAllDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: FileList | null) {
    if (!files || !files.length) return
    const newItems: UploadItem[] = Array.from(files).map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      progress: 0,
      status: 'pending',
    }))
    setItems(prev => [...prev, ...newItems])
    setAllDone(false)
  }

  async function uploadAll() {
    if (!uploader) return
    const pending = items.filter(it => it.status === 'pending')
    if (!pending.length) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== 'pending') continue
      await uploadOne(i)
    }
    setAllDone(true)
    onUploaded?.()
  }

  async function uploadOne(idx: number) {
    if (!uploader) return
    const item = items[idx]

    setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'uploading', progress: 0 } : it))

    try {
      const file = item.file
      const isLarge = file.size > 3 * 1024 * 1024 // >3MB → presign flow

      if (isLarge) {
        // Step 1: get presigned URL
        const presignRes = await fetch('/api/upload-media/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trip_id: trip.id,
            trip_slug: trip.slug,
            uploader,
            filename: file.name,
            content_type: file.type,
            file_size: file.size,
          }),
        })
        if (!presignRes.ok) throw new Error('Presign failed')
        const { signed_url, media_id } = await presignRes.json()

        // Step 2: upload directly to Supabase with XHR for progress
        await uploadWithProgress(signed_url, file, (pct) => {
          setItems(prev => prev.map((it, i) => i === idx ? { ...it, progress: pct } : it))
        })

        // Step 3: confirm
        await fetch('/api/upload-media/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_id }),
        })
      } else {
        // Direct upload for small files
        const fd = new FormData()
        fd.append('file', file)
        fd.append('trip_id', trip.id)
        fd.append('trip_slug', trip.slug)
        fd.append('uploader', uploader)

        const xhr = new XMLHttpRequest()
        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = e => {
            if (e.lengthComputable) {
              setItems(prev => prev.map((it, i) => i === idx ? { ...it, progress: Math.round(e.loaded / e.total * 100) } : it))
            }
          }
          xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
          xhr.onerror = () => reject(new Error('Network error'))
          xhr.open('POST', '/api/upload-media')
          xhr.send(fd)
        })
      }

      setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'done', progress: 100 } : it))
    } catch (e: unknown) {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'error', error: (e as Error).message } : it))
    }
  }

  function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100))
      }
      xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  }

  const pendingCount = items.filter(it => it.status === 'pending').length
  const uploadingCount = items.filter(it => it.status === 'uploading').length
  const doneCount = items.filter(it => it.status === 'done').length

  return (
    <div className="flex flex-col gap-5">
      {/* Person selector */}
      <div>
        <p className="text-white/60 text-sm mb-2 text-right">מי אתה/את?</p>
        <div className="flex flex-wrap gap-2">
          {FAMILY_MEMBERS.map(m => (
            <button
              key={m.name}
              onClick={() => setUploader(m.name)}
              className="flex-1 min-w-[72px] py-3 rounded-2xl font-black text-sm transition-all active:scale-95"
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

      {/* File picker buttons */}
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

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={e => addFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={e => addFiles(e.target.files)}
      />

      {/* File list */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-2">
              {/* Thumbnail */}
              {item.preview ? (
                <img src={item.preview} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-xl">
                  🎬
                </div>
              )}
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs truncate">{item.file.name}</p>
                <p className="text-white/40 text-xs">{formatBytes(item.file.size)}</p>
                {item.status === 'uploading' && (
                  <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <p className="text-red-400 text-xs mt-0.5">{item.error}</p>
                )}
              </div>
              {/* Status icon */}
              <div className="shrink-0 text-lg">
                {item.status === 'done' && '✅'}
                {item.status === 'uploading' && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {item.status === 'error' && '❌'}
                {item.status === 'pending' && (
                  <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-white/30 hover:text-white/60 text-sm">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {pendingCount > 0 && (
        <button
          onClick={uploadAll}
          disabled={!uploader || uploadingCount > 0}
          className="w-full py-4 rounded-2xl font-black text-base transition-all active:scale-[0.97] disabled:opacity-40"
          style={{ background: uploader ? '#2563eb' : 'rgba(255,255,255,0.1)', color: '#fff' }}
        >
          {uploadingCount > 0
            ? `מעלה... (${doneCount}/${items.length})`
            : `העלה ${pendingCount} קובץ${pendingCount !== 1 ? 'ים' : ''}`}
        </button>
      )}

      {allDone && items.length > 0 && doneCount === items.length && (
        <div className="text-center py-4">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-white font-bold">הועלה בהצלחה!</p>
          <p className="text-white/50 text-sm mt-1">התמונות נוספו לאלבום</p>
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
