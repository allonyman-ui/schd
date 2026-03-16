import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Returns the 20 most recent batches from all sources (WhatsApp, email, manual)
// Excludes [PENDING] records (clarification state)
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_batches')
    .select('id, raw_text, processed_events, created_at')
    .not('raw_text', 'like', '[PENDING%')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
