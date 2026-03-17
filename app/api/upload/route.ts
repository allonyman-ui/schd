import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const BUCKET = 'event-attachments'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() || 'bin'
  const path = `${randomUUID()}.${ext}`

  const supabase = createServiceClient()

  // Ensure bucket exists (public)
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === BUCKET)

  if (!bucketExists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (createError && !createError.message.includes('already exists')) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: urlData.publicUrl })
}
