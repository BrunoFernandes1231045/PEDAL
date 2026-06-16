-- supabase/migrations/001_initial_schema.sql

create table localities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  dob date,
  phone text,
  email text unique not null,
  stage text not null default 'welcome',
  locality_id uuid references localities(id),
  periods jsonb default '[]',
  nif text,
  signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  node text,
  created_at timestamptz not null default now()
);

create table onboarding (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references candidates(id) on delete cascade,
  practical_date date,
  scheduling jsonb default '[]',
  formalization_data jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  module_id integer not null check (module_id between 1 and 6),
  completed boolean not null default false,
  completed_at timestamptz,
  unique (candidate_id, module_id)
);

create table contact_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  question text not null,
  answer text,
  status text not null default 'pending' check (status in ('pending', 'answered')),
  module_id integer check (module_id between 1 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trainers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text,
  locality_id uuid references localities(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  locality_id uuid references localities(id),
  created_at timestamptz not null default now()
);

create table needs (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid references localities(id),
  periods jsonb default '[]',
  status text not null default 'open' check (status in ('open', 'closed')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
