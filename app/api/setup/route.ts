import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MANUAL_SQL = `-- Run this in Supabase Dashboard → SQL Editor → New Query
ALTER TABLE events ADD COLUMN IF NOT EXISTS completed      BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_link   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- After running the above, also run the migration helper so the app self-heals:
CREATE OR REPLACE FUNCTION run_migrations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  ALTER TABLE events ADD COLUMN IF NOT EXISTS completed      BOOLEAN DEFAULT false;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_link   TEXT;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS attachment_url TEXT;
END;
$$;`

export async function GET() {
  const supabase = createServiceClient()

  // Try calling run_migrations() — it's idempotent (IF NOT EXISTS), safe to repeat
  const { error } = await supabase.rpc('run_migrations' as never)

  if (!error) {
    return NextResponse.json({
      ok: true,
      message: '✅ Migration applied — all columns exist.',
    })
  }

  // run_migrations() not found → need one-time manual step
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace('https://', '').replace('.supabase.co', '')

  return NextResponse.json(
    {
      ok: false,
      message:
        'The run_migrations() function is not yet installed. ' +
        'Please copy the SQL below and run it once in your Supabase Dashboard → SQL Editor.',
      dashboardUrl: `https://supabase.com/dashboard/project/${ref}/sql/new`,
      sql: MANUAL_SQL,
    },
    { status: 503 }
  )
}
