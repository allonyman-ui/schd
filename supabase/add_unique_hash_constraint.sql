-- ══════════════════════════════════════════════════════════════════
-- UNIQUE HASH CONSTRAINT + ORPHAN CLEANUP
-- Run in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- 1. Clean up orphaned 'pending' rows older than 10 minutes.
--    These are uploads that started but never finished (network error,
--    browser closed, etc.). They block legitimate re-uploads of the same file.
UPDATE trip_media
SET status = 'deleted'
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '10 minutes';

-- 2. Add a partial unique index so Postgres atomically rejects a second
--    insert of the same (trip_id, file_hash) pair.
--    This is the ONLY bulletproof fix for the concurrent-upload race condition:
--    even if 6 workers call presign at the exact same millisecond, only one
--    INSERT will succeed — the rest get a unique-violation error (code 23505)
--    which the app handles by returning { duplicate: true }.
CREATE UNIQUE INDEX IF NOT EXISTS trip_media_unique_hash
  ON trip_media (trip_id, file_hash)
  WHERE file_hash IS NOT NULL
    AND status IN ('ready', 'pending');

-- 3. Also ensure we can efficiently look up pending rows by hash
--    (the race-condition check in findByHash needs this to be fast).
CREATE INDEX IF NOT EXISTS trip_media_hash_status_idx
  ON trip_media (trip_id, file_hash, status)
  WHERE file_hash IS NOT NULL;
