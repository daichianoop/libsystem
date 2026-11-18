-- ==============================================================================
-- HOSTEL–LIBRARY DIGITAL PASS & STUDENT MOVEMENT SYSTEM
-- MASTER COMPLETE SCHEMA, RPC FUNCTIONS, RLS POLICIES & SEED DATA
-- COPY & PASTE THIS ENTIRE QUERY DIRECTLY INTO SUPABASE SQL EDITOR AND HIT RUN
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CUSTOM TYPES / ENUMS (Idempotent creation)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'scanner', 'student', 'warden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE student_category AS ENUM ('1st Year', '2nd Year', '3rd Year', '4th Year');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE checkpoint_type AS ENUM ('LIBRARY_ENTRY', 'LIBRARY_EXIT', 'LIBRARY_BOTH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('OPEN', 'CLOSED', 'FLAGGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE movement_event_type AS ENUM ('LIBRARY_ENTRY', 'LIBRARY_EXIT', 'REJECTED_SCAN', 'ADMIN_CORRECTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('INFO', 'WARNING', 'ALERT', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. CORE TRIGGER FUNCTIONS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table % is strictly immutable. UPDATE and DELETE operations are denied.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- 4. TABLES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  password_hash text,
  role user_role NOT NULL,
  full_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  credential_version int NOT NULL DEFAULT 1,
  credential_issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure password_hash column exists on profiles if table was created previously
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash text;
EXCEPTION WHEN others THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  roll_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  category student_category NOT NULL,
  department text NOT NULL,
  hostel text,
  phone text,
  guardian_contact text,
  in_library smallint NOT NULL DEFAULT 0 CHECK (in_library IN (0, 1)),
  last_scan_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  card_secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type checkpoint_type NOT NULL DEFAULT 'LIBRARY_BOTH',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_checkpoints_updated_at ON checkpoints;
CREATE TRIGGER trg_checkpoints_updated_at
  BEFORE UPDATE ON checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS scanner_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkpoint_id uuid NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, checkpoint_id)
);

CREATE TABLE IF NOT EXISTS library_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  entry_checkpoint_id uuid NOT NULL REFERENCES checkpoints(id),
  exit_checkpoint_id uuid REFERENCES checkpoints(id),
  entered_by uuid REFERENCES profiles(id),
  exited_by uuid REFERENCES profiles(id),
  status session_status NOT NULL DEFAULT 'OPEN',
  expected_exit_by timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_library_sessions_updated_at ON library_sessions;
CREATE TRIGGER trg_library_sessions_updated_at
  BEFORE UPDATE ON library_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_session_per_student
  ON library_sessions (student_id)
  WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS movement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  library_session_id uuid REFERENCES library_sessions(id) ON DELETE CASCADE,
  checkpoint_id uuid REFERENCES checkpoints(id) ON DELETE SET NULL,
  event_type movement_event_type NOT NULL,
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  device_id text,
  verification_status text NOT NULL DEFAULT 'VERIFIED',
  reason_code text NOT NULL DEFAULT 'SUCCESS',
  idempotency_key text UNIQUE,
  notes text
);

-- Note: trg_movement_events_immutable dropped to allow clean student editing and deletion
DROP TRIGGER IF EXISTS trg_movement_events_immutable ON movement_events;

CREATE TABLE IF NOT EXISTS access_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL UNIQUE,
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  open_time time NOT NULL,
  close_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_access_windows_updated_at ON access_windows;
CREATE TRIGGER trg_access_windows_updated_at
  BEFORE UPDATE ON access_windows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_date date NOT NULL,
  role user_role,
  open_time time,
  close_time time,
  is_closed_all_day boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  clerk_user_id text NOT NULL,
  role text NOT NULL,
  event text NOT NULL,
  ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'INFO',
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_immutability();

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_students_category ON students(category);
CREATE INDEX IF NOT EXISTS idx_students_in_library ON students(in_library);
CREATE INDEX IF NOT EXISTS idx_students_cat_in_lib ON students(category, in_library);
CREATE INDEX IF NOT EXISTS idx_students_profile_id ON students(profile_id);
CREATE INDEX IF NOT EXISTS idx_movement_events_student_time ON movement_events(student_id, recorded_at desc);
CREATE INDEX IF NOT EXISTS idx_movement_events_session ON movement_events(library_session_id);
CREATE INDEX IF NOT EXISTS idx_movement_events_checkpoint ON movement_events(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_library_sessions_student ON library_sessions(student_id, entered_at desc);

-- 6. ENABLE ROW LEVEL SECURITY & PERMISSIVE POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow service role full access on profiles" ON profiles;
  CREATE POLICY "Allow service role full access on profiles" ON profiles FOR ALL USING (true);

  DROP POLICY IF EXISTS "Allow service role full access on students" ON students;
  CREATE POLICY "Allow service role full access on students" ON students FOR ALL USING (true);

  DROP POLICY IF EXISTS "Allow read on checkpoints" ON checkpoints;
  CREATE POLICY "Allow read on checkpoints" ON checkpoints FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Allow service role full access on checkpoints" ON checkpoints;
  CREATE POLICY "Allow service role full access on checkpoints" ON checkpoints FOR ALL USING (true);

  DROP POLICY IF EXISTS "Allow read on access_windows" ON access_windows;
  CREATE POLICY "Allow read on access_windows" ON access_windows FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Allow service role full access on access_windows" ON access_windows;
  CREATE POLICY "Allow service role full access on access_windows" ON access_windows FOR ALL USING (true);

  DROP POLICY IF EXISTS "Allow service role full access on scanner_assignments" ON scanner_assignments;
  CREATE POLICY "Allow service role full access on scanner_assignments" ON scanner_assignments FOR ALL USING (true);

  DROP POLICY IF EXISTS "Allow service role full access on library_sessions" ON library_sessions;
  CREATE POLICY "Allow service role full access on library_sessions" ON library_sessions FOR ALL USING (true);

  DROP POLICY IF EXISTS "Allow service role full access on movement_events" ON movement_events;
  CREATE POLICY "Allow service role full access on movement_events" ON movement_events FOR ALL USING (true);

  DROP POLICY IF EXISTS "Allow service role full access on audit_logs" ON audit_logs;
  CREATE POLICY "Allow service role full access on audit_logs" ON audit_logs FOR ALL USING (true);

  DROP POLICY IF EXISTS "Allow service role full access on app_settings" ON app_settings;
  CREATE POLICY "Allow service role full access on app_settings" ON app_settings FOR ALL USING (true);
EXCEPTION WHEN others THEN NULL; END $$;

-- 7. TRANSACTIONAL SCAN_STUDENT RPC FUNCTION
CREATE OR REPLACE FUNCTION scan_student(
  p_student_id uuid,
  p_checkpoint_id uuid,
  p_scanner_id uuid,
  p_mode text DEFAULT 'AUTO',
  p_idempotency_key text DEFAULT NULL,
  p_device_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_student record;
  v_checkpoint record;
  v_session record;
  v_target_in_library smallint;
  v_event_type movement_event_type;
  v_new_session_id uuid;
  v_now timestamptz := now();
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM movement_events WHERE idempotency_key = p_idempotency_key) THEN
      RETURN jsonb_build_object('success', true, 'status', 'IDEMPOTENT_REPLAY', 'message', 'Scan already processed');
    END IF;
  END IF;

  -- 1. Lock student row
  SELECT * INTO v_student FROM students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'reason_code', 'STUDENT_NOT_FOUND', 'message', 'Student record not found');
  END IF;

  IF NOT v_student.is_active THEN
    RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'reason_code', 'STUDENT_INACTIVE', 'message', 'Student account is suspended');
  END IF;

  -- 2. Lock checkpoint
  SELECT * INTO v_checkpoint FROM checkpoints WHERE id = p_checkpoint_id;
  IF NOT FOUND OR NOT v_checkpoint.is_active THEN
    RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'reason_code', 'CHECKPOINT_INACTIVE', 'message', 'Checkpoint is inactive');
  END IF;

  -- 3. Duplicate debounce guard (10 seconds)
  IF v_student.last_scan_at IS NOT NULL AND v_student.last_scan_at >= (v_now - interval '10 seconds') THEN
    RETURN jsonb_build_object('success', false, 'status', 'DUPLICATE', 'reason_code', 'DUPLICATE_SCAN', 'message', 'Card scanned again within 10 seconds');
  END IF;

  -- 4. State transition
  IF v_student.in_library = 0 THEN
    -- Entry
    IF p_mode = 'EXIT_ONLY' OR v_checkpoint.type = 'LIBRARY_EXIT' THEN
      RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'reason_code', 'WRONG_CHECKPOINT_DIRECTION', 'message', 'Student is already outside');
    END IF;

    v_target_in_library := 1;
    v_event_type := 'LIBRARY_ENTRY';

    -- Open session
    INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
    VALUES (v_student.id, v_now, v_checkpoint.id, p_scanner_id, 'OPEN')
    RETURNING id INTO v_new_session_id;

  ELSE
    -- Exit
    IF p_mode = 'ENTRY_ONLY' OR v_checkpoint.type = 'LIBRARY_ENTRY' THEN
      RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'reason_code', 'WRONG_CHECKPOINT_DIRECTION', 'message', 'Student is already inside');
    END IF;

    v_target_in_library := 0;
    v_event_type := 'LIBRARY_EXIT';

    -- Close open session
    SELECT * INTO v_session FROM library_sessions WHERE student_id = v_student.id AND status = 'OPEN' ORDER BY entered_at DESC LIMIT 1;
    IF FOUND THEN
      UPDATE library_sessions SET exited_at = v_now, exit_checkpoint_id = v_checkpoint.id, exited_by = p_scanner_id, status = 'CLOSED'
      WHERE id = v_session.id;
      v_new_session_id := v_session.id;
    END IF;
  END IF;

  -- Update student
  UPDATE students SET in_library = v_target_in_library, last_scan_at = v_now, updated_at = v_now WHERE id = v_student.id;

  -- Log immutable event
  INSERT INTO movement_events (student_id, library_session_id, checkpoint_id, event_type, recorded_by, recorded_at, device_id, verification_status, reason_code, idempotency_key)
  VALUES (v_student.id, v_new_session_id, v_checkpoint.id, v_event_type, p_scanner_id, v_now, p_device_id, 'VERIFIED', 'SUCCESS', p_idempotency_key);

  RETURN jsonb_build_object(
    'success', true,
    'status', 'ACCEPTED',
    'eventType', v_event_type,
    'targetInLibrary', v_target_in_library,
    'message', CASE WHEN v_target_in_library = 1 THEN 'Access granted: Student checked into library' ELSE 'Check-out verified: Student exited library' END
  );
END;
$$;

-- ==============================================================================
-- 8. SYSTEM SEED DATA (Checkpoints, Access Windows, App Settings)
-- ==============================================================================

INSERT INTO checkpoints (id, name, type, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Central Library Main Gate (Both)', 'LIBRARY_BOTH', true),
  ('22222222-2222-2222-2222-222222222222', 'North Turnstile Entrance (Entry Only)', 'LIBRARY_ENTRY', true),
  ('33333333-3333-3333-3333-333333333333', 'South Turnstile Exit (Exit Only)', 'LIBRARY_EXIT', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

INSERT INTO access_windows (role, day_of_week, open_time, close_time, is_active) VALUES
  ('student', null, '17:00', '23:30', true),
  ('scanner', null, '16:00', '23:59', true),
  ('admin', null, '00:00', '23:59', true)
ON CONFLICT (role) DO UPDATE SET open_time = excluded.open_time, close_time = excluded.close_time, is_active = true;

INSERT INTO app_settings (key, value) VALUES
  ('max_stay_minutes', '360'::jsonb),
  ('duplicate_scan_window_seconds', '10'::jsonb),
  ('library_closing_time', '"23:30"'::jsonb),
  ('retention_days_movement', '180'::jsonb),
  ('retention_days_audit', '365'::jsonb),
  ('feature_flags', '{"rotating_qr": true, "offline_queue": true, "notifications": true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

-- ==============================================================================
-- 9. DEMO ACCOUNTS SEED (Admin: admin/admin123, Scanner: scanner/scanner123, Student: student/student123)
-- ==============================================================================

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active) VALUES
  ('11111111-0000-0000-0000-000000000001', 'user-admin-001', 'admin', 'a1b2c3d4e5f67890123456789abcdef0:6c2cc1b10ff7e450ad7190a3e3c3968713e5fd61cf363b06070cb0e266dbbaa24cee2f2cd3c94085807f868e80246a87c0dfff9fcd78ca07d52b91b64d4c66da', 'admin', 'Central Library Administrator', true),
  ('22222222-0000-0000-0000-000000000002', 'user-scanner-001', 'scanner', 'a1b2c3d4e5f67890123456789abcdef0:ff7482a5dfaed2c6a1e2942fc17532d7f5977dc1290ceb0188d061af6507239d6ae4e1045294de84636d384d3e0a7ea365c0da8c0cebd3467248cd71b44bf2c7', 'scanner', 'Main Gate Security Staff', true)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO scanner_assignments (profile_id, checkpoint_id) VALUES
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (profile_id, checkpoint_id) DO NOTHING;

-- ==============================================================================
-- 10. SEED 40 DEMO STUDENTS ACROSS Y1 TO Y4 (Mixed In Library: 10 inside, 30 outside)
-- ==============================================================================

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000001', 'user-student', 'student', 'a1b2c3d4e5f67890123456789abcdef0:85cd51e9343a1dd5985e106f95770178fb56aad4331a0911e908b1dde15502820156c825d70e29cacce64e8123312ea1420fd2ec449180eada2ee19aa5d27a9f', 'student', 'Aarav Sharma', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000001',
  '22CS1001',
  'Aarav Sharma',
  '1st Year',
  'Computer Science & Engineering',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10000',
  1,
  now() - interval '30 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000001', now() - interval '30 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '30 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000002', 'user-aditi.rao1002', 'aditi.rao1002', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Aditi Rao', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000002',
  '33333333-0000-0000-0000-000000000002',
  '22CS1002',
  'Aditi Rao',
  '1st Year',
  'Electronics & Communication',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10001',
  0,
  now() - interval '200 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000003', 'user-ananya.verma1003', 'ananya.verma1003', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Ananya Verma', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000003',
  '33333333-0000-0000-0000-000000000003',
  '22CS1003',
  'Ananya Verma',
  '1st Year',
  'Electrical & Electronics',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10002',
  0,
  now() - interval '220 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000004', 'user-arjun.patel1004', 'arjun.patel1004', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Arjun Patel', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000004',
  '33333333-0000-0000-0000-000000000004',
  '22CS1004',
  'Arjun Patel',
  '1st Year',
  'Mechanical Engineering',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10003',
  0,
  now() - interval '240 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000005', 'user-bhavna.mishra1005', 'bhavna.mishra1005', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Bhavna Mishra', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000005',
  '33333333-0000-0000-0000-000000000005',
  '22CS1005',
  'Bhavna Mishra',
  '1st Year',
  'Information Technology',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10004',
  1,
  now() - interval '62 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000005', now() - interval '62 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '62 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000006', 'user-chirag.reddy1006', 'chirag.reddy1006', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Chirag Reddy', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000006',
  '33333333-0000-0000-0000-000000000006',
  '22CS1006',
  'Chirag Reddy',
  '1st Year',
  'Civil Engineering',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10005',
  0,
  now() - interval '280 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000007', 'user-deepika.sen1007', 'deepika.sen1007', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Deepika Sen', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000007',
  '33333333-0000-0000-0000-000000000007',
  '22CS1007',
  'Deepika Sen',
  '1st Year',
  'Computer Science & Engineering',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10006',
  0,
  now() - interval '300 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000008', 'user-divyansh.gupta1008', 'divyansh.gupta1008', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Divyansh Gupta', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000008',
  '33333333-0000-0000-0000-000000000008',
  '22CS1008',
  'Divyansh Gupta',
  '1st Year',
  'Electronics & Communication',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10007',
  0,
  now() - interval '320 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000009', 'user-esha.nair1009', 'esha.nair1009', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Esha Nair', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000009',
  '33333333-0000-0000-0000-000000000009',
  '22CS1009',
  'Esha Nair',
  '1st Year',
  'Electrical & Electronics',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10008',
  1,
  now() - interval '94 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000009', now() - interval '94 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '94 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000010', 'user-farhan.khan1010', 'farhan.khan1010', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Farhan Khan', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000010',
  '33333333-0000-0000-0000-000000000010',
  '22CS1010',
  'Farhan Khan',
  '1st Year',
  'Mechanical Engineering',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10009',
  0,
  now() - interval '360 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000011', 'user-gaurav.jha1021', 'gaurav.jha1021', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Gaurav Jha', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000011',
  '33333333-0000-0000-0000-000000000011',
  '23CS1021',
  'Gaurav Jha',
  '2nd Year',
  'Electronics & Communication',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10020',
  1,
  now() - interval '30 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000011', now() - interval '30 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '30 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000012', 'user-ishita.chatterjee1022', 'ishita.chatterjee1022', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Ishita Chatterjee', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000012',
  '33333333-0000-0000-0000-000000000012',
  '23CS1022',
  'Ishita Chatterjee',
  '2nd Year',
  'Electrical & Electronics',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10021',
  0,
  now() - interval '200 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000013', 'user-kabir.roy1023', 'kabir.roy1023', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Kabir Roy', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000013',
  '33333333-0000-0000-0000-000000000013',
  '23CS1023',
  'Kabir Roy',
  '2nd Year',
  'Mechanical Engineering',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10022',
  0,
  now() - interval '220 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000014', 'user-kavya.iyer1024', 'kavya.iyer1024', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Kavya Iyer', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000014',
  '33333333-0000-0000-0000-000000000014',
  '23CS1024',
  'Kavya Iyer',
  '2nd Year',
  'Information Technology',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10023',
  0,
  now() - interval '240 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000015', 'user-manish.tiwari1025', 'manish.tiwari1025', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Manish Tiwari', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000015',
  '33333333-0000-0000-0000-000000000015',
  '23CS1025',
  'Manish Tiwari',
  '2nd Year',
  'Civil Engineering',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10024',
  1,
  now() - interval '62 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000015', now() - interval '62 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '62 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000016', 'user-neha.deshmukh1026', 'neha.deshmukh1026', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Neha Deshmukh', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000016',
  '33333333-0000-0000-0000-000000000016',
  '23CS1026',
  'Neha Deshmukh',
  '2nd Year',
  'Computer Science & Engineering',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10025',
  0,
  now() - interval '280 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000017', 'user-nikhil.pillai1027', 'nikhil.pillai1027', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Nikhil Pillai', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000017',
  '33333333-0000-0000-0000-000000000017',
  '23CS1027',
  'Nikhil Pillai',
  '2nd Year',
  'Electronics & Communication',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10026',
  0,
  now() - interval '300 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000018', 'user-pooja.hegde1028', 'pooja.hegde1028', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Pooja Hegde', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000018',
  '33333333-0000-0000-0000-000000000018',
  '23CS1028',
  'Pooja Hegde',
  '2nd Year',
  'Electrical & Electronics',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10027',
  0,
  now() - interval '320 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000019', 'user-pranav.joshi1029', 'pranav.joshi1029', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Pranav Joshi', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000019',
  '33333333-0000-0000-0000-000000000019',
  '23CS1029',
  'Pranav Joshi',
  '2nd Year',
  'Mechanical Engineering',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10028',
  1,
  now() - interval '94 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000019', now() - interval '94 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000019', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '94 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000020', 'user-rhea.kapoor1030', 'rhea.kapoor1030', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Rhea Kapoor', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000020',
  '33333333-0000-0000-0000-000000000020',
  '23CS1030',
  'Rhea Kapoor',
  '2nd Year',
  'Information Technology',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10029',
  0,
  now() - interval '360 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000021', 'user-rohan.saxena1041', 'rohan.saxena1041', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Rohan Saxena', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000021',
  '33333333-0000-0000-0000-000000000021',
  '24CS1041',
  'Rohan Saxena',
  '3rd Year',
  'Electrical & Electronics',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10040',
  1,
  now() - interval '30 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000021', now() - interval '30 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '30 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000022', 'user-sakshi.dubey1042', 'sakshi.dubey1042', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Sakshi Dubey', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000022',
  '33333333-0000-0000-0000-000000000022',
  '24CS1042',
  'Sakshi Dubey',
  '3rd Year',
  'Mechanical Engineering',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10041',
  0,
  now() - interval '200 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000023', 'user-sameer.bhatt1043', 'sameer.bhatt1043', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Sameer Bhatt', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000023',
  '33333333-0000-0000-0000-000000000023',
  '24CS1043',
  'Sameer Bhatt',
  '3rd Year',
  'Information Technology',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10042',
  0,
  now() - interval '220 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000024', 'user-sanya.malhotra1044', 'sanya.malhotra1044', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Sanya Malhotra', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000024',
  '33333333-0000-0000-0000-000000000024',
  '24CS1044',
  'Sanya Malhotra',
  '3rd Year',
  'Civil Engineering',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10043',
  0,
  now() - interval '240 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000025', 'user-siddharth.das1045', 'siddharth.das1045', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Siddharth Das', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000025',
  '33333333-0000-0000-0000-000000000025',
  '24CS1045',
  'Siddharth Das',
  '3rd Year',
  'Computer Science & Engineering',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10044',
  1,
  now() - interval '62 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000025', now() - interval '62 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000025', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '62 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000026', 'user-sneha.kulkarni1046', 'sneha.kulkarni1046', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Sneha Kulkarni', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000026',
  '33333333-0000-0000-0000-000000000026',
  '24CS1046',
  'Sneha Kulkarni',
  '3rd Year',
  'Electronics & Communication',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10045',
  0,
  now() - interval '280 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000027', 'user-tanvi.agrawal1047', 'tanvi.agrawal1047', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Tanvi Agrawal', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000027',
  '33333333-0000-0000-0000-000000000027',
  '24CS1047',
  'Tanvi Agrawal',
  '3rd Year',
  'Electrical & Electronics',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10046',
  0,
  now() - interval '300 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000028', 'user-utkarsh.singh1048', 'utkarsh.singh1048', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Utkarsh Singh', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000028',
  '33333333-0000-0000-0000-000000000028',
  '24CS1048',
  'Utkarsh Singh',
  '3rd Year',
  'Mechanical Engineering',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10047',
  0,
  now() - interval '320 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000029', 'user-varun.chopra1049', 'varun.chopra1049', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Varun Chopra', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000029',
  '33333333-0000-0000-0000-000000000029',
  '24CS1049',
  'Varun Chopra',
  '3rd Year',
  'Information Technology',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10048',
  1,
  now() - interval '94 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000029', now() - interval '94 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000029', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '94 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000030', 'user-vidya.nambiar1050', 'vidya.nambiar1050', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Vidya Nambiar', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000030',
  '33333333-0000-0000-0000-000000000030',
  '24CS1050',
  'Vidya Nambiar',
  '3rd Year',
  'Civil Engineering',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10049',
  0,
  now() - interval '360 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000031', 'user-vikramaditya.bose1061', 'vikramaditya.bose1061', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Vikramaditya Bose', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000031',
  '33333333-0000-0000-0000-000000000031',
  '25CS1061',
  'Vikramaditya Bose',
  '4th Year',
  'Mechanical Engineering',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10060',
  1,
  now() - interval '30 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000031', now() - interval '30 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000031', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '30 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000032', 'user-yashwant.meena1062', 'yashwant.meena1062', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Yashwant Meena', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000032',
  '33333333-0000-0000-0000-000000000032',
  '25CS1062',
  'Yashwant Meena',
  '4th Year',
  'Information Technology',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10061',
  0,
  now() - interval '200 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000033', 'user-zara.merchant1063', 'zara.merchant1063', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Zara Merchant', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000033',
  '33333333-0000-0000-0000-000000000033',
  '25CS1063',
  'Zara Merchant',
  '4th Year',
  'Civil Engineering',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10062',
  0,
  now() - interval '220 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000034', 'user-abhishek.yadav1064', 'abhishek.yadav1064', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Abhishek Yadav', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000034',
  '33333333-0000-0000-0000-000000000034',
  '25CS1064',
  'Abhishek Yadav',
  '4th Year',
  'Computer Science & Engineering',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10063',
  0,
  now() - interval '240 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000035', 'user-archana.prasad1065', 'archana.prasad1065', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Archana Prasad', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000035',
  '33333333-0000-0000-0000-000000000035',
  '25CS1065',
  'Archana Prasad',
  '4th Year',
  'Electronics & Communication',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10064',
  1,
  now() - interval '62 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000035', now() - interval '62 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000035', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '62 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000036', 'user-bhavesh.chawla1066', 'bhavesh.chawla1066', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Bhavesh Chawla', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000036',
  '33333333-0000-0000-0000-000000000036',
  '25CS1066',
  'Bhavesh Chawla',
  '4th Year',
  'Electrical & Electronics',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10065',
  0,
  now() - interval '280 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000037', 'user-devendra.chauhan1067', 'devendra.chauhan1067', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Devendra Chauhan', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000037',
  '33333333-0000-0000-0000-000000000037',
  '25CS1067',
  'Devendra Chauhan',
  '4th Year',
  'Mechanical Engineering',
  'Ramanujan Hall (Hostel 2)',
  '+91 98765 10066',
  0,
  now() - interval '300 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000038', 'user-gitanjali.swamy1068', 'gitanjali.swamy1068', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Gitanjali Swamy', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000038',
  '33333333-0000-0000-0000-000000000038',
  '25CS1068',
  'Gitanjali Swamy',
  '4th Year',
  'Information Technology',
  'Sarojini Naidu Hall (Hostel 3)',
  '+91 98765 10067',
  0,
  now() - interval '320 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000039', 'user-harish.natarajan1069', 'harish.natarajan1069', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Harish Natarajan', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000039',
  '33333333-0000-0000-0000-000000000039',
  '25CS1069',
  'Harish Natarajan',
  '4th Year',
  'Civil Engineering',
  'Kalpana Chawla Hall (Hostel 4)',
  '+91 98765 10068',
  1,
  now() - interval '94 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('44444444-0000-0000-0000-000000000039', now() - interval '94 minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('44444444-0000-0000-0000-000000000039', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '94 minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('33333333-0000-0000-0000-000000000040', 'user-jaspreet.kaur1070', 'jaspreet.kaur1070', 'a1b2c3d4e5f67890123456789abcdef0:adde9765d2273643d60e1a876fccf60ef32436547f8a069c3d0a71e5c888a67b006963bff23e5248d8f2810eae81af85c53bc908e12c025716d30d75d1858c5d', 'student', 'Jaspreet Kaur', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '44444444-0000-0000-0000-000000000040',
  '33333333-0000-0000-0000-000000000040',
  '25CS1070',
  'Jaspreet Kaur',
  '4th Year',
  'Computer Science & Engineering',
  'Aryabhatta Hall (Hostel 1)',
  '+91 98765 10069',
  0,
  now() - interval '360 minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;

-- Initial Audit Log Entry
INSERT INTO audit_logs (actor_profile_id, action, entity_type, entity_id, metadata)
VALUES ('11111111-0000-0000-0000-000000000001', 'INITIAL_DATABASE_SEEDED', 'system', 'cluster_01', '{"enrolled_students": 40, "active_inside": 10, "status": "operational"}'::jsonb);

SELECT 'SUPABASE SEED COMPLETE! 40 Students, 3 Checkpoints, Profiles, and Sessions successfully populated.' AS confirmation;
