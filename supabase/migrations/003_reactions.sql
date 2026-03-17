CREATE TABLE IF NOT EXISTS reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  person TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, person, emoji)
);
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on reactions" ON reactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
