create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  default_business_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  legal_name text,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_default_business_fk
  foreign key (default_business_id) references businesses(id) on delete set null;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  full_name text not null,
  employee_type text not null check (employee_type in ('W2', 'C2C')),
  regular_pay_rate numeric(12,2) not null default 0,
  overtime_pay_rate numeric(12,2) not null default 0,
  holiday_pay_rate numeric(12,2) not null default 0,
  holiday_ot_pay_rate numeric(12,2) not null default 0,
  travel_reimbursement_rate numeric(12,2) not null default 0,
  employer_tax_percent numeric(5,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists end_clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  invoice_frequency text not null check (invoice_frequency in ('WEEKLY', 'BI_WEEKLY', 'MONTHLY')),
  payment_terms text not null check (payment_terms in ('NET_7', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90')),
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  end_client_id uuid not null references end_clients(id) on delete restrict,
  vendor_id uuid references vendors(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists project_bill_rates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  work_type text not null check (work_type in ('REGULAR', 'OVERTIME', 'HOLIDAY', 'HOLIDAY_OT')),
  bill_rate numeric(12,2) not null,
  third_party_cost_rate numeric(12,2) not null default 0,
  effective_from date not null,
  effective_to date,
  unique (project_id, work_type, effective_from)
);

create table if not exists timesheets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  work_date date not null,
  work_type text not null check (work_type in ('REGULAR', 'OVERTIME', 'HOLIDAY', 'HOLIDAY_OT')),
  hours numeric(8,2) not null check (hours >= 0),
  travel_hours numeric(8,2) not null default 0 check (travel_hours >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists employee_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  expense_date date not null,
  expense_type text not null,
  amount numeric(12,2) not null check (amount >= 0),
  deduction_mode text not null check (deduction_mode in ('PAYROLL_DEDUCTION', 'WAGE_DEDUCTION', 'REIMBURSEMENT')),
  status text not null check (status in ('PENDING', 'APPLIED', 'WAIVED')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete restrict,
  invoice_number text not null,
  invoice_date date not null,
  period_start date not null,
  period_end date not null,
  payment_terms text not null check (payment_terms in ('NET_7', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90')),
  due_date date not null,
  total_amount numeric(14,2) not null default 0,
  status text not null check (status in ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')),
  created_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);

create table if not exists invoice_projects (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  employee_id uuid references employees(id) on delete set null,
  hours numeric(10,2) not null default 0,
  bill_rate numeric(12,2) not null default 0,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text,
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_businesses_owner on businesses(owner_user_id);
create index if not exists idx_employees_business on employees(business_id);
create index if not exists idx_timesheets_business_date on timesheets(business_id, work_date);
create index if not exists idx_expenses_employee on employee_expenses(employee_id, expense_date);
create index if not exists idx_invoices_business_status on invoices(business_id, status);
