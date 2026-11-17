-- ==============================================================================
-- Seed: supabase/seed.sql
-- Description: Initial checkpoints, default access windows, and system settings
-- ==============================================================================

-- 1. Default Checkpoints
insert into checkpoints (id, name, type, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'Central Library Main Gate (Both)', 'LIBRARY_BOTH', true),
  ('22222222-2222-2222-2222-222222222222', 'North Turnstile Entrance (Entry Only)', 'LIBRARY_ENTRY', true),
  ('33333333-3333-3333-3333-333333333333', 'South Turnstile Exit (Exit Only)', 'LIBRARY_EXIT', true)
on conflict (name) do nothing;

-- 2. Default Access Windows (Asia/Kolkata IST)
-- Student: 17:00 to 23:30
-- Scanner: 16:00 to 23:59
-- Admin: 00:00 to 23:59 (never locked out)
insert into access_windows (role, day_of_week, open_time, close_time, is_active) values
  ('student', null, '17:00', '23:30', true),
  ('scanner', null, '16:00', '23:59', true),
  ('admin', null, '00:00', '23:59', true)
on conflict do nothing;

-- 3. Core App Settings
insert into app_settings (key, value) values
  ('max_stay_minutes', '360'::jsonb),
  ('duplicate_scan_window_seconds', '10'::jsonb),
  ('library_closing_time', '"23:30"'::jsonb),
  ('retention_days_movement', '180'::jsonb),
  ('retention_days_audit', '365'::jsonb),
  ('feature_flags', '{"rotating_qr": true, "offline_queue": true, "notifications": true}'::jsonb)
on conflict (key) do update set value = excluded.value;
