import { createClient } from '@supabase/supabase-js'

// Lazy browser client — created on first call so env vars are available at runtime
let _browserClient: ReturnType<typeof createClient> | null = null
export function getSupabaseBrowserClient() {
  if (!_browserClient) {
    _browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _browserClient
}

// Keep named export for any existing imports
export const supabase = { get: getSupabaseBrowserClient }

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
