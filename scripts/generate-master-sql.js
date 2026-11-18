const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = 'a1b2c3d4e5f67890123456789abcdef0';
  const hash = crypto.pbkdf2Sync(password.trim(), salt, 100000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

const adminPassHash = hashPassword('admin123');
const scannerPassHash = hashPassword('scanner123');
const studentPassHash = hashPassword('student123');
const demoPassHash = hashPassword('pass123456');

const DEMO_STUDENT_NAMES = {
  "1st Year": [
    "Aarav Sharma", "Aditi Rao", "Ananya Verma", "Arjun Patel", "Bhavna Mishra",
    "Chirag Reddy", "Deepika Sen", "Divyansh Gupta", "Esha Nair", "Farhan Khan"
  ],
  "2nd Year": [
    "Gaurav Jha", "Ishita Chatterjee", "Kabir Roy", "Kavya Iyer", "Manish Tiwari",
    "Neha Deshmukh", "Nikhil Pillai", "Pooja Hegde", "Pranav Joshi", "Rhea Kapoor"
  ],
  "3rd Year": [
    "Rohan Saxena", "Sakshi Dubey", "Sameer Bhatt", "Sanya Malhotra", "Siddharth Das",
    "Sneha Kulkarni", "Tanvi Agrawal", "Utkarsh Singh", "Varun Chopra", "Vidya Nambiar"
  ],
  "4th Year": [
    "Vikramaditya Bose", "Yashwant Meena", "Zara Merchant", "Abhishek Yadav", "Archana Prasad",
    "Bhavesh Chawla", "Devendra Chauhan", "Gitanjali Swamy", "Harish Natarajan", "Jaspreet Kaur"
  ],
};

const DEPARTMENTS = [
  "Computer Science & Engineering",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical Engineering",
  "Information Technology",
  "Civil Engineering"
];

const HOSTELS = [
  "Aryabhatta Hall (Hostel 1)",
  "Ramanujan Hall (Hostel 2)",
  "Sarojini Naidu Hall (Hostel 3)",
  "Kalpana Chawla Hall (Hostel 4)"
];

function generateUsername(fullName, rollNumber) {
  const cleanRoll = rollNumber.replace(/\D/g, "");
  const rollSuffix = cleanRoll.length >= 3 ? cleanRoll.slice(-4) : rollNumber.slice(-4).toLowerCase().replace(/[^a-z0-9]/g, "");
  const nameParts = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  let baseName = "";
  if (nameParts.length === 1) baseName = nameParts[0];
  else if (nameParts.length >= 2) baseName = `${nameParts[0]}.${nameParts[nameParts.length - 1]}`;
  else baseName = "student";

  const maxBaseLen = 24 - rollSuffix.length;
  if (baseName.length > maxBaseLen) baseName = baseName.slice(0, maxBaseLen).replace(/\.$/, "");
  return `${baseName}${rollSuffix}`.toLowerCase();
}

let sql = `-- ==============================================================================
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
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  library_session_id uuid REFERENCES library_sessions(id) ON DELETE SET NULL,
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

DROP TRIGGER IF EXISTS trg_movement_events_immutable ON movement_events;
CREATE TRIGGER trg_movement_events_immutable
  BEFORE UPDATE OR DELETE ON movement_events
  FOR EACH ROW EXECUTE FUNCTION enforce_immutability();

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
  ('11111111-0000-0000-0000-000000000001', 'user-admin-001', 'admin', '${adminPassHash}', 'admin', 'Central Library Administrator', true),
  ('22222222-0000-0000-0000-000000000002', 'user-scanner-001', 'scanner', '${scannerPassHash}', 'scanner', 'Main Gate Security Staff', true)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO scanner_assignments (profile_id, checkpoint_id) VALUES
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (profile_id, checkpoint_id) DO NOTHING;

-- ==============================================================================
-- 10. SEED 40 DEMO STUDENTS ACROSS Y1 TO Y4 (Mixed In Library: 10 inside, 30 outside)
-- ==============================================================================
`;

const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
let yearIdx = 0;
let studentIndex = 0;

for (const year of years) {
  const names = DEMO_STUDENT_NAMES[year];
  const yearPrefix = (26 - (4 - yearIdx)).toString().padStart(2, "0");

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const roll = `${yearPrefix}CS${(1001 + i + yearIdx * 20).toString()}`;
    const dept = DEPARTMENTS[(i + yearIdx) % DEPARTMENTS.length];
    const hostel = HOSTELS[(i + yearIdx) % HOSTELS.length];
    const username = (i === 0 && yearIdx === 0) ? "student" : generateUsername(name, roll);
    const passHash = (i === 0 && yearIdx === 0) ? studentPassHash : demoPassHash;
    const phone = `+91 98765 ${10000 + i + yearIdx * 20}`;
    
    // In Library: 10 students inside (i % 4 === 0), 30 outside
    const inLibrary = (i % 4 === 0) ? 1 : 0;
    const lastScanMinutesAgo = inLibrary === 1 ? (30 + i * 8) : (180 + i * 20);

    const hexIndex = String(studentIndex + 1).padStart(12, '0');
    const profileId = `33333333-0000-0000-0000-${hexIndex}`;
    const studentId = `44444444-0000-0000-0000-${hexIndex}`;

    sql += `
INSERT INTO profiles (id, clerk_user_id, username, password_hash, role, full_name, is_active, must_change_password)
VALUES ('${profileId}', 'user-${username}', '${username}', '${passHash}', 'student', '${name.replace(/'/g, "''")}', true, false)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, is_active = true;

INSERT INTO students (id, profile_id, roll_number, full_name, category, department, hostel, phone, in_library, last_scan_at, is_active)
VALUES (
  '${studentId}',
  '${profileId}',
  '${roll}',
  '${name.replace(/'/g, "''")}',
  '${year}',
  '${dept.replace(/'/g, "''")}',
  '${hostel.replace(/'/g, "''")}',
  '${phone}',
  ${inLibrary},
  now() - interval '${lastScanMinutesAgo} minutes',
  true
)
ON CONFLICT (roll_number) DO UPDATE SET
  in_library = excluded.in_library,
  last_scan_at = excluded.last_scan_at,
  category = excluded.category,
  department = excluded.department,
  hostel = excluded.hostel;
`;

    // If student is inside the library, seed an OPEN session
    if (inLibrary === 1) {
      sql += `
INSERT INTO library_sessions (student_id, entered_at, entry_checkpoint_id, entered_by, status)
VALUES ('${studentId}', now() - interval '${lastScanMinutesAgo} minutes', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO movement_events (student_id, checkpoint_id, event_type, recorded_by, recorded_at, reason_code)
VALUES ('${studentId}', '11111111-1111-1111-1111-111111111111', 'LIBRARY_ENTRY', '22222222-0000-0000-0000-000000000002', now() - interval '${lastScanMinutesAgo} minutes', 'SUCCESS')
ON CONFLICT DO NOTHING;
`;
    }

    studentIndex++;
  }
  yearIdx++;
}

sql += `
-- Initial Audit Log Entry
INSERT INTO audit_logs (actor_profile_id, action, entity_type, entity_id, metadata)
VALUES ('11111111-0000-0000-0000-000000000001', 'INITIAL_DATABASE_SEEDED', 'system', 'cluster_01', '{"enrolled_students": 40, "active_inside": 10, "status": "operational"}'::jsonb);

SELECT 'SUPABASE SEED COMPLETE! 40 Students, 3 Checkpoints, Profiles, and Sessions successfully populated.' AS confirmation;
`;

const outputPath = path.join(__dirname, '..', 'supabase', 'master_schema_and_seed.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log('Successfully written master SQL script to:', outputPath);
