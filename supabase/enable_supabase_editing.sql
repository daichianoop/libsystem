-- ==============================================================================
-- ENABLE DIRECT EDITING & DELETION IN SUPABASE
-- Paste and run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jyggqnfmfeykopfmyykl/sql
-- ==============================================================================

-- 1. Drop the immutable trigger on movement_events that was blocking DELETE and UPDATE
DROP TRIGGER IF EXISTS trg_movement_events_immutable ON movement_events;
DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;

-- 2. Update movement_events foreign keys to ON DELETE CASCADE
-- (So deleting a student automatically and cleanly removes their events without errors)
ALTER TABLE movement_events DROP CONSTRAINT IF EXISTS movement_events_student_id_fkey;
ALTER TABLE movement_events 
  ADD CONSTRAINT movement_events_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE movement_events DROP CONSTRAINT IF EXISTS movement_events_library_session_id_fkey;
ALTER TABLE movement_events 
  ADD CONSTRAINT movement_events_library_session_id_fkey 
  FOREIGN KEY (library_session_id) REFERENCES library_sessions(id) ON DELETE CASCADE;

-- 3. Update library_sessions foreign keys to ON DELETE CASCADE
ALTER TABLE library_sessions DROP CONSTRAINT IF EXISTS library_sessions_student_id_fkey;
ALTER TABLE library_sessions 
  ADD CONSTRAINT library_sessions_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- 4. Update students profile foreign key to ON DELETE CASCADE
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_profile_id_fkey;
ALTER TABLE students 
  ADD CONSTRAINT students_profile_id_fkey 
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 5. Enable full editing/deleting permissions across all tables in Supabase
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for students" ON students;
CREATE POLICY "Allow all for students" ON students FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for profiles" ON profiles;
CREATE POLICY "Allow all for profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE movement_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for movement_events" ON movement_events;
CREATE POLICY "Allow all for movement_events" ON movement_events FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE library_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for library_sessions" ON library_sessions;
CREATE POLICY "Allow all for library_sessions" ON library_sessions FOR ALL USING (true) WITH CHECK (true);
