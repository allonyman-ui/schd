-- ══════════════════════════════════════════════════════════════════
-- ADD LOCATION + METADATA FIELDS TO trip_media
-- Run in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS latitude      FLOAT;
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS longitude     FLOAT;
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS location_name TEXT;
