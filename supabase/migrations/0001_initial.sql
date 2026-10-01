create extension if not exists pgcrypto;

create type public.marketing_status as enum ('unknown','eligible','not_eligible','opted_out','suppressed');
create type public.campaign_status as enum ('draft','ready','sending','paused','completed','cancelled');

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique,
  full_name text,
  email text,
  category text,
  source text,
  old_whatsapp_field boolean not null default false,
  consent_source text,
  consent_at timestamptz,
  marketing_status public.marketing_status not null default 'unknown',
  opted_out_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_phone_e164_check check (phone_e164 ~ '^\\+[1-9][0-9]{6,14}$')
);

create index contacts_marketing_status_idx on public.contacts(marketing_status);
create index contacts_category_idx on public.contacts(category);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_name text not null,
  language_code text not null default 'en',
  status public.campaign_status not null default 'draft',
  target_filter jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  to_number text not null,
  meta_message_id text unique,
  status text not null default 'queued',
  provider_response jsonb,
  provider_status_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, contact_id)
);

create index messages_campaign_idx on public.messages(campaign_id);
create index messages_status_idx on public.messages(status);

create table public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  meta_message_id text unique,
  from_number text not null,
  message_type text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.contacts enable row level security;
alter table public.campaigns enable row level security;
alter table public.messages enable row level security;
alter table public.inbound_messages enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.contacts from anon, authenticated;
revoke all on public.campaigns from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.inbound_messages from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;

-- Server-side access uses the Supabase secret key. Browser clients receive no direct table privileges in MVP.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_set_updated_at before update on public.contacts
for each row execute function public.set_updated_at();

create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();

create trigger messages_set_updated_at before update on public.messages
for each row execute function public.set_updated_at();
