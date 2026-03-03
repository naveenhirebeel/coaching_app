# CoachingBuddy — User Guide

## What is this app?

CoachingBuddy is a coaching institute management system. It lets institute admins manage teachers, batches, and students, while teachers can mark daily attendance and send alerts to parents via Telegram.

---

## Setup (One-Time)

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

### 4. Get Parent Telegram Chat IDs

Each parent must:
1. Search your bot on Telegram and send any message (e.g. "Hi")
2. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find `chat.id` in the response — that is their Chat ID
4. Enter it when adding the student in the app

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
4. Add the 5 environment variables from `.env.local` in Vercel dashboard
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
- Enter batch name, subject, schedule (e.g. "Mon/Wed 5pm")

### Step 4 — Add Teachers
- Dashboard → **Teachers** → `+ Add Teacher`
- Enter name, phone
- Optionally add teacher's Telegram Chat ID for notifications

### Step 5 — Add Students
- Dashboard → **Students** → `+ Add Student`
- Enter student name, parent name, parent Telegram Chat ID, assign to a batch
- Students without a Telegram Chat ID will not receive alerts

### Step 6 — View Reports
- Dashboard → **Reports**
- Filter by batch and/or date range
- See present/absent counts and attendance % per student
- Students below 75% attendance are highlighted in red

---

## Teacher Flow

### Login
- Go to `/teacher/login`
- Use phone number as login (set by admin when creating the teacher)

### Mark Attendance
- Dashboard shows your assigned batches
- Tap a batch → all students default to **Present**
- Tap a student to toggle to **Absent** (turns red)
- Optional: check "Also notify parents of present students"
- Tap **Submit Attendance** → parents receive Telegram messages automatically

### Send Alerts
- Dashboard → **Send Alert**
- Choose a batch (or leave blank to message all batches)
- Use a quick template or type a custom message:
  - Holiday
  - Class Cancelled
  - Schedule Change
  - Exam Reminder
- Tap **Send Alert to Parents**

---

## Telegram Notifications

| Event | Who gets notified |
|---|---|
| Student marked absent | Parent gets absence alert with date, batch, institute phone |
| Student marked present (if enabled) | Parent gets present confirmation |
| Alert sent by teacher | All parents in selected batch |
| Student enrolled | Parent gets welcome message |

---

## URL Reference

| URL | Who uses it |
|---|---|
| `/admin/register` | New institute registration |
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

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (jsonwebtoken) |
| Notifications | Telegram Bot API |
| Hosting | Vercel (recommended) |
