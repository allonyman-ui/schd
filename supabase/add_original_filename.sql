-- ══════════════════════════════════════════════════════════════════
-- ADD original_filename COLUMN
-- Run in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════
-- Stores the original file name from the user's device (e.g. "IMG_1234.jpg").
-- iPhone always assigns the same name to the same photo regardless of
-- HEIC→JPEG conversion, making this the most reliable dedup key for iOS.
ALTER TABLE trip_media ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Index for fast uploader+filename lookups
CREATE INDEX IF NOT EXISTS trip_media_uploader_filename_idx
  ON trip_media (trip_id, uploader, original_filename)
  WHERE original_filename IS NOT NULL AND status != 'deleted';
