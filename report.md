# Campus SafePass: Central Library & Hostel Digital Pass System
## Complete System Documentation & Operational Manual

---

### Executive Summary

The **Central Library & Hostel Digital Pass System (Campus SafePass)** is a web-based platform designed to replace legacy paper logbooks, manual sign-in sheets, and physical library cards with secure, real-time digital passes.

Paper registers in student hostels and campus libraries suffer from several critical issues:
- **Forged Entries & Proxy Sign-ins:** Students sign in for friends or write illegible roll numbers.
- **Lost Passes & Shared Photos:** Physical cards or static QR screenshots get shared between students.
- **Zero Real-Time Visibility:** Wardens and librarians have no instant way of knowing how many students are inside the library at 10:00 PM.
- **Gate Bottlenecks:** Security guards spending 30 seconds handwriting details create long queues at library closing times.

**Campus SafePass** solves all these challenges through an intuitive digital pass displayed directly on student smartphones, scanned using ordinary camera phones or tablets at checkpoint desks, and monitored 24/7 by administrators.

---

## 1. System Roles & Access Levels

The system organizes campus access into three distinct user roles:

```
                  ┌──────────────────────────────┐
                  │       System Roles           │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   🎓 Student              📷 Scanner Desk         🛡️ Administrator
 • View Digital Pass     • Device Camera Scan    • Real-time Headcount
 • Live Entry/Exit State • Auto In/Out Detect    • Student Directory
 • Personal Visit Log    • Flashlight & Flip     • Add / Delete Students
 • Study Timer           • Manual Roll Number    • Reset Passwords & Logs
```

### 1. 🎓 Student (Pass Holder)
- Access to their personal **Digital Pass** displaying their photo, name, roll number, department, and hostel.
- **Anti-Screenshot Security:** A dynamic barcode and rotating security code that updates automatically every 30 seconds.
- **Live Location Status:** Instant indicator showing whether they are currently **"In Library"** or **"Outside"**.
- **Visit History:** A clear timeline showing their past check-ins, check-outs, and study durations.

### 2. 📷 Scanner (Library Desk & Security Staff)
- Designed to run on any smartphone, tablet, or laptop equipped with a camera.
- **Fast Camera Scanning:** Uses the device camera with an on-screen targeting frame.
- **Device Controls:** Dedicated buttons to toggle camera light (torch) for dark gates and switch between front and back cameras.
- **Smart Automatic Direction:** Automatically checks a student **IN** if they are outside, and checks them **OUT** if they are inside.
- **Instant Audio & Haptic Feedback:** High pleasant chime on entry, double chime on exit, and warning buzz if a student attempts an invalid scan.
- **Manual Roll Number Search:** Allows security staff to look up and check students in manually if a student's phone battery has died.

### 3. 🛡️ Administrator (Hostel Wardens & Library Chiefs)
- **Live Occupancy Dashboard:** Real-time count of students currently inside the library, capacity gauges, and today's total visits.
- **Student Roster:** Instant search and filters by hostel, academic year, department, and current location.
- **Add Students:** Register new students with automatic username and password generation.
- **Delete Students:** Safely remove graduated, transferred, or unwanted student records with a single click and confirmation prompt.
- **Account Controls:** Instantly reset passwords or temporarily deactivate pass privileges.
- **Timings & Hours:** Configure daily library opening and closing hours, exam extensions, and holiday schedules.
- **Audit History:** Full log of administrative actions (who added/deleted a student, who reset a password, and when).
- **Downloadable Reports:** Export student lists and attendance records to Excel-compatible CSV files.

---

## 2. Key Features & How They Work

### A. Anti-Screenshot Digital Pass
To ensure students do not take a screenshot of their pass and message it to friends:
1. The student pass barcode and verification code refresh automatically every 30 seconds.
2. A pulsing green dot and live countdown timer show security staff that the pass is live on screen.
3. If an old screenshot is scanned, the scanner terminal immediately rejects it as expired.

### B. Device Camera Turnstile Scanner
1. Staff members open the scanner screen on their phone or tablet (`/scanner`).
2. The scanner accesses the device camera and displays a live scanning window.
3. The guard points the camera at the student's phone.
4. The system validates the student in under 300 milliseconds.
5. **Accidental Double-Scan Guard:** If a student accidentally holds their phone in front of the camera twice, the system ignores scans for 10 seconds, preventing accidental check-outs.

### C. Student Deletion & Management (Admin Feature)
Administrators have complete control over student records:
- **Where to find it:** Open **Students** from the admin navigation menu.
- **Desktop Table:** Click the red **Trash Can** icon on the right side of any student row.
- **Mobile Cards:** Tap the **Delete** button at the bottom of the student card.
- **Confirmation Modal:** A warning modal appears showing the student's name and roll number.
- **Safe Execution:** Once confirmed, the student record and login profile are permanently removed, and the action is recorded in the administrative log.

### D. Scheduled Study Hours
- Campus rules specify when students are permitted to visit the library (e.g., 17:00 to 23:30 IST).
- Outside designated study hours, the student portal displays a friendly **"Library Closed"** notice with a live countdown to the next opening time.
- Administrators can adjust these hours or add holiday exceptions anytime from the **Library Timings** page.

---

## 3. Step-by-Step User Guides

### How a Student Uses the System
1. Open the website on any smartphone and tap **Sign In**.
2. Enter your roll number/username and password (or tap **Instant Student Login** on the demo page).
3. The **Digital Student Pass** is displayed immediately on screen.
4. When reaching the library entrance, present your screen to the staff member.
5. As soon as the pass is scanned, your screen updates to **"In Library"** and your study timer begins.
6. When leaving, show your pass once more to check out.

### How Library Staff Scans Students
1. Open the website on the desk phone or tablet and sign in as **Scanner**.
2. Tap **Allow Camera Access** when prompted by your browser.
3. The screen will display the live camera feed with an alignment square.
4. Keep the scanner mode set to **Automatic (In & Out)**.
5. When a student shows their pass:
   - If the student was outside, the screen turns **Green** with an entry chime.
   - If the student was inside, the screen turns **Blue** with an exit chime.
6. If the student's phone battery is dead:
   - Tap **Manual Lookup**.
   - Type their roll number or name.
   - Tap **Check In** or **Check Out**.

### How an Admin Deletes an Unwanted Student
1. Sign in as **Admin**.
2. Click **Students** in the navigation bar.
3. Use the search bar to locate the student by name or roll number.
4. Click the red **Trash Can** icon next to the student.
5. Review the warning dialog: *"Are you sure you want to delete [Student Name]?"*
6. Click **Confirm Delete**.
7. The student is removed from the system immediately and will no longer be able to sign in or use their pass.

---

## 4. Mobile Responsiveness & Ease of Use

The application is built mobile-first so it works seamlessly on any screen size:

| Feature | Desktop Experience | Mobile Phone Experience (< 768px) |
| :--- | :--- | :--- |
| **Admin Navigation** | Full horizontal navigation bar with shortcuts | Collapsible hamburger drawer that preserves screen space |
| **Student Roster** | Multi-column table with quick sort & filters | Clean touch cards with quick action buttons (`Timeline`, `Delete`) |
| **Pass Scanner** | Dual-pane layout (camera on left, log on right) | Full-width camera viewfinder with touch controls under the feed |
| **Student Pass** | Centered ID badge with side information | Edge-to-edge touch-friendly digital card with large barcode |

---

## 5. Quick Reference: Demo Accounts

For demonstration, testing, and evaluation, pre-configured accounts are ready to use:

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Complete management, student roster, delete student, view reports |
| **Scanner Staff** | `scanner` | `scanner123` | Camera turnstile scanner, manual roll number lookup |
| **Student** | `student` | `student123` | Digital library pass view, visit history, live location indicator |

> **Tip:** On the **Sign In** screen, you can also click any of the 1-click quick login buttons to sign in without typing.

---

## 6. Database Setup Guide (For IT Administrators)

The system is powered by **Next.js** and backed by **Supabase Postgres**.

### Step 1: Connect Supabase
Create a `.env.local` file in the project root containing your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AUTH_SECRET=your-secret-passphrase
```

### Step 2: Run the Database Setup Script
1. Open your Supabase Dashboard at [https://supabase.com](https://supabase.com).
2. Click on **SQL Editor** in the left sidebar.
3. Open the file `supabase/master_schema_and_seed.sql` from this project.
4. Copy the entire file contents and paste them into the Supabase SQL Editor.
5. Click **Run**.

This single script automatically sets up:
- The `profiles` table for secure logins (admin, staff, student).
- The `students` table containing roll numbers, departments, hostels, and live locations.
- The `movement_events` table for recording every entry and exit.
- The `audit_logs` table for tracking admin actions and deletions.
- Automated security policies ensuring data privacy.

---

## 7. Frequently Asked Questions (FAQ)

#### Q1: What happens if the internet goes down?
The application includes a built-in local fallback mode. If the cloud database is temporarily unreachable, the system continues running in memory without crashing, allowing scans to continue uninterrupted.

#### Q2: Can a student share their pass screenshot with a friend?
No. Pass codes refresh every 30 seconds and include an animated live verification dot. Screenshots expire within seconds and are rejected by the scanner.

#### Q3: What if a student forgets their phone?
Security staff can tap **Manual Lookup** directly on the scanner screen, type the student's roll number, and verify their identity using their photo.

#### Q4: What happens when an admin deletes a student?
The student's record and login credentials are permanently deleted from both the student directory and login database. A permanent entry is recorded in the activity log showing which admin performed the deletion.

#### Q5: Can a guard accidentally scan a student twice?
No. The scanner includes a built-in duplicate scan guard. If the same pass is presented within 10 seconds, the scanner displays an orange warning badge: *"Already Scanned (Wait 10s)"* and prevents a double check-out.

---

*Report prepared for KIIT Central Library & Hostel Administration.*
