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
  email text,
  password_hash text,
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
  monthly_fee numeric(10, 2), -- default fee used when generating monthly invoices for this batch
  created_at timestamptz default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references institutes(id) on delete cascade,
  batch_id uuid references batches(id) on delete set null,
  name text not null,
  parent_name text,
  parent_mobile text,
  parent_telegram_chat_id text,
  parent2_name text,
  parent2_mobile text,
  parent2_telegram_chat_id text,
  created_at timestamptz default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references institutes(id) on delete cascade,
  batch_id uuid references batches(id) on delete set null,
  student_id uuid references students(id) on delete cascade,
  date date not null,
  status text check (status in ('present', 'absent', 'late')) not null,
  marked_at timestamptz, -- teacher-chosen entry time (adjustable); falls back to created_at when null
  exit_time timestamptz,
  created_at timestamptz default now()
  -- no unique constraint: multiple entries per student/day allowed for full audit log
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  event_type text not null check (event_type in ('attendance_marked', 'attendance_exit', 'student_enrolled', 'student_deleted', 'teacher_added', 'teacher_deleted', 'batch_created', 'batch_deleted', 'telegram_sent', 'telegram_failed', 'fee_charged', 'fee_paid', 'fee_waived')),
  actor_type text not null check (actor_type in ('admin', 'teacher', 'system')), -- who triggered the action
  actor_id text, -- admin/teacher user id or 'system' for automated
  entity_type text, -- what was affected: student, batch, teacher, attendance
  entity_id text, -- ID of affected entity
  entity_name text, -- human-readable name
  details jsonb, -- additional context (e.g. { status: 'present', batch: 'Math 101', old_value, new_value })
  created_at timestamptz default now()
);

create table parent_report_requests (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  requested_date date not null,
  created_at timestamptz default now(),
  unique(chat_id, requested_date)
);

-- Fee charges owed by a student. One row per billing period (recurring monthly)
-- or per ad-hoc charge. amount_paid is a denormalized running total kept in sync
-- from the fee_payments ledger (see recomputeInvoice in lib/fees.ts).
create table fee_invoices (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  batch_id uuid references batches(id) on delete set null, -- preserve fee history if batch deleted
  period_label text not null, -- human-readable, e.g. "July 2026" or "Admission Fee"
  period_month date, -- first day of the billed month for recurring invoices; null for ad-hoc charges
  amount numeric(10, 2) not null check (amount >= 0),
  amount_paid numeric(10, 2) not null default 0 check (amount_paid >= 0),
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'waived')),
  notes text,
  created_at timestamptz default now()
);

-- One recurring invoice per student per month; ad-hoc charges (period_month null) are unconstrained.
create unique index fee_invoices_student_month_uniq
  on fee_invoices (student_id, period_month) where period_month is not null;
create index fee_invoices_institute_status_idx on fee_invoices (institute_id, status);

-- Append-only ledger of money received against an invoice. Corrections are made
-- by inserting a negative-amount reversal row, never by editing/deleting, so the
-- ledger stays a complete audit trail.
create table fee_payments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  invoice_id uuid not null references fee_invoices(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  amount numeric(10, 2) not null, -- may be negative for a reversal
  mode text not null check (mode in ('cash', 'upi', 'card', 'bank', 'cheque')),
  reference text, -- UPI ref / cheque no. / txn id
  note text,
  recorded_by text, -- admin/teacher user id from token
  recorded_by_role text check (recorded_by_role in ('admin', 'teacher')),
  paid_at timestamptz default now(),
  created_at timestamptz default now()
);

create index fee_payments_invoice_idx on fee_payments (invoice_id);
create index fee_payments_institute_idx on fee_payments (institute_id, paid_at desc);

create table telegram_message_log (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  batch_id uuid references batches(id) on delete set null,
  recipient_telegram_chat_id text not null, -- parent's chat ID
  message_type text not null check (message_type in ('present', 'absent', 'late', 'exit', 'alert', 'schedule_change', 'report', 'today_class_reminder')),
  message_content text not null,
  status text not null default 'sent' check (status in ('sent', 'delivered', 'blocked', 'failed', 'pending')),
  telegram_message_id bigint, -- id returned by Telegram on delivery (used to edit/correlate)
  acknowledged_at timestamptz, -- set when parent taps the "👍 Got it" button
  acknowledged_by_chat_id text,
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

-- 4. Preserve attendance history when batch is deleted (set null instead of cascade)
-- alter table attendance drop constraint attendance_batch_id_fkey;
-- alter table attendance add constraint attendance_batch_id_fkey
--   foreign key (batch_id) references batches(id) on delete set null;

-- 5. Adjustable marking time (teacher-chosen entry time; falls back to created_at when null)
-- alter table attendance add column if not exists marked_at timestamptz;

-- 6. Batch schedule slots (JSONB — multiple day/time slots per batch)
-- alter table batches add column if not exists schedule_slots jsonb default '[]';

-- 7. Parent mobile number for auto-linking Telegram
-- alter table students add column if not exists parent_mobile text;
-- alter table students add column if not exists parent2_mobile text;

-- 8. Teacher email + password auth
-- alter table teachers add column if not exists email text;
-- alter table teachers add column if not exists password_hash text;

-- 9. Create activity_logs table (institute event tracking)
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

-- 10. Parent report request throttle (once per day per chat ID)
-- create table if not exists parent_report_requests (
--   id uuid primary key default gen_random_uuid(),
--   chat_id text not null,
--   requested_date date not null,
--   created_at timestamptz default now(),
--   unique(chat_id, requested_date)
-- );

-- 11. Create telegram_message_log table (communications tracking)
-- create table if not exists telegram_message_log (
--   id uuid primary key default gen_random_uuid(),
--   institute_id uuid not null references institutes(id) on delete cascade,
--   student_id uuid not null references students(id) on delete cascade,
--   batch_id uuid references batches(id) on delete set null,
--   recipient_telegram_chat_id text not null,
--   message_type text not null check (message_type in ('present', 'absent', 'late', 'exit', 'alert', 'schedule_change', 'report', 'today_class_reminder')),
--   message_content text not null,
--   status text not null default 'sent' check (status in ('sent', 'delivered', 'blocked', 'failed', 'pending')),
--   telegram_message_id bigint,
--   acknowledged_at timestamptz,
--   acknowledged_by_chat_id text,
--   sent_at timestamptz default now(),
--   created_at timestamptz default now()
-- );

-- 12. Extend telegram_message_log to allow schedule_change and report message types
-- alter table telegram_message_log drop constraint if exists telegram_message_log_message_type_check;
-- alter table telegram_message_log add constraint telegram_message_log_message_type_check
--   check (message_type in ('present', 'absent', 'late', 'exit', 'alert', 'schedule_change', 'report', 'today_class_reminder'));

-- 13. Delivery flow: granular send status + parent acknowledgment tracking
-- alter table telegram_message_log drop constraint if exists telegram_message_log_status_check;
-- alter table telegram_message_log add constraint telegram_message_log_status_check
--   check (status in ('sent', 'delivered', 'blocked', 'failed', 'pending'));
-- alter table telegram_message_log add column if not exists telegram_message_id bigint;
-- alter table telegram_message_log add column if not exists acknowledged_at timestamptz;
-- alter table telegram_message_log add column if not exists acknowledged_by_chat_id text;

-- 14. Fee collection module (invoices + payment ledger)
-- alter table batches add column if not exists monthly_fee numeric(10, 2);
--
-- create table if not exists fee_invoices (
--   id uuid primary key default gen_random_uuid(),
--   institute_id uuid not null references institutes(id) on delete cascade,
--   student_id uuid not null references students(id) on delete cascade,
--   batch_id uuid references batches(id) on delete set null,
--   period_label text not null,
--   period_month date,
--   amount numeric(10, 2) not null check (amount >= 0),
--   amount_paid numeric(10, 2) not null default 0 check (amount_paid >= 0),
--   due_date date,
--   status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'waived')),
--   notes text,
--   created_at timestamptz default now()
-- );
-- create unique index if not exists fee_invoices_student_month_uniq
--   on fee_invoices (student_id, period_month) where period_month is not null;
-- create index if not exists fee_invoices_institute_status_idx on fee_invoices (institute_id, status);
--
-- create table if not exists fee_payments (
--   id uuid primary key default gen_random_uuid(),
--   institute_id uuid not null references institutes(id) on delete cascade,
--   invoice_id uuid not null references fee_invoices(id) on delete cascade,
--   student_id uuid not null references students(id) on delete cascade,
--   amount numeric(10, 2) not null,
--   mode text not null check (mode in ('cash', 'upi', 'card', 'bank', 'cheque')),
--   reference text,
--   note text,
--   recorded_by text,
--   recorded_by_role text check (recorded_by_role in ('admin', 'teacher')),
--   paid_at timestamptz default now(),
--   created_at timestamptz default now()
-- );
-- create index if not exists fee_payments_invoice_idx on fee_payments (invoice_id);
-- create index if not exists fee_payments_institute_idx on fee_payments (institute_id, paid_at desc);

-- 15. Fee audit events in activity_logs
-- alter table activity_logs drop constraint if exists activity_logs_event_type_check;
-- alter table activity_logs add constraint activity_logs_event_type_check
--   check (event_type in ('attendance_marked', 'attendance_exit', 'student_enrolled', 'student_deleted', 'teacher_added', 'teacher_deleted', 'batch_created', 'batch_deleted', 'telegram_sent', 'telegram_failed', 'fee_charged', 'fee_paid', 'fee_waived'));
