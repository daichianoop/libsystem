# Supabase Database, RLS & Realtime Setup Guide

This guide details configuring **Supabase Postgres** (free tier) for the **Hostel–Library Pass & Student Movement System**.

---

## 1. Create a Supabase Project

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project**.
3. Choose an organization, project name (`hostel-library-pass`), and set a strong database password.
4. Select the region closest to your campus (e.g., `ap-south-1` Mumbai for India).
5. Ensure the project is created under the free tier.

---

## 2. Apply SQL Migrations

You can apply the SQL migrations via the **Supabase Dashboard SQL Editor** or the **Supabase CLI**:

### Method A: Supabase Dashboard (Recommended for quick start)
1. Open your project dashboard and navigate to the **SQL Editor** tab.
2. Open `supabase/migrations/20261118000000_init_schema.sql` from this repository.
3. Paste the contents into the SQL Editor and click **Run**.
4. Open `supabase/migrations/20261118000001_scan_rpc.sql`.
5. Paste and click **Run**.
6. Open `supabase/seed.sql`, paste and click **Run** to insert default checkpoints and access windows.

### Method B: Supabase CLI
```bash
npx supabase db push
```

---

## 3. Verify Row Level Security (RLS) & Triggers

1. Navigate to **Database → Tables**.
2. Verify that **RLS Enabled** is toggled ON for all tables:
   - `profiles`
   - `students`
   - `checkpoints`
   - `scanner_assignments`
   - `library_sessions`
   - `movement_events`
   - `access_windows`
   - `access_overrides`
   - `session_logs`
   - `notifications`
   - `audit_logs`
   - `app_settings`
3. Navigate to **Database → Triggers** and ensure the `trg_movement_events_immutable` and `trg_audit_logs_immutable` triggers are active.

---

## 4. Enable Supabase Realtime

The schema migration automatically registers the following tables in the `supabase_realtime` publication:
- `students` (for live occupancy status updates)
- `movement_events` (for live scanner feeds)
- `library_sessions` (for active stay durations)

To verify in the dashboard:
1. Navigate to **Database → Publications**.
2. Click on `supabase_realtime`.
3. Confirm that `students`, `movement_events`, and `library_sessions` are checked.

---

## 5. Copy Environment Keys

1. Navigate to **Project Settings → API**.
2. Copy:
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co`
   - **Project API Keys → `anon` `public`**: `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...`
   - **Project API Keys → `service_role` `secret`**: `SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...`
3. Place these into `.env.local`. Keep the `service_role` key strictly confidential on the server.
