'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface GalleryPhoto {
  id: string
  kid_key: string
  photo_url: string
  is_profile: boolean
  label?: string
  created_at: string
}

interface Kid {
  key: string
  name: string
  photo?: string | null
}

interface Props {
  kid: Kid
  onClose: () => void
  onProfileChanged: (kidKey: string, url: string) => void
}

const AI_STYLES = [
  { key: 'cute cartoon', label: '🎨 קריקטורה' },
  { key: 'anime', label: '✨ אנימה' },
  { key: 'watercolor', label: '🖌️ צבעי מים' },
  { key: 'pixel art', label: '👾 פיקסל' },
  { key: 'superhero', label: '🦸 גיבור על' },
  { key: 'sticker', label: '🌟 מדבקה' },
]

const ALL_PEOPLE = [
  { key: 'ami', name: 'אמי', color: '#E91E63' },
  { key: 'alex', name: 'אלכס', color: '#8E24AA' },
  { key: 'itan', name: 'איתן', color: '#43A047' },
  { key: 'assaf', name: 'אסף', color: '#1D4ED8' },
  { key: 'danil', name: 'דניאל', color: '#15803D' },
]

// ── AI Image Card ──────────────────────────────────────────────────────────────

function AIImageCard({ url, fallbackUrl, onKeep, onSkip }: {
  url: string; fallbackUrl?: string; onKeep: () => void; onSkip: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [src, setSrc] = useState(url)

  function handleError() {
    if (src === url && fallbackUrl) {
      setSrc(fallbackUrl) // retry with fallback model
    } else {
      setFailed(true)
    }
  }

  if (failed) return (
    <div className="aspect-square rounded-2xl bg-gray-100 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300">
      <span className="text-3xl">😔</span>
      <span className="text-xs text-gray-400 text-center px-2">לא ניתן לטעון<br/>נסה שוב</span>
      <button onClick={onSkip} className="text-xs text-gray-400 underline">דלג</button>
    </div>
  )

  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-purple-200 shadow-md">
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-blue-100 animate-pulse flex items-center justify-center">
          <span className="text-4xl animate-spin">✨</span>
        </div>
      )}
      <img
        src={src}
        alt="AI variant"
        className={`w-full aspect-square object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
      <div className="flex gap-2 p-2 bg-white/95 border-t border-gray-100">
        <button onClick={onKeep} className="flex-1 py-2 bg-green-500 text-white text-xs font-black rounded-xl">✅ שמור</button>
        <button onClick={onSkip} className="flex-1 py-2 bg-red-400 text-white text-xs font-black rounded-xl">✕ דלג</button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function KidPhotoGallery({ kid, onClose, onProfileChanged }: Props) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [aiStyle, setAiStyle] = useState('cute cartoon')
  const [generating, setGenerating] = useState(false)
  const [variants, setVariants] = useState<string[]>([])
  const [fallbacks, setFallbacks] = useState<string[]>([])
  const [aiPrompt, setAiPrompt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState<string | null>(null)
  const [batchFiles, setBatchFiles] = useState<Array<{file: File; objectUrl: string; assignTo: string}>>([])
  const [batchUploading, setBatchUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (folderRef.current) folderRef.current.setAttribute('webkitdirectory', '')
  }, [])

  const loadPhotos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kid-profiles?kid=${kid.key}`)
      if (res.ok) setPhotos(await res.json())
    } finally { setLoading(false) }
  }, [kid.key])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  async function generateAI() {
    setGenerating(true)
    setVariants([])
    setFallbacks([])
    try {
      const res = await fetch('/api/generate-kid-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kidName: kid.name, style: aiStyle }),
      })
      const data = await res.json()
      setVariants(data.variants || [])
      setFallbacks(data.fallbacks || [])
      setAiPrompt(data.prompt || '')
    } finally { setGenerating(false) }
  }

  async function keepVariant(variantUrl: string, index: number) {
    setUploading(true)
    try {
      // Download via server-side proxy (avoids CORS), then upload to our storage
      let savedUrl = variantUrl
      try {
        const proxyRes = await fetch('/api/proxy-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: variantUrl }),
        })
        if (proxyRes.ok) {
          const blob = await proxyRes.blob()
          const fd = new FormData()
          fd.append('file', new File([blob], `ai-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }))
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
          if (uploadRes.ok) {
            const { url: storedUrl } = await uploadRes.json()
            if (storedUrl) savedUrl = storedUrl
          }
        }
      } catch { /* keep original URL as fallback */ }

      const res = await fetch('/api/kid-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kid_key: kid.key, photo_url: savedUrl, set_as_profile: photos.length === 0 }),
      })
      if (res.ok) {
        const newPhoto = await res.json()
        setPhotos(prev => [newPhoto, ...prev])
        if (photos.length === 0) onProfileChanged(kid.key, savedUrl)
        setVariants(prev => prev.filter((_, j) => j !== index))
        setFallbacks(prev => prev.filter((_, j) => j !== index))
      }
    } finally { setUploading(false) }
  }

  function skipVariant(index: number) {
    setVariants(prev => prev.filter((_, j) => j !== index))
    setFallbacks(prev => prev.filter((_, j) => j !== index))
  }

  async function setAsProfile(photo: GalleryPhoto) {
    await fetch('/api/kid-profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: photo.id, is_profile: true }),
    })
    setPhotos(prev => prev.map(p => ({ ...p, is_profile: p.id === photo.id })))
    onProfileChanged(kid.key, photo.photo_url)
  }

  async function deletePhoto(photo: GalleryPhoto) {
    await fetch(`/api/kid-profiles?id=${photo.id}`, { method: 'DELETE' })
    setPhotos(prev => {
      const remaining = prev.filter(p => p.id !== photo.id)
      if (photo.is_profile && remaining.length > 0) {
        setAsProfile(remaining[0])
      }
      return remaining
    })
  }

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json()
        const postRes = await fetch('/api/kid-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kid_key: kid.key, photo_url: url, set_as_profile: photos.length === 0 }),
        })
        if (postRes.ok) {
          const newPhoto = await postRes.json()
          setPhotos(prev => [newPhoto, ...prev])
          if (photos.length === 0) onProfileChanged(kid.key, url)
        }
      }
    } finally { setUploading(false) }
  }

  function onMultiFileSelect(files: FileList) {
    const items = Array.from(files).filter(f => f.type.startsWith('image/')).map(f => ({
      file: f,
      objectUrl: URL.createObjectURL(f),
      assignTo: kid.key,
    }))
    setBatchFiles(items)
  }

  async function uploadBatch() {
    setBatchUploading(true)
    try {
      for (const item of batchFiles) {
        const fd = new FormData()
        fd.append('file', item.file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const { url } = await res.json()
          await fetch('/api/kid-profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kid_key: item.assignTo, photo_url: url }),
          })
        }
      }
      batchFiles.forEach(f => URL.revokeObjectURL(f.objectUrl))
      setBatchFiles([])
      await loadPhotos()
    } finally { setBatchUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
          style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
          <h2 className="text-white font-black text-lg">🖼️ אלבום תמונות — {kid.name}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 text-white font-bold hover:bg-white/30 transition flex items-center justify-center">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-5" dir="rtl">

          {/* AI Generator Section */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-4 border border-purple-100">
            <p className="font-black text-purple-800 text-sm mb-3">🤖 צור תמונה עם AI</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {AI_STYLES.map(s => (
                <button key={s.key} onClick={() => setAiStyle(s.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition border-2 ${
                    aiStyle === s.key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-400'
                  }`}>{s.label}</button>
              ))}
            </div>
            <button onClick={generateAI} disabled={generating}
              className="w-full py-3 rounded-2xl text-white font-black text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: generating ? '#ccc' : 'linear-gradient(135deg,#667eea,#764ba2)' }}>
              {generating ? (
                <><span className="animate-spin">⏳</span> יוצר תמונות איכותיות...</>
              ) : '✨ צור 6 תמונות AI'}
            </button>
            {aiPrompt && <p className="text-[10px] text-purple-500 mt-2 leading-relaxed">{aiPrompt}</p>}
          </div>

          {/* AI Variants — keep or dismiss each */}
          {variants.length > 0 && (
            <div>
              <p className="font-black text-gray-700 text-sm mb-3">👆 שמור תמונות שאהבת</p>
              <div className="grid grid-cols-2 gap-3">
                {variants.map((url, i) => (
                  <AIImageCard
                    key={`${url}-${i}`}
                    url={url}
                    fallbackUrl={fallbacks[i]}
                    onKeep={() => keepVariant(url, i)}
                    onSkip={() => skipVariant(i)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upload — single and folder/multi */}
          <div className="space-y-2">
            {/* Single file input */}
            <input type="file" accept="image/*" className="hidden" ref={fileRef}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
            {/* Multi file input */}
            <input type="file" multiple accept="image/*" className="hidden" ref={folderRef}
              onChange={e => { if (e.target.files && e.target.files.length > 0) onMultiFileSelect(e.target.files) }} />

            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex-1 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-600 font-bold text-sm hover:border-purple-400 hover:text-purple-600 transition disabled:opacity-50">
                {uploading ? '⏳ מעלה...' : '📷 תמונה אחת'}
              </button>
              <button onClick={() => folderRef.current?.click()} disabled={uploading || batchUploading}
                className="flex-1 py-3 rounded-2xl border-2 border-dashed border-blue-300 text-blue-600 font-bold text-sm hover:border-blue-500 hover:text-blue-700 transition disabled:opacity-50">
                📁 העלה תיקיה / מספר תמונות
              </button>
            </div>
          </div>

          {/* Batch Assignment UI */}
          {batchFiles.length > 0 && (
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
              <p className="font-black text-blue-800 text-sm mb-3">📁 הקצאת תמונות ({batchFiles.length})</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {batchFiles.map((item, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-blue-200 shadow-sm">
                    <img src={item.objectUrl} alt={item.file.name} className="w-full aspect-square object-cover" />
                    <div className="p-2 bg-white">
                      <p className="text-[10px] text-gray-500 truncate mb-1.5">{item.file.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {ALL_PEOPLE.map(person => (
                          <button
                            key={person.key}
                            onClick={() => setBatchFiles(prev => prev.map((f, j) => j === i ? { ...f, assignTo: person.key } : f))}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold transition border"
                            style={{
                              background: item.assignTo === person.key ? person.color : 'transparent',
                              color: item.assignTo === person.key ? 'white' : person.color,
                              borderColor: person.color,
                            }}>
                            {person.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={uploadBatch} disabled={batchUploading}
                  className="flex-1 py-2.5 bg-green-500 text-white text-sm font-black rounded-xl disabled:opacity-50">
                  {batchUploading ? '⏳ מעלה...' : '✅ שמור הכל'}
                </button>
                <button onClick={() => { batchFiles.forEach(f => URL.revokeObjectURL(f.objectUrl)); setBatchFiles([]) }}
                  disabled={batchUploading}
                  className="flex-1 py-2.5 bg-gray-200 text-gray-600 text-sm font-black rounded-xl disabled:opacity-50">
                  ✕ ביטול
                </button>
              </div>
            </div>
          )}

          {/* Saved Gallery */}
          {loading ? (
            <div className="text-center py-8 text-gray-400">⏳ טוען אלבום...</div>
          ) : photos.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">עדיין אין תמונות שמורות<br/>צור תמונה עם AI או העלה תמונה</div>
          ) : (
            <div>
              <p className="font-black text-gray-700 text-sm mb-3">🖼️ תמונות שמורות ({photos.length})</p>
              <div className="grid grid-cols-2 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className={`relative rounded-2xl overflow-hidden border-3 shadow-md transition-all ${
                    photo.is_profile ? 'border-purple-500 ring-2 ring-purple-300' : 'border-gray-200'
                  }`} style={{ borderWidth: photo.is_profile ? 3 : 2 }}>
                    <img src={photo.photo_url} alt="kid photo" className="w-full aspect-square object-cover" />
                    {photo.is_profile && (
                      <div className="absolute top-2 right-2 bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        ✓ פרופיל
                      </div>
                    )}
                    {/* Action bar */}
                    <div className="flex gap-1 p-1.5 bg-white/95 border-t border-gray-100">
                      {!photo.is_profile && (
                        <button onClick={() => setAsProfile(photo)}
                          title="הגדר כתמונת פרופיל"
                          className="flex-1 py-1 bg-purple-100 text-purple-700 text-[11px] font-black rounded-lg hover:bg-purple-200 transition">
                          ⭐ פרופיל
                        </button>
                      )}
                      <button onClick={() => setEditingPhoto(photo.photo_url)}
                        title="ערוך עם צבעים"
                        className="flex-1 py-1 bg-blue-100 text-blue-700 text-[11px] font-black rounded-lg hover:bg-blue-200 transition">
                        🎨 ערוך
                      </button>
                      <button onClick={() => deletePhoto(photo)}
                        title="מחק"
                        className="px-2 py-1 bg-red-100 text-red-600 text-[11px] font-black rounded-lg hover:bg-red-200 transition">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Paint Editor overlay */}
      {editingPhoto && (
        <KidPaintEditor
          imageUrl={editingPhoto}
          kidKey={kid.key}
          onSave={async (url) => {
            const res = await fetch('/api/kid-profiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ kid_key: kid.key, photo_url: url }),
            })
            if (res.ok) {
              const newPhoto = await res.json()
              setPhotos(prev => [newPhoto, ...prev])
            }
            setEditingPhoto(null)
          }}
          onClose={() => setEditingPhoto(null)}
        />
      )}
    </div>
  )
}

// ── Paint Editor ──────────────────────────────────────────────────────────────

interface PaintProps {
  imageUrl: string
  kidKey: string
  onSave: (url: string) => Promise<void>
  onClose: () => void
}

const COLORS = [
  '#EF4444','#F97316','#EAB308','#22C55E','#06B6D4','#3B82F6',
  '#8B5CF6','#EC4899','#FFFFFF','#000000','#6B7280','#92400E',
]
const BRUSH_SIZES = [4, 10, 22]

function KidPaintEditor({ imageUrl, onSave, onClose }: PaintProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState('#EF4444')
  const [brushSize, setBrushSize] = useState(1)
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush')
  const [drawing, setDrawing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<ImageData[]>([])
  const lastPos = useRef<{x:number,y:number}|null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = img.naturalWidth || 1024
      canvas.height = img.naturalHeight || 1024
      ctx.drawImage(img, 0, 0)
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)])
    }
    img.onerror = () => {
      canvas.width = 1024
      canvas.height = 1024
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(0, 0, 1024, 1024)
      ctx.font = '80px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🎨', 512, 512)
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)])
    }
    img.src = imageUrl
  }, [imageUrl])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    setHistory(prev => [...prev.slice(-15), ctx.getImageData(0, 0, canvas.width, canvas.height)])
    setDrawing(true)
    lastPos.current = getPos(e)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color
    ctx.lineWidth = BRUSH_SIZES[brushSize] * (canvas.width / 400)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.stroke()
    lastPos.current = pos
  }

  function endDraw() { setDrawing(false); lastPos.current = null }

  function undo() {
    if (history.length <= 1) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const prev = history[history.length - 2]
    ctx.putImageData(prev, 0, 0)
    setHistory(h => h.slice(0, -1))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const canvas = canvasRef.current!
      const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 0.85))
      const fd = new FormData()
      fd.append('file', blob, `paint-${Date.now()}.jpg`)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json()
        await onSave(url)
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-gray-900"
      style={{ backdropFilter: 'blur(0px)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700 flex-wrap" dir="rtl">
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-600 text-white text-sm font-bold hover:bg-gray-500 transition flex items-center justify-center">✕</button>
        <span className="text-white font-black text-sm">🎨 עריכה חופשית</span>

        <div className="flex gap-1 mr-2">
          <button onClick={() => setTool('brush')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${tool === 'brush' ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-200 hover:bg-gray-500'}`}>
            🖌️ מברשת
          </button>
          <button onClick={() => setTool('eraser')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${tool === 'eraser' ? 'bg-orange-500 text-white' : 'bg-gray-600 text-gray-200 hover:bg-gray-500'}`}>
            🧹 מחק
          </button>
        </div>

        {/* Brush sizes */}
        <div className="flex items-center gap-1 mr-1">
          {BRUSH_SIZES.map((s, i) => (
            <button key={i} onClick={() => setBrushSize(i)}
              className={`rounded-full transition border-2 ${brushSize === i ? 'border-white' : 'border-transparent'}`}
              style={{ width: s + 12, height: s + 12, background: brushSize === i ? '#fff' : '#666' }} />
          ))}
        </div>

        {/* Color palette */}
        <div className="flex gap-1 flex-wrap">
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool('brush') }}
              className={`w-7 h-7 rounded-full transition border-2 hover:scale-110 ${color === c && tool === 'brush' ? 'border-white scale-110' : 'border-gray-500'}`}
              style={{ background: c }} />
          ))}
        </div>

        <div className="flex gap-2 mr-auto">
          <button onClick={undo} disabled={history.length <= 1}
            className="px-3 py-1.5 rounded-xl bg-gray-600 text-white text-xs font-bold hover:bg-gray-500 transition disabled:opacity-40">
            ↩️ ביטול
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 rounded-xl bg-green-500 text-white text-xs font-black hover:bg-green-400 transition disabled:opacity-50">
            {saving ? '⏳ שומר...' : '💾 שמור לאלבום'}
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-900">
        <canvas
          ref={canvasRef}
          className="rounded-2xl shadow-2xl"
          style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 120px)', cursor: tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
    </div>
  )
}
