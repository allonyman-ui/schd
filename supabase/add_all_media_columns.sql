-- ══════════════════════════════════════════════════════════════════
-- ADD ALL MISSING COLUMNS TO trip_media
-- Run in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- Location + GPS
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS latitude      FLOAT;
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS longitude     FLOAT;
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS location_name TEXT;

-- File dimensions + hash
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS width         INTEGER;
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS height        INTEGER;
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS file_hash     TEXT;
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS file_size     BIGINT;
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS duration_sec  FLOAT;

-- Index for fast duplicate detection
CREATE INDEX IF NOT EXISTS trip_media_hash_idx
  ON trip_media (trip_id, file_hash)
  WHERE file_hash IS NOT NULL AND status = 'ready';
