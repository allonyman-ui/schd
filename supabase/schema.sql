-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  person TEXT NOT NULL CHECK (person IN ('alex', 'itan', 'ami', 'danil', 'assaf')),
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  notes TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_days TEXT[],
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'whatsapp')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp batches table
CREATE TABLE IF NOT EXISTS whatsapp_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_text TEXT NOT NULL,
  processed_events JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS events_date_idx ON events(date);
CREATE INDEX IF NOT EXISTS events_person_idx ON events(person);
CREATE INDEX IF NOT EXISTS events_person_date_idx ON events(person, date);

-- RLS Policies (disable for service role usage)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_batches ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on events" ON events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on batches" ON whatsapp_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);
