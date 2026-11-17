# Library Pass & Student Movement System — Build Instructions

> A complete, copy-paste-ready build brief for an AI coding agent (Claude Code, Cursor, etc.) to generate a **Cloud-Based Hostel–Library Digital Pass and Student Movement Management System** using **Clerk** (authentication) and **Supabase** (database, realtime, storage), running entirely on free tiers.

Derived from the reference template (hostel + library digital pass, QR-based ID scanning, role-based dashboards, strict state machine, audit trail). This version simplifies the stack for a small team, adds a credential-issuing registration flow, strict access timings, and a rotating-QR ID tag.

---

## 0. How to use this document

1. Create an empty repo and open it in your coding agent.
2. Paste **Section 1 (Master Prompt)** as the first message. It is self-contained.
3. Then feed the **Phase Prompts in Section 14** one at a time. Do not let the agent skip phases or dump an incomplete codebase.
4. After each phase, run the verification commands and tick the acceptance checklist before continuing.
5. Sections 2–13 are the specification the Master Prompt refers to. Keep this file in the repo as `instructions.md` so the agent can re-read it.

---

## 1. MASTER PROMPT (paste this first)

```
You are a senior full-stack engineer. Build a production-quality, college-ready web app: the
"Library Pass & Student Movement System". It replaces paper library passes with a digital,
QR-scannable student ID tag, and records when each student enters and leaves the central library.

Read /instructions.md fully before writing any code. It is the source of truth for the stack,
data model, business rules, security rules, UI design tokens, folder layout and phases.

Hard requirements:
- Stack: Next.js (App Router, TypeScript), Tailwind CSS, Clerk (auth), Supabase (Postgres,
  Realtime, RLS). Free tiers only. Keep dependencies light and modular.
- Exactly four surfaces: (1) Admin view, (2) Student view, (3) Scanner view, (4) Student ID Tag
  (a QR pass shown inside the Student view and printable by Admin).
- Only an Admin can register students. On registration the server generates a unique username
  and a random high-entropy "hash code"; the hash code is the student's initial password. It is
  shown to the admin exactly once and never stored in plaintext.
- Students have a category: 1st Year, 2nd Year, 3rd Year, 4th Year. The admin student list
  supports multiple combinable filters, including `in_library` status (0 or 1).
- Strict login/logout time windows per role, enforced SERVER-SIDE, with auto sign-out at the
  window end and a viewable login/logout log.
- Camera-based QR scanning with manual fallback. Scans toggle/validate library status through a
  strict state machine inside a database transaction. Movement events are immutable.
- Design: clean, professional, dark theme. Ash and whitesmoke neutrals with orange and sand
  accents (tokens in Section 11).
- Work in the phases defined in Section 14. At the end of each phase list files created/changed,
  setup commands, and which tests pass. Do not move on until the phase's acceptance checklist
  passes. Never leave placeholder or TODO logic in security-critical paths.
- Never expose the Supabase service-role key or Clerk secret key to the browser.
- Ask me before deviating from anything in instructions.md.

Start by (a) restating the architecture in your own words, (b) proposing the final folder
structure, (c) writing the SQL migration for Phase 1. Then implement Phase 1 completely.
```

---

## 2. Product summary

**Problem.** Students study late in the central library using paper passes that can be forged, reused, or lost. The college has no reliable record of who is in the library right now.

**Solution.** Every student gets a digital ID tag containing a QR code. Library staff scan it with a phone or webcam. The server verifies the student, flips their `in_library` status (0 → 1 on entry, 1 → 0 on exit), and logs an immutable event. Admins register students and see everything; students see only themselves.

**Out of scope (by design).** No facial recognition, no GPS or continuous location tracking, no automatic disciplinary action. A missing scan is an *unresolved record needing staff review*, never proof of misconduct.

---

## 3. Technology decisions

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15+ (App Router) + TypeScript** | One deployable for UI + API routes. Fewer moving parts than React + separate FastAPI. Deviation from the reference template is deliberate. |
| Styling | **Tailwind CSS** + small headless primitives (`@radix-ui/*` only where needed) | Light, accessible, easy theming. |
| Auth | **Clerk** (username + password, restricted sign-up) | Handles hashing, sessions, brute-force protection, MFA option. |
| Database | **Supabase Postgres** | Free tier, SQL migrations, RLS, Realtime. |
| Realtime | **Supabase Realtime** (postgres changes) with polling fallback | Live occupancy and scan log. |
| QR scan | `@yudiel/react-qr-scanner` (or `html5-qrcode`) | Camera + fallback, small. |
| QR render | `qrcode.react` | Client-side QR for the ID tag. |
| Validation | `zod` | Shared schemas for forms and API. |
| Tables/filters | `@tanstack/react-table` (optional) + URL search params | Shareable filter state. |
| Dates | `date-fns` + `date-fns-tz` | All logic in `Asia/Kolkata`. |
| Webhooks | `svix` | Verify Clerk webhooks. |
| Rate limit | Postgres-backed counter (no extra service) or Upstash Redis free tier | Protect scan and login-adjacent endpoints. |
| PDF/print | `@react-pdf/renderer` or print-CSS | Printable ID tag sheets. |
| Tests | `vitest`, `@testing-library/react`, `playwright` | Unit, component, e2e. |
| Hosting | **Vercel Hobby** (app) + Supabase Free + Clerk Free | All free. |
| Cron | Vercel Cron (free, daily/hourly) or Supabase `pg_cron` | Overdue flagging, retention. |

Free-tier reality check the agent must document in the README: Clerk free MAU limit, Supabase free project pausing after inactivity, Vercel Hobby cron frequency limits. Plan around them (for example, document a keep-alive ping and a "demo mode" seed).

---

## 4. Architecture

```
Browser (Admin / Student / Scanner)
   │  Clerk session (JWT)
   ▼
Next.js on Vercel
   ├─ middleware.ts ......... auth + role gate + TIME-WINDOW gate
   ├─ /app (UI) ............. server components by default
   ├─ /app/api/* ............ route handlers: ALL writes happen here
   └─ lib/server/* .......... clerk admin client, supabase service client, state machine
   │
   ├──► Clerk Backend API ... create/disable users, set role metadata
   └──► Supabase Postgres ... RPC functions (transactional), RLS, Realtime
            ▲
Clerk webhooks (session.created / session.ended) ──► /api/webhooks/clerk ──► session_logs
```

**Principles**

1. **The server decides.** The browser never writes movement data directly. Route handlers call Postgres RPC functions that lock rows and enforce the state machine.
2. **Defense in depth.** RLS is enabled on every table. The service-role key is used only in server code, but policies still restrict what a Clerk-JWT client could read (students may read only their own rows).
3. **Single source of truth for rules.** State machine lives in one SQL function plus one TypeScript mirror used for UI hints and unit tests.
4. **Modular folders.** Each feature (students, scanner, passes, access-windows, audit) owns its components, schemas, queries and actions.

---

## 5. Roles and views

| Role | Where stored | Views |
|---|---|---|
| `admin` | Clerk `publicMetadata.role` + `profiles` row | Admin view (everything), can also open Scanner |
| `scanner` (library staff / security) | same | Scanner view only |
| `student` | same | Student view + ID Tag |

Optional later role: `warden` (read-only, scoped to a hostel). Design the `role` enum so adding it needs no migration pain.

The role is read from the Clerk session claims in `middleware.ts` and re-verified server-side in every route handler. Never trust a role sent by the client.

---

## 6. Authentication and the registration flow

### 6.1 Clerk configuration (document step by step in `docs/setup-clerk.md`)

- Enable **username** and **password** sign-in. Disable email, phone and social sign-in. Make email optional or unused.
- Set sign-up mode to **Restricted** (no public sign-up). Users are created only by the server through the Clerk Backend API.
- Add a session token customization so claims include `role` and `profile_id` (from `publicMetadata`).
- Connect Clerk to Supabase using the current official **Clerk ↔ Supabase integration** (third-party auth), so Supabase RLS can read the Clerk user id from the JWT. Follow the current docs rather than any older JWT-template guide.
- Configure a **webhook** endpoint for `session.created` and `session.ended` events. Store the signing secret in env.

### 6.2 Admin registers a student (the core flow)

1. Admin opens **Students → Add student** and submits: full name, roll number, category (`1st Year` … `4th Year`), course/department, hostel (optional), phone (optional), guardian contact (optional, can be skipped for data minimisation).
2. `POST /api/students` (admin only) validates with zod, then in order:
   1. Generates a **username** (Section 6.3).
   2. Generates a **hash code** (Section 6.4).
   3. Creates the Clerk user (`username`, `password = hashCode`, `publicMetadata = { role: 'student', profile_id }`).
   4. Inserts the `students` and `profiles` rows and an `audit_logs` entry in one DB transaction.
   5. If any step fails, rolls back (delete the Clerk user if it was created). No half-registered students.
3. The response returns `{ username, hashCode }` **once**. The UI shows a modal with Copy, Print credential slip, and Download buttons, plus a warning: "This code is not stored and cannot be shown again."
4. Admin can later use **Reset credentials** to generate a new hash code (old one stops working). Never display an old one.

### 6.3 Username generation

- Format: `firstname.lastname` + last 3–4 digits of roll number, lowercase, ASCII only, for example `asha.rao4821`.
- Strip diacritics and punctuation, collapse spaces, max 24 chars.
- Check uniqueness against `profiles.username`; on collision append a short random suffix.
- Usernames are immutable after creation (admin can disable and re-create instead).

### 6.4 Hash code (initial password) generation

- Generated server-side with Node `crypto.randomBytes` (CSPRNG). Never `Math.random`.
- Alphabet: unambiguous characters only (no `0 O 1 I l`), for example `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- Length: **12 characters**, displayed in groups of 4 (`K7QM-3XRT-9WPD`). Roughly 59 bits of entropy.
- "Non-similar" requirement: each code is an independent CSPRNG draw; additionally reject any code with 3+ identical consecutive characters, or sequential runs, and reject a code if it equals or is within edit distance 3 of a code issued in the same batch (relevant for bulk import).
- Hash codes are used verbatim as the Clerk password (Clerk stores the hash). The app additionally stores only `credential_issued_at` and `credential_version`, never the code or a reversible form.
- Add an optional **"must change password on first login"** flag. Recommended default: on for students, with a clean change-password screen.
- Rate limiting and lockout are handled by Clerk. Add admin ability to disable a student's Clerk account instantly.

### 6.5 Staff and admin accounts

- The first admin is created by a one-time seed script using env-provided credentials (document that it must be removed or rotated after setup).
- Admin can create `scanner` accounts the same way (username + generated hash code), tagged with a checkpoint.

---

## 7. Strict login/logout timings

Goal: users can only view the system inside configured time windows; sessions end automatically when the window closes; every login and logout is recorded and viewable.

### 7.1 Configuration

Table `access_windows` (admin-editable, timezone fixed to `Asia/Kolkata`, stored per role and optional day of week):

```
role | day_of_week (0-6 or NULL=all) | open_time | close_time | is_active
student | NULL | 17:00 | 23:30 | true
scanner | NULL | 16:00 | 23:59 | true
admin   | NULL | 00:00 | 23:59 | true   -- admin is never fully locked out
```

Defaults are seeded; admin can edit them in **Settings → Access windows**. Support overnight windows (close < open) and a "holiday/override" table `access_overrides` (date, role, open/close or closed-all-day, reason).

### 7.2 Enforcement (all server-side)

- `middleware.ts` loads the user's role and the active window for the current IST time (cached for ~30 seconds). Outside the window, protected routes redirect to `/closed`, which shows the next opening time and a sign-out button. API routes return **`403` with `code: "OUTSIDE_ACCESS_WINDOW"`**.
- Login outside the window: the user can authenticate with Clerk but is immediately routed to `/closed`. No data is served. (Document this behaviour clearly.)
- **Auto sign-out:** the client shows a countdown banner in the last 10 minutes and calls `signOut()` at close time. Server enforcement does not depend on the client: after close time, every request is rejected even with a valid Clerk session.
- Use the **server clock only**. Never trust client time.
- Admin always bypasses lockout for the Settings and Access-windows pages so they can never lock themselves out.

### 7.3 Login/logout log (viewable)

- Clerk webhooks `session.created` and `session.ended` write to `session_logs` (user, role, event, ip, user agent, timestamp). Verify the Svix signature; make the handler idempotent by event id.
- Also log `session_forced_close` (window ended) and `login_blocked_outside_window`.
- Admin view **Security → Session log**: filterable by role, user, date range, event type; export CSV.
- Student sees their own last 10 login/logout entries on their profile (transparency).

---

## 8. Data model (Supabase / Postgres)

All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at` via trigger where relevant. RLS **enabled** on all.

```
profiles            id, clerk_user_id (unique), username (unique), role (enum), full_name,
                    is_active, must_change_password, credential_version, credential_issued_at

students            id, profile_id (fk, unique), roll_number (unique), full_name,
                    category (enum: Y1,Y2,Y3,Y4), department, hostel, phone,
                    in_library smallint not null default 0 check (in_library in (0,1)),
                    last_scan_at, is_active, card_secret (random per-student, server-only)

checkpoints         id, name, type (LIBRARY_ENTRY | LIBRARY_EXIT | LIBRARY_BOTH), is_active

scanner_assignments id, profile_id, checkpoint_id

library_sessions    id, student_id, entered_at, exited_at (nullable), entry_checkpoint_id,
                    exit_checkpoint_id, entered_by, exited_by, status (OPEN|CLOSED|FLAGGED),
                    expected_exit_by      -- configurable, drives overdue detection
                    -- partial unique index: one OPEN session per student

movement_events     id, student_id, library_session_id, checkpoint_id, event_type
                    (LIBRARY_ENTRY | LIBRARY_EXIT | REJECTED_SCAN | ADMIN_CORRECTION),
                    recorded_by, recorded_at, device_id, verification_status
                    (VERIFIED|PENDING_SYNC|REJECTED), reason_code, idempotency_key (unique), notes
                    -- IMMUTABLE: trigger blocks UPDATE and DELETE

access_windows, access_overrides, session_logs   (Section 7)

notifications       id, recipient_profile_id, type, title, message, is_read
audit_logs          id, actor_profile_id, action, entity_type, entity_id, metadata jsonb,
                    ip, created_at
app_settings        key, value jsonb   -- max_stay_minutes, retention_days, rate limits, etc.
```

**Constraints and indexes to include**

- `students(roll_number)`, `students(category)`, `students(in_library)`, composite `(category, in_library)`; `movement_events(student_id, recorded_at desc)`; unique partial index `library_sessions(student_id) WHERE status = 'OPEN'`.
- Trigger that raises an exception on `UPDATE`/`DELETE` of `movement_events` and `audit_logs`.
- Corrections: an admin correction inserts an `ADMIN_CORRECTION` event plus an audit log entry referencing the original event. The original is never altered.
- RLS: students can `SELECT` only rows where the student's `profile.clerk_user_id = auth.jwt()->>'sub'`. No student `INSERT/UPDATE/DELETE` anywhere. Staff and admin access goes through the server using the service role.
- Enable Realtime only on the tables the UI subscribes to (`students` status, `movement_events`), and make sure RLS does not leak other students' rows through Realtime.

**Transactional scan function** (`scan_student(p_card_token, p_checkpoint_id, p_scanner_id, p_idempotency_key, p_device_id)`):

1. Idempotency check: if the key exists, return the original result.
2. `SELECT ... FOR UPDATE` on the student row.
3. Validate: student exists and active, token valid (Section 9), checkpoint active and compatible with the direction.
4. State machine:
   - `in_library = 0` and checkpoint allows entry → open `library_sessions`, set `in_library = 1`, log `LIBRARY_ENTRY`.
   - `in_library = 1` and checkpoint allows exit → close session, set `in_library = 0`, log `LIBRARY_EXIT`.
   - Direction mismatch (for example an exit-only checkpoint but the student is already out) → reject with a precise reason code.
5. Duplicate-scan guard: same student and same checkpoint within `N` seconds (default 10) → `DUPLICATE_SCAN`.
6. Write a `REJECTED_SCAN` event for every rejection (audit trail of attempts) and return a structured result.

---

## 9. The ID Tag and QR security

The ID tag is what the scanner reads. It must be hard to forge and hard to reuse from a screenshot.

- QR payload is **not** the roll number. It is a compact signed token: `v1.<student_uuid>.<timestamp_bucket>.<hmac>` where `hmac = HMAC-SHA256(card_secret, student_uuid + bucket)`.
- **Rotating mode (default):** the student's ID tag regenerates the token every 30–60 seconds (client requests it from `GET /api/tag/token`, server signs it). The scanner accepts the current and previous bucket only. A screenshot dies in about a minute.
- **Static printable mode (for students without phones):** a longer-lived signed token (valid until revoked), printed by admin on a physical tag. Admin can **revoke and reissue** by rotating `card_secret`. Tokens carry `version` so old printed tags fail immediately.
- Constant-time HMAC comparison. Reject malformed tokens with `INVALID_CARD`, never revealing which part failed.
- ID tag design (student view and print sheet): name, roll number, category badge, large QR, "valid only with live code" note, and the college name. A "Download as PNG/PDF" action and a batch print sheet (A4, 8 tags per page) for admins.

---

## 10. Views and features

### 10.1 Admin view

- **Dashboard:** total students, students currently in library (live), today's entries/exits, open sessions, overdue sessions, per-category occupancy (Y1–Y4 bar), peak-hour sparkline, last 20 scans (realtime).
- **Students list (core):** table with columns Name, Roll No, Username, Category, Department, `Status` (**0/1 shown as a pill**, with tooltip "0 = outside, 1 = in library"), Last scan, Active toggle, Actions.
  - **Filters (combinable, stored in the URL):** category (multi-select), in_library (All / 0 / 1), department, active/inactive, date range of last scan, free-text search (name, roll, username).
  - Server-side pagination, sortable columns, column visibility toggle, saved filter presets, "export filtered results as CSV".
  - Bulk actions: print ID tags, disable, reset credentials, promote year (see below).
  - Row drawer: profile, movement history timeline, session history, audit trail for that student.
- **Add student** form (Section 6.2) with live username preview, duplicate roll-number detection, and the one-time credential modal. **Only admins see or can call this.**
- **Bulk import:** CSV upload with dry-run preview, row-level error report, and a downloadable credentials sheet (shown once, then purged from memory).
- **Year rollover tool:** promote Y1→Y2→Y3→Y4 and archive graduating Y4 students, with a confirmation step and an audit entry.
- **Scanner management:** create scanner accounts, assign checkpoints, enable/disable, see last-seen device.
- **Access windows and overrides** (Section 7).
- **Security → Session log** and **Audit log** (filter by actor, action, date; export).
- **Exceptions queue:** open sessions past `expected_exit_by`, entries with no exit by closing time, rejected-scan spikes. Staff can *resolve with a note* (for example "student left without scanning, confirmed"), which writes a correction event. Never auto-penalise.
- **Settings:** max stay duration, duplicate-scan window, library closing time (auto-flags open sessions), retention policy, theme, notification preferences.
- **Notifications center** with realtime badge.
- **Reports:** daily/weekly occupancy, per-category usage, average stay, CSV/PDF export.

### 10.2 Student view

- Greeting, current status (In library / Outside) with a large status chip, entry time and live "time inside" counter.
- **ID Tag card** with the rotating QR (auto-refresh ring indicator), brightness boost button, "add to home screen" hint (PWA).
- Own history: sessions and events, filterable by date.
- Own login/logout activity (last 10).
- Notifications (for example "You were checked out at closing time").
- Change password screen (forced on first login when flagged).
- **Cannot** see any other student, list, or admin data. Enforced by RLS and server checks.

### 10.3 Scanner view (mobile-first)

- Pick checkpoint (locked automatically if the account has exactly one assignment) and mode: **Auto (toggle)**, **Entry only**, **Exit only**.
- Live camera viewfinder with scan frame, torch toggle, front/back camera switch, permission-denied help screen.
- On decode: show **student preview** (name, roll, category, photo optional, current status) and a big result card: green (accepted), amber (warning, for example duplicate), red (rejected with plain-language reason). Auto-dismiss after 3 seconds with haptic and optional sound.
- Manual fallback: enter roll number or paste a token (clearly marked as less secure, requires scanner role, always audited).
- **Offline queue:** if the network drops, scans are stored in IndexedDB with idempotency keys and labelled **PENDING SYNC** in amber. They sync on reconnect; the server validates them and may reject. Never show a pending scan as confirmed.
- Session scan history (last 50), counters (entries, exits, rejections this shift), live library occupancy.
- Debounce: ignore the same code for 3 seconds client-side (server also enforces).
- Large touch targets, works in landscape and portrait, screen wake-lock while scanning.

### 10.4 ID Tag (shared component)

Implemented once (`components/id-tag`) and reused in the Student view, admin print sheet and credential slip.

---

## 11. Design system (dark, ash + whitesmoke, orange + sand)

**Tokens (put in `tailwind.config` and CSS variables):**

```
--bg:            #121212   /* app background */
--surface:       #1C1C1E   /* cards */
--surface-2:     #262628   /* raised, table header */
--border:        #38383B   /* ash lines */
--ash:           #8E8E93   /* secondary text */
--text:          #F5F5F5   /* whitesmoke, primary text */
--accent:        #F28C28   /* orange: primary actions, active nav, focus ring */
--accent-hover:  #FF9F43
--sand:          #D9C4A0   /* secondary accent: badges, highlights, chart secondary */
--sand-muted:    #3A3429   /* sand tinted surface */
--success:       #6FCF97
--warning:       #E8B04A
--danger:        #EB6B6B
```

**Principles**

- Dark by default; a light theme (whitesmoke background, ash text, same accents) is optional. Respect `prefers-color-scheme`, store the choice.
- Orange is **rare and meaningful**: primary buttons, active states, key numbers. Sand handles supporting emphasis. Everything else is ash and whitesmoke.
- Typography: Inter (or system UI stack) for text, a monospace (JetBrains Mono) for codes, roll numbers and hash codes. 14–16px base, generous line height.
- 8px spacing grid, 12px card radius, 1px ash borders, subtle shadows only. No gradients, no emoji icons. Use `lucide-react` for line icons.
- Layout: collapsible sidebar (desktop), bottom nav (mobile), sticky page header with filters, dense but breathable tables.
- Status pills: `1 / In library` = orange outline on sand-muted; `0 / Outside` = ash outline. Never rely on colour alone (include text and icon).
- Accessibility: WCAG AA contrast, visible focus rings, labelled inputs, keyboard-navigable tables, `aria-live` regions for scan results, reduced-motion support.
- Every screen has **loading skeleton, empty state, error state** designed, not default.
- Responsive from 360px. The scanner page is designed mobile-first.

---

## 12. Security, privacy and robustness ("bullet-proof" checklist)

**Authentication and sessions**
- No public sign-up. Clerk brute-force protection on. Optional MFA for admins.
- Server-side authorization on every route handler and server action (`requireRole()` helper). Deny by default.
- Time-window enforcement server-side (Section 7). Server clock only.

**Data protection**
- RLS on all tables; service-role key only in server code; env validated at boot with zod (app refuses to start if a secret is missing).
- Hash codes never stored, logged or sent in analytics. Redact them from server logs and error reports.
- Security headers via Next.js config: CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (camera allowed for self only), HSTS in production.
- CSRF-safe: state-changing requests need a valid Clerk session plus same-origin check.
- Input validation with zod on every endpoint; parameterised queries only; output encoding by React.

**Abuse protection**
- Rate limits: scan endpoint per scanner and per IP, credential reset per admin, webhook endpoint signature-verified.
- Idempotency keys on all scans. Duplicate-scan window. Replay protection via rotating QR buckets.

**Integrity**
- Immutable `movement_events` and `audit_logs` (DB triggers). Corrections are additive.
- Transactional scans with row-level locking, tested under concurrency.
- Every sensitive action (create/disable student, reset credentials, change windows, export, correction) writes an audit log with actor, IP and before/after metadata.

**Privacy**
- Collect the minimum personal data. Phone and guardian fields optional.
- Students see only their own data. No public profile pages. No location tracking beyond checkpoint scans.
- Configurable retention (default 180 days for movement events, 365 for audit) with a scheduled purge job that is itself audited.
- A missing scan is flagged for review, never treated as a violation.
- Privacy notice page and data-export-for-student (own data) endpoint.

**Operational**
- `GET /api/health` (checks DB reachability, returns version, no secrets).
- Structured JSON logging with request ids; Sentry free tier optional.
- Database backups: document Supabase backups, plus a documented manual `pg_dump` procedure and a restore drill. Seed and reset scripts for demo environments.
- Graceful error pages, offline banner, retry with backoff for transient failures.
- Feature flags in `app_settings` (rotating QR, offline queue, notifications) so risky features can be disabled without a deploy.

---

## 13. API surface

Route handlers under `app/api` (all return typed JSON, proper status codes, `{ error: { code, message } }` on failure, pagination via `?page=&pageSize=`).

```
Auth/Session
  GET   /api/me                          current profile + role + window status
  POST  /api/me/password-changed         clears must_change_password
  POST  /api/webhooks/clerk              session.created / session.ended (svix-verified)

Students (admin)
  GET   /api/students                    filters: category[], in_library, department, active,
                                         q, lastScanFrom/To, sort, page
  POST  /api/students                    register + generate username & hash code (returned once)
  GET   /api/students/:id
  PATCH /api/students/:id                edit non-identity fields, activate/deactivate
  POST  /api/students/:id/reset-credentials
  GET   /api/students/:id/history
  POST  /api/students/import             CSV dry-run + commit
  POST  /api/students/promote-year

Tag
  GET   /api/tag/token                   student: rotating signed QR token
  POST  /api/students/:id/tag/revoke     admin: rotate card_secret
  GET   /api/tags/print                  admin: batch print sheet

Scanning
  POST  /api/scans                       { token | roll_number, checkpoint_id, mode, idempotency_key, device_id }
  POST  /api/scans/sync                  offline queue replay (batch)

Library
  GET   /api/library/occupancy
  GET   /api/library/sessions            filters + pagination
  POST  /api/library/sessions/:id/resolve   admin exception resolution (writes correction)

Admin config
  GET/PUT /api/settings
  GET/PUT /api/access-windows
  GET/POST /api/access-overrides
  GET/POST/PATCH /api/checkpoints
  GET/POST/PATCH /api/scanners

Logs/Reports
  GET   /api/session-logs
  GET   /api/audit-logs
  GET   /api/reports/occupancy?from=&to=
  GET   /api/export/students.csv
  GET   /api/notifications   POST /api/notifications/:id/read
  GET   /api/health
```

Document these with a generated OpenAPI spec (for example `zod-to-openapi`) at `/api/docs` or in `docs/api.md`.

---

## 14. Phased build plan (feed these one at a time)

### Phase 1 — Foundation
**Prompt:** "Implement Phase 1 from instructions.md: scaffold Next.js + TS + Tailwind, design tokens, Clerk and Supabase wiring, env validation, SQL migrations for all tables, enums, indexes, triggers and RLS, `requireRole`, middleware with role gating (time windows stubbed), seed script (first admin, 3 checkpoints, access window defaults, 40 demo students across Y1–Y4 with fake generated credentials printed once). Include `docs/setup-clerk.md` and `docs/setup-supabase.md`."
**Acceptance:** `pnpm dev` runs; admin can sign in; non-admin cannot reach `/admin`; migrations apply cleanly on a fresh Supabase project; RLS blocks cross-student reads (test).

### Phase 2 — Admin students and registration
**Prompt:** "Implement Phase 2: Admin students list with combinable filters (category, in_library 0/1, department, active, search, date), URL-synced state, server pagination, sorting, CSV export; Add-student form with username + hash code generation, Clerk user creation, transactional rollback, one-time credential modal and credential slip print; reset credentials; activate/deactivate; audit logging."
**Acceptance:** Registering a student returns username + code once; that pair logs in as a student; code is absent from DB, logs and API responses on subsequent reads; filters combine correctly; unit tests for username/hash-code generators pass.

### Phase 3 — Access windows and session logs
**Prompt:** "Implement Phase 3: access_windows/overrides tables and admin UI, server-side enforcement in middleware and API (OUTSIDE_ACCESS_WINDOW), `/closed` page, countdown banner and auto sign-out, Clerk webhook handler writing session_logs, admin session-log view with filters and CSV export, student 'my recent logins' card."
**Acceptance:** With the clock set outside the window the student gets `/closed` and API 403s; overnight window works; webhook is idempotent and signature-verified; admin cannot lock themselves out.

### Phase 4 — ID tag and scanner
**Prompt:** "Implement Phase 4: rotating signed QR token endpoint, ID Tag component (student view, printable batch sheet), scanner page with camera scanning, checkpoint/mode selection, student preview, result cards, manual fallback, duplicate debounce, scan history, and the transactional `scan_student` function with the full state machine and reason codes. Update `students.in_library` and `library_sessions`; write immutable movement events."
**Acceptance:** Scan toggles 0→1→0; duplicate, expired token, inactive student, wrong checkpoint, unknown card each produce the correct rejection and a REJECTED_SCAN event; concurrent scans of the same student produce exactly one transition (test).

### Phase 5 — Dashboards, realtime, notifications, exceptions
**Prompt:** "Implement Phase 5: admin dashboard (live occupancy, per-category chart, recent scans), student dashboard, library occupancy widget for scanner, Supabase Realtime subscriptions with polling fallback, notification center, overdue detection cron (flags OPEN sessions past expected_exit_by / library closing time), exceptions queue with resolve-with-note flow writing correction events."
**Acceptance:** Scanning on one device updates the admin dashboard within ~2 seconds; overdue sessions appear as FLAGGED, not punished; resolutions create ADMIN_CORRECTION events and audit entries.

### Phase 6 — Robustness extras
**Prompt:** "Implement Phase 6: offline scan queue with sync and PENDING labelling, bulk CSV import with dry-run, year rollover tool, scanner account management, reports and exports, retention purge job, rate limiting, security headers, health endpoint, structured logging, PWA manifest, light-theme toggle."
**Acceptance:** Airplane-mode scans queue and sync correctly after reconnect with no duplicates; rate limits return 429; retention job is audited.

### Phase 7 — Testing, hardening, deployment, docs
**Prompt:** "Implement Phase 7: complete test suites (Section 15), GitHub Actions CI (lint, typecheck, unit, e2e), manual acceptance plan, deployment guide (Vercel + Supabase + Clerk, env var table, custom domain/HTTPS), backup and restore guide, README with screenshots checklist, and project documentation (Section 17)."
**Acceptance:** CI green; every item in Section 15 has a passing test or a documented manual step.

---

## 15. Testing requirements

**Unit (vitest):** username generator, hash-code generator (charset, length, entropy shape, similarity rejection), QR token sign/verify (tamper, expiry, version), state machine transitions, access-window evaluation (normal, overnight, override, boundaries), filter-to-query builder.

**Integration (against a test Supabase/Postgres):** RLS isolation (student A cannot read student B), immutable-table triggers, `scan_student` for every reason code, concurrency (fire 20 simultaneous scans for one student, assert exactly one valid transition), idempotency-key replay, rollback when Clerk creation fails mid-registration (mock Clerk).

**End-to-end (playwright):**
1. Admin registers a student and receives credentials.
2. Student logs in with the issued username/code and sees an ID tag.
3. Scanner scans (simulated token) → status 1 → admin list filter `in_library = 1` shows the student.
4. Scanner scans again → status 0.
5. Outside-window login lands on `/closed`.
6. Student attempts to open `/admin` → denied.
7. Offline queue syncs after reconnect.

**Manual acceptance plan:** a numbered demo script in `docs/acceptance.md` covering the full viva demonstration in under 10 minutes, with expected results per step.

---

## 16. Suggested folder structure

```
/app
  /(auth)/sign-in
  /(app)/admin/{dashboard,students,scanners,settings,access-windows,logs,reports}
  /(app)/student/{home,history,tag}
  /(app)/scanner
  /closed
  /api/...
/components/{ui,id-tag,scanner,students,charts,layout}
/features/{students,passes-sessions,scanning,access-windows,audit,notifications}
/lib/{server/{clerk,supabase,auth,state-machine,rate-limit},tag-token,username,hashcode,env,time}
/supabase/{migrations,seed.sql}
/scripts/{seed-admin.ts,seed-demo.ts}
/docs
/tests/{unit,integration,e2e}
instructions.md
```

---

## 17. Documentation deliverables

Problem statement; objectives; scope and limitations; functional and non-functional requirements; architecture diagram; ER diagram; data-flow diagram; use-case diagram; sequence diagrams for registration, login-window enforcement, library entry, library exit; API documentation; deployment guide; testing report; future enhancements (hostel-gate checkpoints, warden role, SMS/email alerts, analytics); final-year abstract; viva Q&A (why Clerk, why rotating QR, why immutable events, why server-side time checks, RLS vs service role, how concurrency is handled).

Use Mermaid in markdown for the diagrams so they render in GitHub.

---

## 18. Extra features backlog (build if time allows, in this order)

1. Rotating QR with countdown ring (included above, treat as core).
2. Warden read-only role scoped to a hostel, with hostel-wise occupancy.
3. Seat or zone capacity limits with a "library full" warning.
4. Daily summary email to admin via a free email provider (Resend free tier).
5. Student streaks and study-hours summary (opt-in, private).
6. Command palette (Cmd/Ctrl+K) for admin search.
7. Multi-language labels (English/Hindi) via a light i18n layer.
8. Printable daily attendance register PDF.
9. Dark/light/system theme with per-user persistence.
10. Maintenance mode flag that shows a friendly banner to non-admins.

---

## 19. Definition of done

- A fresh clone can be running locally in under 15 minutes following the README.
- Admin → register student → student logs in with generated credentials → scanner scans student → admin sees status flip to `1` live, and filtering by `in_library = 1` and by category works.
- No secret appears in client bundles, logs or repo history.
- All tests in Section 15 pass in CI; the manual acceptance plan is executed once and signed off.
- The app deploys on free tiers with documented limits and a rollback note.
