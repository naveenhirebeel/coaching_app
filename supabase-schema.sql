-- Run this in Supabase SQL Editor to create all tables

create table institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text unique not null,
  password text not null,
  address text,
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
  status text check (status in ('present', 'absent')) not null,
  created_at timestamptz default now(),
  unique(student_id, date, batch_id)
);
