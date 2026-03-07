-- CoachingBuddy — Full Schema
-- Run this in Supabase SQL Editor for a fresh setup.
-- For existing DBs, use the migration section at the bottom.

-- ─────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────

create table institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text unique not null,
  password text not null,
  address text,
  status text default 'pending' check (status in ('pending', 'approved', 'revoked', 'suspended', 'archived')),
  status_reason text,
  status_updated_at timestamptz,
  created_at timestamptz default now()
);

create table teachers (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references institutes(id) on delete cascade,
  name text not null,
  phone text not null,
  telegram_chat_id text,
  created_at timestamptz default now()
);

create table batches (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references institutes(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete set null,
  name text not null,
  subject text not null,
  schedule text,
  created_at timestamptz default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references institutes(id) on delete cascade,
  batch_id uuid references batches(id) on delete set null,
  name text not null,
  parent_name text,
  parent_telegram_chat_id text,
  created_at timestamptz default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references institutes(id) on delete cascade,
  batch_id uuid references batches(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  date date not null,
  status text check (status in ('present', 'absent', 'late')) not null,
  exit_time timestamptz,
  created_at timestamptz default now(),
  unique(student_id, date, batch_id)
);


-- ─────────────────────────────────────────────
-- MIGRATIONS (existing database)
-- Run only the blocks relevant to what you are adding.
-- ─────────────────────────────────────────────

-- 1. Institute account lifecycle (status columns)
-- alter table institutes add column if not exists status text default 'pending' check (status in ('pending', 'approved', 'revoked', 'suspended', 'archived'));
-- alter table institutes add column if not exists status_reason text;
-- alter table institutes add column if not exists status_updated_at timestamptz;
-- update institutes set status = 'approved' where status is null;

-- 2. Late attendance status + exit tracking
-- alter table attendance drop constraint if exists attendance_status_check;
-- alter table attendance add constraint attendance_status_check check (status in ('present', 'absent', 'late'));
-- alter table attendance add column if not exists exit_time timestamptz;
