alter table public.campaigns
add column if not exists use_name_parameter boolean not null default false;
