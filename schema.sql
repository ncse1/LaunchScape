create extension if not exists pgcrypto;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  strap text unique,
  site_address text,
  site_city text,
  site_zip text,
  owner_name text,
  owner_address text,
  owner_city text,
  owner_state text,
  owner_zip text,
  just_value numeric,
  year_built integer,
  heated_area numeric,
  pool boolean,
  boat_dock boolean,
  seawall boolean,
  last_sale_date date,
  last_sale_amount numeric,
  score integer default 0,
  score_reasons jsonb default '[]'::jsonb,
  status text default 'New Prospect',
  assigned_to text default 'Michael Schwartz',
  next_action_date date,
  estimated_value numeric,
  services jsonb default '[]'::jsonb,
  source text default 'Lee County Parcel',
  campaign text,
  notes text,
  phone text,
  email text,
  contact_source text,
  contact_confidence text,
  best_contact_method text,
  do_not_contact boolean default false,
  last_verified date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  activity_type text,
  outcome text,
  note text,
  activity_at timestamptz default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  notes text,
  created_at timestamptz default now()
);

create index if not exists leads_status_idx on leads(status);
create index if not exists leads_next_action_idx on leads(next_action_date);
create index if not exists leads_score_idx on leads(score desc);
