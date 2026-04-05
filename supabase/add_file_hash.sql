-- ══════════════════════════════════════════════════════════════════
-- ADD file_hash COLUMN FOR DUPLICATE DETECTION
-- Run in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Index for fast duplicate lookup
CREATE INDEX IF NOT EXISTS trip_media_hash_idx
  ON trip_media(trip_id, file_hash)
  WHERE file_hash IS NOT NULL AND status = 'ready';
