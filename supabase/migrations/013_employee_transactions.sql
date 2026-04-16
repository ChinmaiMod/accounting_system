-- Phase 2: unified employee transaction ledger (multi-layer: earnings, expenses, adjustments, payments)
create table if not exists employee_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  txn_date date not null,
  period_month date not null,
  entry_kind text not null check (entry_kind in (
    'EARNING_FROM_TIMESHEET',
    'EXPENSE_DEDUCTION',
    'EXPENSE_REIMBURSEMENT',
    'MANUAL_CREDIT',
    'MANUAL_DEBIT',
    'PAYMENT_TO_EMPLOYEE'
  )),
  amount numeric(14,2) not null,
  description text not null default '',
  notes text,
  is_system_generated boolean not null default false,
  source_earning_id uuid references employee_earnings(id) on delete cascade,
  source_expense_id uuid references employee_expenses(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_transactions_source_one_chk check (
    (source_earning_id is null and source_expense_id is null)
    or (source_earning_id is not null and source_expense_id is null)
    or (source_earning_id is null and source_expense_id is not null)
  )
);

create unique index if not exists employee_transactions_uq_earning
  on employee_transactions (source_earning_id) where source_earning_id is not null;

create unique index if not exists employee_transactions_uq_expense
  on employee_transactions (source_expense_id) where source_expense_id is not null;

create index if not exists idx_employee_transactions_biz_period
  on employee_transactions (business_id, period_month);

create index if not exists idx_employee_transactions_employee
  on employee_transactions (employee_id, period_month);

grant all on employee_transactions to anon, authenticated;
