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
CREATE POLICY "Service role full access on birthdays" ON birthdays
  FOR ALL TO service_role USING (true) WITH CHECK (true);
