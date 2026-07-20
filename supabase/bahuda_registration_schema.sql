create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.volunteer_event_registrations (
  id uuid primary key default gen_random_uuid(),
  serial_no integer not null,
  event_key text not null,
  event_name text not null,
  mobile_number text not null,
  name text,
  gender text,
  age integer,
  college_working text,
  area_of_stay text,
  allocated_service_name text,
  attendance boolean not null default false,
  tshirt boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_event_registrations_event_mobile_key unique (event_key, mobile_number)
);

alter table public.volunteer_event_registrations
  add column if not exists allocated_service_name text,
  add column if not exists bahuda_allocated_service_name text,
  add column if not exists attendance boolean not null default false,
  add column if not exists tshirt boolean not null default false;

alter table public.volunteer_event_registrations
  alter column name drop not null,
  alter column gender drop not null,
  alter column college_working drop not null,
  alter column area_of_stay drop not null,
  alter column allocated_service_name drop not null,
  alter column bahuda_allocated_service_name drop not null,
  alter column attendance set default false,
  alter column tshirt set default false;

create index if not exists idx_volunteer_event_registrations_event_mobile on public.volunteer_event_registrations (event_key, mobile_number);
create index if not exists idx_volunteer_event_registrations_event_serial on public.volunteer_event_registrations (event_key, serial_no);

drop trigger if exists trg_volunteer_event_registrations_updated_at on public.volunteer_event_registrations;
create trigger trg_volunteer_event_registrations_updated_at
before update on public.volunteer_event_registrations
for each row execute function public.set_updated_at();

alter table public.volunteer_event_registrations enable row level security;

drop policy if exists "volunteer_event_registrations_all_access" on public.volunteer_event_registrations;
create policy "volunteer_event_registrations_all_access"
on public.volunteer_event_registrations
for all
using (true)
with check (true);

create table if not exists public.volunteer_registration_activity_logs (
  id uuid primary key default gen_random_uuid(),
  serial_no integer not null,
  event_key text not null,
  event_name text not null,
  mobile_number text not null,
  stage text not null,
  case_type text not null,
  found boolean not null default false,
  complete boolean not null default false,
  registration_saved boolean not null default false,
  missing_fields jsonb not null default '[]'::jsonb,
  name text,
  gender text,
  age integer,
  college_working text,
  area_of_stay text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.volunteer_registration_activity_logs
  add column if not exists missing_fields jsonb not null default '[]'::jsonb,
  add column if not exists name text,
  add column if not exists gender text,
  add column if not exists age integer,
  add column if not exists college_working text,
  add column if not exists area_of_stay text;

create index if not exists idx_volunteer_registration_activity_logs_event_created
  on public.volunteer_registration_activity_logs (event_key, created_at desc);
create index if not exists idx_volunteer_registration_activity_logs_event_mobile
  on public.volunteer_registration_activity_logs (event_key, mobile_number);

drop trigger if exists trg_volunteer_registration_activity_logs_updated_at on public.volunteer_registration_activity_logs;
create trigger trg_volunteer_registration_activity_logs_updated_at
before update on public.volunteer_registration_activity_logs
for each row execute function public.set_updated_at();

alter table public.volunteer_registration_activity_logs enable row level security;

drop policy if exists "volunteer_registration_activity_logs_all_access" on public.volunteer_registration_activity_logs;
create policy "volunteer_registration_activity_logs_all_access"
on public.volunteer_registration_activity_logs
for all
using (true)
with check (true);

alter table public.volunteers
  add column if not exists bahuda_allocated_service_name text;
