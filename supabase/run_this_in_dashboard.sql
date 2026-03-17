-- ══════════════════════════════════════════════════════════════════
-- FAMILY SCHEDULER — MIGRATIONS
-- Run this once in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Birthdays & Anniversaries ──────────────────────────────────
CREATE TABLE IF NOT EXISTS birthdays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  birth_year INTEGER,
  type TEXT NOT NULL DEFAULT 'birthday' CHECK (type IN ('birthday', 'anniversary', 'other')),
  emoji TEXT DEFAULT '🎂',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE birthdays ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='birthdays' AND policyname='Service role full access on birthdays')
  THEN CREATE POLICY "Service role full access on birthdays" ON birthdays FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 2. Photo Attachments on Events ────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- ── 3. Event Reactions (emoji) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  person TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, person, emoji)
);
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reactions' AND policyname='Service role full access on reactions')
  THEN CREATE POLICY "Service role full access on reactions" ON reactions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- Done! 3 tables/columns created.
-- ══════════════════════════════════════════════════════════════════
