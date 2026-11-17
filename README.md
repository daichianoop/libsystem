# Hostel–Library Digital Pass & Student Movement Management System

> Production-quality, college-ready cloud web application that replaces paper library passes with cryptographically signed, rotating QR digital ID tags, recording and auditing student entries and exits at the central library.

Built on **Next.js 15+ (App Router, TypeScript)**, **Tailwind CSS**, **Clerk** (authentication), and **Supabase** (Postgres, Realtime, RLS), engineered entirely within free tiers.

---

## 1. System Surfaces & Roles

The system strictly segregates access into four distinct surfaces:

1. **Admin View (`/admin/*`)**:
   - Live dashboard: current occupancy, open sessions, peak occupancy sparklines, and scan stream.
   - Comprehensive student roster with combinable filters (`category` Y1–Y4, `in_library` 0/1 status, department, search, date ranges).
   - Student registration issuing single-display CSPRNG hash codes.
   - Exception queue, checkpoint management, and access window configuration.
2. **Student View (`/student/*`)**:
   - Current status chip (`1 / In Library` or `0 / Outside`), live time inside, and stay history.
   - Dynamic Student ID Pass with 30-second rotating QR codes.
   - Self-audit view of last 10 login/logout sessions.
3. **Scanner View (`/scanner`)**:
   - High-throughput checkpoint interface with camera viewfinder and manual entry fallback.
   - 10-second duplicate scan debouncing, instant visual status indicators, and offline sync resilience.
4. **Student ID Tag (`components/id-tag`)**:
   - Reusable ID tag component supporting rotating mode (anti-screenshot) and static printable card mode.

---

## 2. Architecture & Security Invariants

- **Zero Client Direct DB Writes**: All state transitions go through Next.js API route handlers calling Postgres RPC `scan_student` with row-level locks (`SELECT ... FOR UPDATE`).
- **Immutable Audit Trails**: `movement_events` and `audit_logs` are protected by Postgres triggers blocking `UPDATE` and `DELETE`. Corrections are strictly additive (`ADMIN_CORRECTION`).
- **Cryptographic Token Verification**: ID tag QR codes are compact HMAC-SHA256 signatures (`v1.<student_id>.<bucket>.<hmac>`) verified with constant-time equality checks.
- **Server-Side Access Timings**: Server-side enforced time windows in `Asia/Kolkata` (IST) timezone. Outside active hours, requests are rejected (`OUTSIDE_ACCESS_WINDOW`) and redirected to `/closed`.
- **Row Level Security (RLS)**: Enforced across all tables. Students can only read their own row.
- **Zero Secret Exposure**: Clerk secret keys and Supabase service-role keys are strictly server-only.

---

## 3. Free-Tier Reality & Production Strategies

| Service | Free Tier Limits | Engineering Mitigation |
|---|---|---|
| **Clerk Auth** | 10,000 Monthly Active Users (MAU) | Restricted sign-up (admin-only provisioning). Redundant guest/social sessions disabled. |
| **Supabase Postgres** | Inactivity project pause after 7 days | Documented keep-alive ping endpoint (`GET /api/health`) and lightweight scheduled trigger. |
| **Vercel Hobby** | Daily/hourly cron restrictions | Background jobs batched; exceptions detected dynamically on session queries. |

---

## 4. Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v24 LTS)
- npm or pnpm

### 1. Installation
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local` and configure your credentials:
```bash
cp .env.example .env.local
```
Refer to:
- [`docs/setup-clerk.md`](file:///c:/Users/KIIT0001/Downloads/Hostel%20Library%20Pass%20System/docs/setup-clerk.md) for Clerk configuration.
- [`docs/setup-supabase.md`](file:///c:/Users/KIIT0001/Downloads/Hostel%20Library%20Pass%20System/docs/setup-supabase.md) for Supabase database migrations and RLS setup.

### 3. Database Migrations
Apply the migrations in order in your Supabase SQL editor:
1. `supabase/migrations/20261118000000_init_schema.sql`
2. `supabase/migrations/20261118000001_scan_rpc.sql`
3. `supabase/seed.sql`

### 4. Seed Data
```bash
# Seed initial administrator
npm run seed:admin

# Seed 40 demo students across Y1–Y4 with generated credentials
npm run seed:demo
```

### 5. Running the Application
```bash
npm run dev
```
Navigate to `http://localhost:3000`.

### 6. Running Tests
```bash
npm test
```
All 31 unit and integration tests verify:
- Username generation and collision resolution
- CSPRNG hash code entropy and non-similarity checks
- Rotating QR HMAC signing and ±1 bucket validation
- State machine transitions (0 → 1 → 0) and duplicate scan guards
- IST access window calculations and overnight windows
- RLS read isolation logic
