-- ══════════════════════════════════════════════════════════════════
-- FAMILY SCHEDULER — MIGRATIONS
-- Run this once in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── 0. Kid profile photos ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kid_profiles (
  key TEXT PRIMARY KEY,
  photo_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE kid_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kid_profiles' AND policyname='Service role full access on kid_profiles')
  THEN CREATE POLICY "Service role full access on kid_profiles" ON kid_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 1. Optional columns on Events ─────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS completed      BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_link   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- ── 2. Event Reactions (emoji) ────────────────────────────────────
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

-- ── 3. Reminders table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE,
  person TEXT,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reminders' AND policyname='Service role full access on reminders')
  THEN CREATE POLICY "Service role full access on reminders" ON reminders FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 4. Auto-migration helper (lets the app self-heal) ─────────────
-- This function is called by /api/setup so the app can apply future
-- migrations without manual SQL runs.
CREATE OR REPLACE FUNCTION run_migrations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE events ADD COLUMN IF NOT EXISTS completed      BOOLEAN DEFAULT false;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_link   TEXT;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS attachment_url TEXT;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- Done! Run this once, then the app handles future migrations itself.
-- ══════════════════════════════════════════════════════════════════
