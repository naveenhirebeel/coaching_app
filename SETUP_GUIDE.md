# CoachingBuddy — Setup & Deployment Guide

---

## Prerequisites

Make sure you have these installed before starting:

- [Node.js](https://nodejs.org) v18 or higher
- npm (comes with Node.js)
- git

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/naveenhirebeel/coaching_app.git
cd coaching_app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=any_long_random_string
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

> **Note:** `.env.local` is in `.gitignore` and will never be committed. Keep it safe.

### 4. Run the development server

```bash
npm run dev
```

App runs at `http://localhost:3000`

---

## Supabase Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **New Project**
3. Choose a name, set a database password, select a region
4. Wait for the project to be ready (~1 minute)

### 2. Create database tables

1. In your Supabase project, go to **SQL Editor**
2. Open `supabase-schema.sql` from this repo
3. Paste the contents into the SQL Editor
4. Click **Run**

This creates 5 tables: `institutes`, `teachers`, `batches`, `students`, `attendance`

### 3. Get your API keys

Go to your Supabase project → **Settings** → **API**

| Key | Where to find it | Used for |
|---|---|---|
| Project URL | "Project URL" section | `NEXT_PUBLIC_SUPABASE_URL` |
| anon / public key | "Project API keys" section | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role key | "Project API keys" section | `SUPABASE_SERVICE_ROLE_KEY` |

> **Warning:** Never expose the `service_role` key in frontend code. It bypasses Row Level Security.

### 4. Row Level Security (RLS)

By default Supabase enables RLS on tables. The app uses the `service_role` key for all backend API routes which bypasses RLS, so no RLS policies are required for basic operation.

---

## Telegram Bot Setup

### 1. Create a bot

1. Open Telegram → search **@BotFather**
2. Send `/newbot`
3. Follow the prompts (give your bot a name and username)
4. Copy the token — it looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`
5. Add it to `.env.local` as `TELEGRAM_BOT_TOKEN`

### 2. Get a parent's Chat ID

Each parent must message your bot first before you can send them notifications.

1. Parent opens Telegram → searches your bot → sends any message (e.g. "Hi")
2. You visit this URL in a browser:
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
3. Find the `chat.id` field in the JSON response — this is their Chat ID
4. Enter this number in the "Parent Telegram Chat ID" field when adding a student

> **Tip:** The Chat ID is a number like `987654321`. If `getUpdates` returns empty, ask the parent to send another message to the bot and try again.

---

## Vercel Hosting (Recommended)

Vercel is the best hosting option for Next.js — it's free for personal projects and auto-deploys on every git push.

### 1. Push your code to GitHub

```bash
git_personal   # uses the alias set up in ~/.zshrc
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with your GitHub account (`naveenhirebeel`)
3. Click **Add New Project**
4. Select your `coaching_app` repository
5. Click **Import**

### 3. Add environment variables

Before deploying, add all 5 env vars in the Vercel dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `TELEGRAM_BOT_TOKEN`

Go to: Project → **Settings** → **Environment Variables**

### 4. Deploy

Click **Deploy**. Vercel builds and hosts your app.

Your app gets a free URL like: `https://coaching-app-xxx.vercel.app`

### 5. Auto-deploy on push

Every time you push to `main`, Vercel automatically rebuilds and deploys.

```bash
git add .
git commit -m "your changes"
git_personal
```

---

## Environment Variables Reference

| Variable | Where to get it | Public/Secret |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Public (safe to expose) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key | Public (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key | **Secret — never expose** |
| `JWT_SECRET` | Make up any long random string | **Secret — never expose** |
| `TELEGRAM_BOT_TOKEN` | Telegram @BotFather | **Secret — never expose** |

> Variables prefixed with `NEXT_PUBLIC_` are embedded in the browser bundle. All others are server-side only.

---

## Build for Production (optional local test)

```bash
npm run build
npm run start
```

This simulates the production environment locally on `http://localhost:3000`.
