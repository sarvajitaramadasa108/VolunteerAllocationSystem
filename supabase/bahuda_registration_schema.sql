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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_event_registrations_event_mobile_key unique (event_key, mobile_number)
);

alter table public.volunteer_event_registrations
  alter column name drop not null,
  alter column gender drop not null,
  alter column college_working drop not null,
  alter column area_of_stay drop not null;

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
