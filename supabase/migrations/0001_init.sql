-- Omni TotalStack MSP — multi-tenant SaaS schema.
-- Every MSP that buys Omni is an "org". Its staff and its clients are org_members.
-- All workspace data lives in `records` (one row per item, JSON document) protected by Row Level Security.
-- A workspace that stops paying is locked at the DATABASE level (see org_live()).
-- Apply: Supabase → SQL editor → paste & run (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ── Organizations (MSP workspaces) ─────────────────────────────────────────
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  plan text not null default 'unlimited' check (plan in ('starter','unlimited','business','enterprise')),
  status text not null default 'pending' check (status in ('pending','active','past_due','suspended','canceled','disconnected')),
  license text not null default 'subscription' check (license in ('subscription','lifetime')), -- lifetime = Enterprise one-time purchase
  handoff_by timestamptz,                             -- Enterprise: hosted workspace stays on until this date, then disconnects
  handed_off_at timestamptz,
  comped boolean not null default false,              -- never billed (platform owner, partners)
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  grace_until timestamptz,                            -- set when a payment fails; locked after this
  custom_domain text unique,
  settings jsonb not null default '{}',               -- branding & policies (the app's "company" object)
  integrations jsonb not null default '{}',           -- NON-secret integration state (connected, public config)
  owner_user_id uuid references auth.users,
  created_at timestamptz default now()
);

create table org_members (
  org_id uuid references orgs on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('owner','admin','technician','finance','client')),
  client_id text,                                     -- for role=client: which client record they belong to
  name text,
  email text,
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs on delete cascade,
  email text not null,
  role text not null check (role in ('admin','technician','finance','client')),
  client_id text,
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz default now()
);

-- ── Workspace data ─────────────────────────────────────────────────────────
-- collection = clients | sites | contracts | documents | proposals | devices | patches | tickets | projects | inventory |
--              purchaseOrders | invoices | payments | employees | expenses | leads | appointments | scans | roadmap |
--              credentials | directoryUsers | audit | notifications
create table records (
  org_id uuid references orgs on delete cascade,
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  primary key (org_id, collection, id)
);
create index records_client on records (org_id, collection, (data->>'clientId'));

create table discovery_jobs (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, site_id text, range text, status text default 'queued', created_at timestamptz default now());

-- ── Server-only tables (RLS on, no policies → only the service role can read) ─
create table integration_secrets (org_id uuid references orgs on delete cascade, id text, config text not null, updated_at timestamptz default now(), primary key (org_id, id));
create table oauth_tokens (org_id uuid references orgs on delete cascade, provider text, access_token text, refresh_token text, realm_id text, expires_at timestamptz, primary key (org_id, provider));
create table billing_events (id text primary key, org_id uuid, type text, payload jsonb, created_at timestamptz default now());
create table agent_tokens (token text primary key default encode(gen_random_bytes(24), 'hex'), org_id uuid references orgs on delete cascade, created_at timestamptz default now());

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function my_role(o uuid) returns text language sql stable security definer set search_path = public as
  $$ select role from org_members where org_id = o and user_id = auth.uid() $$;
create or replace function my_client(o uuid) returns text language sql stable security definer set search_path = public as
  $$ select client_id from org_members where org_id = o and user_id = auth.uid() $$;
-- A workspace is usable when paid, inside its grace period, comped, or an Enterprise buyer before handoff.
create or replace function org_live(o uuid) returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from orgs where id = o and (
       comped
    or (status <> 'disconnected' and license = 'lifetime' and (handoff_by is null or handoff_by > now()))
    or (license = 'subscription' and (status = 'active' or (status = 'past_due' and (grace_until is null or grace_until > now())))))) $$;

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table orgs enable row level security;
alter table org_members enable row level security;
alter table invites enable row level security;
alter table records enable row level security;
alter table discovery_jobs enable row level security;
alter table integration_secrets enable row level security;
alter table oauth_tokens enable row level security;
alter table billing_events enable row level security;
alter table agent_tokens enable row level security;

-- Members can always SEE their org row (so a locked workspace can still show the billing screen).
create policy "members read org" on orgs for select using (my_role(id) is not null);
create policy "owner/admin update org settings" on orgs for update using (my_role(id) in ('owner','admin') and org_live(id))
  with check (my_role(id) in ('owner','admin'));
-- (plan/status/billing columns are changed only by the server; see trigger protect_billing_columns)

create policy "members read members" on org_members for select using (my_role(org_id) is not null);
create policy "owner/admin manage members" on org_members for delete using (my_role(org_id) in ('owner','admin'));
create policy "owner/admin read invites" on invites for select using (my_role(org_id) in ('owner','admin'));

-- Staff: everything in a live workspace, except finance data is owner/admin/finance only.
create policy "staff read" on records for select using (
  org_live(org_id) and my_role(org_id) in ('owner','admin','technician','finance')
  and (collection not in ('invoices','payments','expenses','employees') or my_role(org_id) in ('owner','admin','finance')));
create policy "staff write" on records for all using (
  org_live(org_id) and my_role(org_id) in ('owner','admin','technician','finance')
  and (collection not in ('invoices','payments','expenses','employees') or my_role(org_id) in ('owner','admin','finance')))
  with check (org_live(org_id) and my_role(org_id) in ('owner','admin','technician','finance'));
-- Client portal users: only their own client's tickets, invoices, payments, projects, devices, documents; may open tickets.
create policy "client read own" on records for select using (
  org_live(org_id) and my_role(org_id) = 'client'
  and ((collection = 'clients' and id = my_client(org_id))
    or (collection in ('tickets','invoices','payments','projects','devices','documents') and data->>'clientId' = my_client(org_id))));
create policy "client open tickets" on records for insert with check (
  org_live(org_id) and my_role(org_id) = 'client' and collection = 'tickets' and data->>'clientId' = my_client(org_id));

create policy "staff discovery" on discovery_jobs for all using (org_live(org_id) and my_role(org_id) in ('owner','admin','technician'));

-- ── Guards ────────────────────────────────────────────────────────────────
-- Browser users (roles anon/authenticated) can never change billing fields on their org;
-- only the server (service_role) or the database owner can.
create or replace function protect_billing_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.plan := old.plan; new.status := old.status; new.comped := old.comped;
    new.stripe_customer_id := old.stripe_customer_id; new.stripe_subscription_id := old.stripe_subscription_id;
    new.current_period_end := old.current_period_end; new.grace_until := old.grace_until; new.slug := old.slug;
    new.owner_user_id := old.owner_user_id; new.license := old.license; new.handoff_by := old.handoff_by; new.handed_off_at := old.handed_off_at;
  end if;
  return new;
end $$;
create trigger orgs_protect before update on orgs for each row execute function protect_billing_columns();

-- Plan limits (clients / devices) enforced in the database — only Starter is capped (1 client, 25 devices).
create or replace function enforce_plan_limits() returns trigger language plpgsql security definer set search_path = public as $$
declare p text; c boolean; lim int; n int;
begin
  if new.collection not in ('clients','devices') then return new; end if;
  select plan, comped into p, c from orgs where id = new.org_id;
  if c or p <> 'starter' then return new; end if;
  lim := case new.collection when 'clients' then 1 else 25 end;
  select count(*) into n from records where org_id = new.org_id and collection = new.collection;
  if n >= lim then raise exception 'PLAN_LIMIT: the Starter plan includes % %. Upgrade to Unlimited to add more.', lim, case when lim = 1 then 'client' else new.collection end; end if;
  return new;
end $$;
create trigger records_limits before insert on records for each row execute function enforce_plan_limits();

-- Seat limits (staff members) enforced in the database.
create or replace function enforce_seat_limits() returns trigger language plpgsql security definer set search_path = public as $$
declare p text; c boolean; lim int; n int;
begin
  if new.role = 'client' then return new; end if;
  select plan, comped into p, c from orgs where id = new.org_id;
  if c or p = 'enterprise' then return new; end if;
  lim := case p when 'starter' then 1 when 'unlimited' then 2 when 'business' then 10 else 1000000 end;
  select count(*) into n from org_members where org_id = new.org_id and role <> 'client';
  if n >= lim then raise exception 'SEAT_LIMIT: your plan allows % staff seat(s). Upgrade to add more.', lim; end if;
  return new;
end $$;
create trigger members_limits before insert on org_members for each row execute function enforce_seat_limits();

-- Keep updated_at fresh
create or replace function touch() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger records_touch before update on records for each row execute function touch();

-- Realtime so every open screen in a workspace stays in sync
alter publication supabase_realtime add table records;
alter publication supabase_realtime add table orgs;
