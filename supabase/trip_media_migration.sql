-- ══════════════════════════════════════════════════════════════════
-- TRIP MEDIA — MIGRATION
-- Run in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── Trip Albums ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  cover_url   TEXT,
  starts_on   DATE,
  ends_on     DATE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trips' AND policyname='Service role full access on trips')
  THEN CREATE POLICY "Service role full access on trips" ON trips FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Media Items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_media (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  uploader      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  public_url    TEXT NOT NULL,
  media_type    TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  mime_type     TEXT,
  file_size     INTEGER,
  width         INTEGER,
  height        INTEGER,
  duration_sec  FLOAT,
  caption       TEXT,
  taken_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready', 'deleted')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trip_media_trip_idx     ON trip_media(trip_id, status);
CREATE INDEX IF NOT EXISTS trip_media_uploader_idx ON trip_media(trip_id, uploader);
CREATE INDEX IF NOT EXISTS trip_media_taken_idx    ON trip_media(trip_id, taken_at DESC);

ALTER TABLE trip_media ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trip_media' AND policyname='Service role full access on trip_media')
  THEN CREATE POLICY "Service role full access on trip_media" ON trip_media FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Media Reactions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_reactions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id   UUID NOT NULL REFERENCES trip_media(id) ON DELETE CASCADE,
  person     TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(media_id, person, emoji)
);

ALTER TABLE media_reactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='media_reactions' AND policyname='Service role full access on media_reactions')
  THEN CREATE POLICY "Service role full access on media_reactions" ON media_reactions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Seed: Athens 2026 trip ────────────────────────────────────────
INSERT INTO trips (slug, title, description, starts_on, ends_on)
VALUES ('athens-2026', 'טיול אתונה 2026', 'שמונה ימים ביוון המדהימה', '2026-03-26', '2026-04-03')
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- STORAGE BUCKET
-- Also run this to create the trip-media bucket:
-- ══════════════════════════════════════════════════════════════════
-- Go to Supabase Dashboard → Storage → New Bucket
-- Name: trip-media
-- Public: YES
-- Or the app will create it automatically on first upload.
-- ══════════════════════════════════════════════════════════════════
