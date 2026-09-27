-- Omni TotalStack MSP — initial schema (multi-tenant: every MSP is an "org").
-- Apply with:  supabase db push   (or paste into Supabase → SQL editor)
create extension if not exists "pgcrypto";

-- ── Tenancy ───────────────────────────────────────────────────────────────
create table orgs (id uuid primary key default gen_random_uuid(), name text not null, plan text not null default 'free_forever' check (plan in ('free_forever','unlimited','business','enterprise')), created_at timestamptz default now());
create table org_members (org_id uuid references orgs on delete cascade, user_id uuid references auth.users on delete cascade, role text not null default 'technician' check (role in ('owner','admin','technician','finance','client')), client_id uuid, primary key (org_id, user_id));
create or replace function my_orgs() returns setof uuid language sql stable security definer as $$ select org_id from org_members where user_id = auth.uid() $$;

-- ── Company / settings ───────────────────────────────────────────────────
create table company (org_id uuid primary key references orgs on delete cascade, name text, legal_name text, address text, city text, state text, zip text, phone text, email text, website text, logo_url text, accent text default 'blue', tax_rate numeric default 7, payment_terms_days int default 30, labor_rate numeric default 125, after_hours_rate numeric default 187.5, huntress_portal_url text, weekly_email_day int default 1, weekly_email_hour int default 8, patch_soak_days int default 15);

-- ── Business Suite ───────────────────────────────────────────────────────
create table clients (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, name text not null, "group" text default 'General', status text default 'prospect', contact_name text, contact_title text, contact_email text, contact_phone text, address text, owner_name text, owner_address text, prime_contractor_name text, prime_contractor_address text, sla_tier text default 'Essential', mrr numeric default 0, autopay boolean default false, payment_method text, stripe_customer text, huntress_org_id text, m365_tenant_id text, notes text, created_at timestamptz default now());
create table sites (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, name text, address text, status text default 'online' check (status in ('online','degraded','down')), isp text, wan_ip text, unifi_site_id text, last_check timestamptz, uptime_30d numeric);
create table outages (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, site_id uuid references sites on delete cascade, start timestamptz not null default now(), "end" timestamptz, cause text);
create table contracts (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, site_id uuid references sites on delete set null, name text, type text, vendor text, start_date date, end_date date, value numeric, billing text, auto_renew boolean default true);
create table documents (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, name text, category text, status text, ref_id uuid, body text, file_path text, created_at timestamptz default now());
create table proposals (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, number text, status text default 'draft', intake jsonb, executive_summary text, findings jsonb, options jsonb, selected int, rfs_number text, rfs_date timestamptz, created_at timestamptz default now());
create table price_catalog (org_id uuid references orgs on delete cascade, sku text, name text, category text, price numeric, unit text, recurring boolean, mandatory boolean default false, primary key (org_id, sku));
create table leads (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, name text, email text, phone text, company text, employees text, interest text[], message text, source text, status text default 'new', created_at timestamptz default now());
create table appointments (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, lead_id uuid references leads on delete set null, name text, email text, phone text, start timestamptz, topic text, status text default 'booked');
create table roadmap (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, category text, finding text, recommendation text, priority text, quarter text, status text default 'open', est_cost numeric);

-- ── Finance ──────────────────────────────────────────────────────────────
create table invoices (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, number text, issue_date date, due_date date, lines jsonb not null default '[]', status text default 'draft', paid_date date, recurring text, last_service_date date, work_description text, tax_rate numeric default 0, qbo_id text);
create table payments (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, invoice_id uuid references invoices on delete set null, client_id uuid references clients on delete cascade, amount numeric, date timestamptz default now(), method text, stripe_id text);
create table expenses (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, date date, vendor text, category text, amount numeric, status text, due_date date, qbo_id text);
create table employees (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, user_id uuid references auth.users, name text, email text, role text, app_role text, type text, rate numeric, hours_this_period numeric default 0, pto_balance numeric default 0, direct_deposit text, start_date date, certifications text[], w4_on_file boolean, i9_on_file boolean);
create table finance_snapshots (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, source text, pnl jsonb, aging jsonb, bills jsonb, created_at timestamptz default now());

-- ── Management Hub ───────────────────────────────────────────────────────
create table devices (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, site_id uuid references sites on delete set null, hostname text, type text, os text, ip text, mac text, vendor text, status text, cpu int, ram int, disk int, last_seen timestamptz, pending_patches int default 0, huntress_agent boolean default false, rmm_agent boolean default false, rmm_id text, backup_status text, warranty_end date, assigned_user text, toner int);
create table patches (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, kb text, title text, product text, severity text, release_date date, last_issue_reported date, open_issues int default 0, deployed_at timestamptz, deployed_count int default 0, blocked boolean default false);
create table tickets (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, number serial, client_id uuid references clients on delete cascade, title text, description text, priority text, status text default 'new', category text, assignee text, created_at timestamptz default now(), sla_due_at timestamptz, billable boolean default false, hours numeric default 0, invoiced boolean default false);
create table projects (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, name text, status text, progress int default 0, start date, "end" date, budget numeric, billable_hours numeric default 0, milestones jsonb default '[]');
create table inventory (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, sku text, name text, category text, qty int default 0, reorder_at int default 0, cost numeric, price numeric, location text, warranty_months int, assigned_client_id uuid references clients on delete set null, serial text, received_at date);
create table purchase_orders (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, number text, vendor text, client_id uuid references clients on delete set null, items jsonb, status text, eta date, tracking text, created_at timestamptz default now());
create table scans (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, site_id uuid references sites on delete cascade, client_id uuid references clients on delete cascade, range text, started_at timestamptz, source text, hosts jsonb);
create table discovery_jobs (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, site_id uuid references sites on delete cascade, range text, status text default 'queued', created_at timestamptz default now());
create table credentials (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, system text, username text, last_rotated date, rotate_every_days int default 90, vault_ref text);
create table directory_users (id text primary key, org_id uuid references orgs on delete cascade, client_id uuid references clients on delete cascade, display_name text, upn text, license text, mfa boolean, groups text[], last_sign_in timestamptz, enabled boolean);
create table huntress_snapshots (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, organizations jsonb, agents jsonb, incidents jsonb, created_at timestamptz default now());

-- ── System ───────────────────────────────────────────────────────────────
create table audit (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, at timestamptz default now(), who text, action text);
create table notifications (id uuid primary key default gen_random_uuid(), org_id uuid references orgs on delete cascade, at timestamptz default now(), level text, text text, href text, read boolean default false);
create table integration_secrets (id text, org_id uuid references orgs on delete cascade, config text not null, updated_at timestamptz default now(), primary key (id));  -- AES-GCM encrypted JSON; server-only
create table oauth_tokens (id text primary key, org_id uuid references orgs on delete cascade, access_token text, refresh_token text, realm_id text, expires_at timestamptz); -- server-only

-- ── Row Level Security: members see only their org's rows ────────────────
do $$
declare t text;
begin
  foreach t in array array['company','clients','sites','outages','contracts','documents','proposals','price_catalog','leads','appointments','roadmap','invoices','payments','expenses','employees','finance_snapshots','devices','patches','tickets','projects','inventory','purchase_orders','scans','discovery_jobs','credentials','directory_users','huntress_snapshots','audit','notifications']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "org members" on %I for all using (org_id in (select my_orgs())) with check (org_id in (select my_orgs()))', t);
  end loop;
end $$;
alter table orgs enable row level security;
create policy "my orgs" on orgs for select using (id in (select my_orgs()));
alter table org_members enable row level security;
create policy "my memberships" on org_members for select using (user_id = auth.uid());
-- integration_secrets & oauth_tokens: RLS on with NO policies → only the service role (server) can read them.
alter table integration_secrets enable row level security;
alter table oauth_tokens enable row level security;

-- Helpful indexes
create index on clients (org_id, "group");
create index on contracts (org_id, end_date);
create index on invoices (org_id, status, due_date);
create index on devices (org_id, site_id);
create index on tickets (org_id, status);
