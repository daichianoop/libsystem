-- ==============================================================================
-- Migration: 20261118000000_init_schema.sql
-- Description: Core schema, enums, tables, immutable triggers, and RLS policies
-- System: Hostel Library Pass & Student Movement System
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------------------------

create type user_role as enum ('admin', 'scanner', 'student', 'warden');
create type student_category as enum ('1st Year', '2nd Year', '3rd Year', '4th Year');
create type checkpoint_type as enum ('LIBRARY_ENTRY', 'LIBRARY_EXIT', 'LIBRARY_BOTH');
create type session_status as enum ('OPEN', 'CLOSED', 'FLAGGED');
create type movement_event_type as enum ('LIBRARY_ENTRY', 'LIBRARY_EXIT', 'REJECTED_SCAN', 'ADMIN_CORRECTION');
create type verification_status as enum ('VERIFIED', 'PENDING_SYNC', 'REJECTED');
create type notification_type as enum ('INFO', 'WARNING', 'ALERT', 'SYSTEM');

-- ------------------------------------------------------------------------------
-- 2. TRIGGER HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Generic updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Immutability enforcement trigger function (blocks UPDATE and DELETE)
create or replace function enforce_immutability()
returns trigger as $$
begin
  raise exception 'Operation % is prohibited on immutable table %', TG_OP, TG_TABLE_NAME;
end;
$$ language plpgsql;

-- ------------------------------------------------------------------------------
-- 3. TABLES
-- ------------------------------------------------------------------------------

-- Profiles: Mirrors Clerk users
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  username text not null unique,
  role user_role not null,
  full_name text not null,
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  credential_version int not null default 1,
  credential_issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

-- Students: Core student identity and library status
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  roll_number text not null unique,
  full_name text not null,
  category student_category not null,
  department text not null,
  hostel text,
  phone text,
  guardian_contact text,
  in_library smallint not null default 0 check (in_library in (0, 1)),
  last_scan_at timestamptz,
  is_active boolean not null default true,
  card_secret text not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_students_updated_at
  before update on students
  for each row execute function update_updated_at_column();

-- Checkpoints: Physical scanning locations
create table if not exists checkpoints (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type checkpoint_type not null default 'LIBRARY_BOTH',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_checkpoints_updated_at
  before update on checkpoints
  for each row execute function update_updated_at_column();

-- Scanner assignments: maps scanner profiles to checkpoints
create table if not exists scanner_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  checkpoint_id uuid not null references checkpoints(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(profile_id, checkpoint_id)
);

-- Library sessions: tracks stay duration from entry to exit
create table if not exists library_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  entry_checkpoint_id uuid not null references checkpoints(id),
  exit_checkpoint_id uuid references checkpoints(id),
  entered_by uuid references profiles(id),
  exited_by uuid references profiles(id),
  status session_status not null default 'OPEN',
  expected_exit_by timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_library_sessions_updated_at
  before update on library_sessions
  for each row execute function update_updated_at_column();

-- Unique partial index: exactly one OPEN session allowed per student
create unique index if not exists idx_unique_open_session_per_student
  on library_sessions (student_id)
  where status = 'OPEN';

-- Movement events: IMMUTABLE audit log of all scan events
create table if not exists movement_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  library_session_id uuid references library_sessions(id) on delete set null,
  checkpoint_id uuid references checkpoints(id) on delete set null,
  event_type movement_event_type not null,
  recorded_by uuid references profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  device_id text,
  verification_status verification_status not null default 'VERIFIED',
  reason_code text,
  idempotency_key text unique,
  notes text,
  created_at timestamptz not null default now()
);

-- Immutability triggers on movement_events
create trigger trg_movement_events_immutable
  before update or delete on movement_events
  for each row execute function enforce_immutability();

-- Access windows: Time gates per role
create table if not exists access_windows (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  day_of_week smallint check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_access_windows_updated_at
  before update on access_windows
  for each row execute function update_updated_at_column();

-- Access overrides: Holiday and special exceptions
create table if not exists access_overrides (
  id uuid primary key default gen_random_uuid(),
  override_date date not null,
  role user_role, -- NULL means applies to all non-admin roles
  open_time time,
  close_time time,
  is_closed_all_day boolean not null default false,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Session logs: records login, logout, and forced expiration
create table if not exists session_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  clerk_user_id text not null,
  role text not null,
  event text not null,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null default 'INFO',
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Audit logs: IMMUTABLE system administrative audit trail
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

-- Immutability triggers on audit_logs
create trigger trg_audit_logs_immutable
  before update or delete on audit_logs
  for each row execute function enforce_immutability();

-- App settings: System configuration key-value store
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. PERFORMANCE & FILTER INDEXES
-- ------------------------------------------------------------------------------

create index if not exists idx_students_roll_number on students(roll_number);
create index if not exists idx_students_category on students(category);
create index if not exists idx_students_in_library on students(in_library);
create index if not exists idx_students_cat_in_lib on students(category, in_library);
create index if not exists idx_students_profile_id on students(profile_id);

create index if not exists idx_movement_events_student_time on movement_events(student_id, recorded_at desc);
create index if not exists idx_movement_events_session on movement_events(library_session_id);
create index if not exists idx_movement_events_checkpoint on movement_events(checkpoint_id);

create index if not exists idx_library_sessions_student on library_sessions(student_id, entered_at desc);
create index if not exists idx_library_sessions_status on library_sessions(status);

create index if not exists idx_audit_logs_actor on audit_logs(actor_profile_id, created_at desc);
create index if not exists idx_session_logs_profile on session_logs(profile_id, created_at desc);
create index if not exists idx_notifications_recipient on notifications(recipient_profile_id, is_read, created_at desc);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

alter table profiles enable row level security;
alter table students enable row level security;
alter table checkpoints enable row level security;
alter table scanner_assignments enable row level security;
alter table library_sessions enable row level security;
alter table movement_events enable row level security;
alter table access_windows enable row level security;
alter table access_overrides enable row level security;
alter table session_logs enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table app_settings enable row level security;

-- Helper to extract current Clerk sub from Supabase JWT
create or replace function current_clerk_sub()
returns text as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '');
$$ language sql stable;

-- Helper to get profile id from current Clerk JWT
create or replace function current_profile_id()
returns uuid as $$
  select id from profiles where clerk_user_id = current_clerk_sub() limit 1;
$$ language sql stable;

-- Helper to get role from current Clerk JWT
create or replace function current_user_role()
returns user_role as $$
  select role from profiles where clerk_user_id = current_clerk_sub() limit 1;
$$ language sql stable;

-- PROFILES RLS:
-- Students can read only their own profile. Admin and Scanner can read profiles needed for their roles.
create policy "profiles_select_own" on profiles
  for select using (
    clerk_user_id = current_clerk_sub()
    or current_user_role() in ('admin', 'scanner')
  );

-- STUDENTS RLS:
-- Student reads ONLY their own student record. Admin and Scanner can read student records.
create policy "students_select_own" on students
  for select using (
    profile_id = current_profile_id()
    or current_user_role() in ('admin', 'scanner')
  );

-- CHECKPOINTS RLS:
-- Anyone authenticated can view active checkpoints
create policy "checkpoints_select_all" on checkpoints
  for select using (true);

-- SCANNER ASSIGNMENTS RLS:
create policy "scanner_assignments_select" on scanner_assignments
  for select using (
    profile_id = current_profile_id()
    or current_user_role() = 'admin'
  );

-- LIBRARY SESSIONS RLS:
-- Students read only their own sessions. Admin and Scanner can read all.
create policy "library_sessions_select_own" on library_sessions
  for select using (
    student_id in (select id from students where profile_id = current_profile_id())
    or current_user_role() in ('admin', 'scanner')
  );

-- MOVEMENT EVENTS RLS:
-- Students read only their own events. Admin and Scanner can read all.
create policy "movement_events_select_own" on movement_events
  for select using (
    student_id in (select id from students where profile_id = current_profile_id())
    or current_user_role() in ('admin', 'scanner')
  );

-- ACCESS WINDOWS & OVERRIDES:
-- Publicly readable by all authenticated users
create policy "access_windows_select" on access_windows for select using (true);
create policy "access_overrides_select" on access_overrides for select using (true);

-- SESSION LOGS RLS:
-- Students see their own last logins. Admin sees all.
create policy "session_logs_select" on session_logs
  for select using (
    clerk_user_id = current_clerk_sub()
    or current_user_role() = 'admin'
  );

-- NOTIFICATIONS RLS:
-- User sees only their own notifications
create policy "notifications_select_own" on notifications
  for select using (recipient_profile_id = current_profile_id());

create policy "notifications_update_own" on notifications
  for update using (recipient_profile_id = current_profile_id())
  with check (recipient_profile_id = current_profile_id());

-- AUDIT LOGS RLS:
-- Admin only
create policy "audit_logs_select_admin" on audit_logs
  for select using (current_user_role() = 'admin');

-- APP SETTINGS RLS:
-- Authenticated users can read app settings
create policy "app_settings_select" on app_settings for select using (true);

-- ------------------------------------------------------------------------------
-- 6. ENABLE REALTIME
-- ------------------------------------------------------------------------------

-- Realtime publication for students status and movement events
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table students;
alter publication supabase_realtime add table movement_events;
alter publication supabase_realtime add table library_sessions;
