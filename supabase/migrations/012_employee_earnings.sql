-- Employee earnings: auto-calculated from timesheets (hours * project rate)
create table if not exists employee_earnings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  earning_month date not null,
  total_hours numeric(10,2) not null default 0,
  hourly_rate numeric(12,2) not null default 0,
  total_earnings numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_earnings_unique unique (business_id, employee_id, project_id, earning_month)
);

create index if not exists idx_employee_earnings_biz_month
  on employee_earnings(business_id, earning_month);

create index if not exists idx_employee_earnings_emp
  on employee_earnings(employee_id, earning_month);

-- Link each timesheet record to its earning for referential integrity
alter table timesheets
  add column if not exists earning_id uuid references employee_earnings(id) on delete set null;

create index if not exists idx_timesheets_earning
  on timesheets(earning_id);

grant all on employee_earnings to anon, authenticated;
