# CoachingBuddy — User Guide

## What is this app?

CoachingBuddy is a coaching institute management system. It lets institute admins manage teachers, batches, and students, while teachers can mark daily attendance and send alerts to parents via Telegram.

---

## Live App

The app is hosted at:

**https://coaching-app-ebon.vercel.app**

| Role | Login URL |
|------|-----------|
| Admin | https://coaching-app-ebon.vercel.app/admin/login |
| Teacher | https://coaching-app-ebon.vercel.app/teacher/login |
| New Institute Registration | https://coaching-app-ebon.vercel.app/register |
| Super Admin | https://coaching-app-ebon.vercel.app/super-admin/login |

---

## Install on Mobile (Add to Home Screen)

The app is a Progressive Web App (PWA) — it can be installed on iPhone and Android like a native app, for free.

### iPhone (Safari only)

1. Open **Safari** and go to `https://coaching-app-ebon.vercel.app`
2. Tap the **Share button** (□↑) at the bottom centre of Safari
3. Scroll down and tap **"Add to Home Screen"**
4. The name will show as "CoachingBuddy" — tap **Add**
5. The app icon appears on your home screen and opens fullscreen

> Note: Must use Safari. Chrome on iPhone does not support Add to Home Screen.

### Android (Chrome)

1. Open **Chrome** and go to `https://coaching-app-ebon.vercel.app`
2. Tap the **3-dot menu** (top right)
3. Tap **"Add to Home Screen"** → **Install**
4. The app icon appears on your home screen

---

## Setup (One-Time, for developers)

### 1. Environment Variables

Create a `.env.local` file in the project root with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=any_random_secret_string
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

Get Supabase values from: Supabase Dashboard → your project → Settings → API

### 2. Database Setup

Run the SQL in `supabase-schema.sql` in your Supabase SQL Editor to create all tables.

### 3. Get your Telegram Bot Token

1. Open Telegram → search **@BotFather**
2. Send `/newbot` → follow instructions → copy the token
3. Add it to `.env.local` as `TELEGRAM_BOT_TOKEN`

### 4. Register the Telegram Webhook (one-time)

After deploying to Vercel, open this URL once in your browser:

```
https://coaching-app-ebon.vercel.app/api/telegram-webhook?action=setup
```

You should see `"ok": true` in the response. This tells Telegram to send all bot messages to your app automatically. You only need to do this once (or after changing your domain).

---

## Running Locally

```bash
npm run dev
```

App runs at `http://localhost:3000`

---

## Hosting on Vercel (Free)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub
3. New Project → Import your repo
4. Add the environment variables from `.env.local` in Vercel dashboard
5. Deploy — Vercel auto-deploys on every push to `main`

---

## Admin Flow

### Step 1 — Register your Institute
- Go to `/admin/register`
- Fill in institute name, phone, email, password
- This creates your account

### Step 2 — Login
- Go to `/admin/login`
- Use the email/password from registration

### Step 3 — Create Batches
- Dashboard → **Batches** → `+ Add Batch`
- Enter batch name, subject, and schedule slots (day + start/end time)

### Step 4 — Add Teachers
- Dashboard → **Teachers** → `+ Add Teacher`
- Enter name and phone number — that's all
- **Telegram links automatically:** ask the teacher to open your Telegram bot and send their 10-digit phone number (e.g. `9876543210`) — they are linked instantly, no admin action needed

### Step 5 — Add Students
- Dashboard → **Students** → `+ Add Student`
- Enter student name, parent name, assign to a batch
- **Telegram links automatically:** tap **Copy Link** next to the student and share it with the parent — the parent opens the link in Telegram, taps Start, and they are linked instantly. No Chat ID required

### Step 6 — View Reports
- Dashboard → **Reports**
- Filter by batch and/or date range
- See present/absent/late counts and attendance % per student
- Students below 75% attendance are highlighted in red
- Download as CSV or send individual report to parent via Telegram

---

## Teacher Flow

### Login
- Go to `/teacher/login`
- Use phone number as login (set by admin when creating the teacher)

### Mark Attendance
- Dashboard shows your assigned batches sorted by today's schedule
- Tap **Mark** on a batch → mark each student as Present / Late / Absent
- Optional: enable "Notify parents when marked Present"
- Parents receive Telegram messages automatically when marked
- Tap **Send Exit Alert** when a student leaves early

### Send Alerts
- Dashboard → **Send Alert** (or tap the Send Alerts button on a batch)
- Choose to send by batch or by individual student
- Use a quick template or type a custom message:
  - Holiday
  - Class Cancelled
  - Schedule Change
  - Exam Reminder
- Tap **Send Alert to Parents**

---

## Super Admin Flow

### Login
- Go to `/super-admin/login`

### Institute Management
- View all institutes by status: Pending, Active, Revoked, Suspended, Archived
- Approve, reject, suspend, or permanently delete institutes

### Institute Oversight
- Select any approved institute to view its full data:
  - **Batches** — all batches and schedules
  - **Teachers** — all teachers and Telegram status
  - **Students** — all students and parent link status
  - **Reports** — attendance reports with CSV download
  - **Comms** — all Telegram messages sent, with full message content
  - **Audit** — complete activity log (attendance marked, students enrolled, batches created, etc.)

---

## Telegram Notifications

| Event | Who gets notified |
|-------|-------------------|
| Student marked absent | Parent gets absence alert |
| Student marked late | Parent gets late alert |
| Student marked present (if enabled) | Parent gets present confirmation |
| Student exits early | Parent gets exit alert with time |
| Alert sent by teacher | All parents in selected batch |
| Student enrolled | Parent gets welcome message |
| Attendance report sent | Parent gets weekly/biweekly/monthly summary |

---

## URL Reference

| URL | Who uses it |
|-----|-------------|
| `/register` | New institute registration |
| `/admin/login` | Admin login |
| `/admin/dashboard` | Admin home |
| `/admin/batches` | Manage batches |
| `/admin/teachers` | Manage teachers |
| `/admin/students` | Manage students |
| `/admin/reports` | Attendance reports |
| `/teacher/login` | Teacher login |
| `/teacher/dashboard` | Teacher home |
| `/teacher/attendance` | Mark attendance |
| `/teacher/alerts` | Send parent alerts |
| `/super-admin/login` | Super admin login |
| `/super-admin/dashboard` | Institute management |
| `/super-admin/overview` | Institute data oversight |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (jsonwebtoken) |
| Notifications | Telegram Bot API |
| Hosting | Vercel |
| Mobile | PWA (installable on iPhone and Android) |
