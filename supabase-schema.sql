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
  schedule_slots jsonb default '[]', -- e.g. [{"day":"Mon","start":"16:00","end":"17:00"}]
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
  batch_id uuid references batches(id) on delete set null,
  student_id uuid references students(id) on delete cascade,
  date date not null,
  status text check (status in ('present', 'absent', 'late')) not null,
  exit_time timestamptz,
  created_at timestamptz default now()
  -- no unique constraint: multiple entries per student/day allowed for full audit log
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  event_type text not null check (event_type in ('attendance_marked', 'attendance_exit', 'student_enrolled', 'student_deleted', 'teacher_added', 'teacher_deleted', 'batch_created', 'batch_deleted', 'telegram_sent', 'telegram_failed')),
  actor_type text not null check (actor_type in ('admin', 'teacher', 'system')), -- who triggered the action
  actor_id text, -- admin/teacher user id or 'system' for automated
  entity_type text, -- what was affected: student, batch, teacher, attendance
  entity_id text, -- ID of affected entity
  entity_name text, -- human-readable name
  details jsonb, -- additional context (e.g. { status: 'present', batch: 'Math 101', old_value, new_value })
  created_at timestamptz default now()
);

create table telegram_message_log (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  batch_id uuid references batches(id) on delete set null,
  recipient_telegram_chat_id text not null, -- parent's chat ID
  message_type text not null check (message_type in ('present', 'absent', 'late', 'exit', 'alert')),
  message_content text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  sent_at timestamptz default now(),
  created_at timestamptz default now()
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

-- 3. Allow multiple attendance entries per student per day (full audit log)
-- alter table attendance drop constraint if exists attendance_student_id_date_batch_id_key;

-- 4. Batch schedule slots (JSONB — multiple day/time slots per batch)
-- alter table batches add column if not exists schedule_slots jsonb default '[]';

-- 5. Preserve attendance history when batch is deleted (set null instead of cascade)
-- alter table attendance drop constraint attendance_batch_id_fkey;
-- alter table attendance add constraint attendance_batch_id_fkey
--   foreign key (batch_id) references batches(id) on delete set null;

-- 6. Create activity_logs table (institute event tracking)
-- create table if not exists activity_logs (
--   id uuid primary key default gen_random_uuid(),
--   institute_id uuid not null references institutes(id) on delete cascade,
--   event_type text not null check (event_type in ('attendance_marked', 'attendance_exit', 'student_enrolled', 'student_deleted', 'teacher_added', 'teacher_deleted', 'batch_created', 'batch_deleted', 'telegram_sent', 'telegram_failed')),
--   actor_type text not null check (actor_type in ('admin', 'teacher', 'system')),
--   actor_id text,
--   entity_type text,
--   entity_id text,
--   entity_name text,
--   details jsonb,
--   created_at timestamptz default now()
-- );

-- 7. Create telegram_message_log table (communications tracking)
-- create table if not exists telegram_message_log (
--   id uuid primary key default gen_random_uuid(),
--   institute_id uuid not null references institutes(id) on delete cascade,
--   student_id uuid not null references students(id) on delete cascade,
--   batch_id uuid references batches(id) on delete set null,
--   recipient_telegram_chat_id text not null,
--   message_type text not null check (message_type in ('present', 'absent', 'late', 'exit', 'alert')),
--   message_content text not null,
--   status text not null default 'sent' check (status in ('sent', 'failed')),
--   sent_at timestamptz default now(),
--   created_at timestamptz default now()
-- );
