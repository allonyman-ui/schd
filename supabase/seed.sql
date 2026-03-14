-- Seed recurring events for the next 3 months
-- Helper: we'll generate dates for each recurring event

-- Alex: Basketball every Tuesday and Thursday 17:00-18:30
INSERT INTO events (title, person, date, start_time, end_time, location, is_recurring, recurrence_days, source)
SELECT
  'כדורסל',
  'alex',
  generate_series::date,
  '17:00',
  '18:30',
  'מגרש כדורסל',
  true,
  ARRAY['tuesday', 'thursday'],
  'manual'
FROM generate_series(
  DATE_TRUNC('week', CURRENT_DATE)::date,
  (CURRENT_DATE + INTERVAL '3 months')::date,
  '1 day'::interval
) AS generate_series
WHERE EXTRACT(DOW FROM generate_series) IN (2, 4); -- Tuesday=2, Thursday=4

-- Itan: Hip-hop every Monday 16:00-17:00
INSERT INTO events (title, person, date, start_time, end_time, location, is_recurring, recurrence_days, source)
SELECT
  'היפ הופ',
  'itan',
  generate_series::date,
  '16:00',
  '17:00',
  'אולפן מחול',
  true,
  ARRAY['monday'],
  'manual'
FROM generate_series(
  DATE_TRUNC('week', CURRENT_DATE)::date,
  (CURRENT_DATE + INTERVAL '3 months')::date,
  '1 day'::interval
) AS generate_series
WHERE EXTRACT(DOW FROM generate_series) = 1; -- Monday=1

-- Ami: Swimming every Wednesday 16:30-17:30
INSERT INTO events (title, person, date, start_time, end_time, location, is_recurring, recurrence_days, source)
SELECT
  'שחייה',
  'ami',
  generate_series::date,
  '16:30',
  '17:30',
  'בריכה עירונית',
  true,
  ARRAY['wednesday'],
  'manual'
FROM generate_series(
  DATE_TRUNC('week', CURRENT_DATE)::date,
  (CURRENT_DATE + INTERVAL '3 months')::date,
  '1 day'::interval
) AS generate_series
WHERE EXTRACT(DOW FROM generate_series) = 3; -- Wednesday=3

-- All kids: English lessons every Sunday 15:00-16:00
INSERT INTO events (title, person, date, start_time, end_time, location, is_recurring, recurrence_days, source)
SELECT
  'אנגלית',
  person_name,
  generate_series::date,
  '15:00',
  '16:00',
  'חדר לימודים',
  true,
  ARRAY['sunday'],
  'manual'
FROM generate_series(
  DATE_TRUNC('week', CURRENT_DATE)::date,
  (CURRENT_DATE + INTERVAL '3 months')::date,
  '1 day'::interval
) AS generate_series,
(VALUES ('alex'), ('itan'), ('ami')) AS persons(person_name)
WHERE EXTRACT(DOW FROM generate_series) = 0; -- Sunday=0
