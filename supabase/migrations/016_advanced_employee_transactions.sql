-- Advanced transaction management: recipient accounts, multi-leg routing, FX, and proof documents.

create table if not exists recipient_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  account_name text not null,
  account_type text not null check (account_type in ('EMPLOYER', 'EMPLOYEE', 'INTERMEDIARY', 'CANDIDATE', 'VENDOR', 'OTHER')),
  payment_identifier text,
  bank_name text,
  country text,
  currency text not null default 'USD' check (currency in ('USD', 'INR')),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recipient_accounts_business
  on recipient_accounts(business_id, account_name);

create index if not exists idx_recipient_accounts_employee
  on recipient_accounts(employee_id);

create table if not exists transaction_files (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  mime_type text,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_transaction_files_business
  on transaction_files(business_id, uploaded_at desc);

alter table employee_transactions
  add column if not exists transaction_name text not null default 'Employee transaction',
  add column if not exists from_account_id uuid references recipient_accounts(id) on delete set null,
  add column if not exists to_account_id uuid references recipient_accounts(id) on delete set null,
  add column if not exists payment_method text,
  add column if not exists amount_currency text not null default 'USD' check (amount_currency in ('USD', 'INR')),
  add column if not exists amount_inr numeric(14,2),
  add column if not exists exchange_rate numeric(14,6),
  add column if not exists amount_usd numeric(14,2),
  add column if not exists transaction_screenshot_id uuid references transaction_files(id) on delete set null,
  add column if not exists confirmation_screenshot_id uuid references transaction_files(id) on delete set null,
  add column if not exists settlement_group_id uuid,
  add column if not exists parent_transaction_id uuid references employee_transactions(id) on delete set null,
  add column if not exists layer_order int not null default 1,
  add column if not exists expected_commission_percent numeric(7,4),
  add column if not exists actual_commission_percent numeric(7,4),
  add column if not exists expected_commission_amount_usd numeric(14,2),
  add column if not exists actual_commission_amount_usd numeric(14,2);

update employee_transactions
set amount_usd = abs(amount)
where amount_usd is null;

alter table employee_transactions
  alter column amount_usd set not null;

update employee_transactions
set amount = amount_usd
where amount is distinct from amount_usd;

alter table employee_transactions
  drop constraint if exists employee_transactions_amount_equals_usd_chk;
alter table employee_transactions
  add constraint employee_transactions_amount_equals_usd_chk
  check (amount = amount_usd);

alter table employee_transactions
  drop constraint if exists employee_transactions_inr_exchange_chk;
alter table employee_transactions
  add constraint employee_transactions_inr_exchange_chk check (
    (amount_currency = 'USD' and amount_usd >= 0)
    or (amount_currency = 'INR' and amount_inr is not null and exchange_rate is not null and exchange_rate > 0 and amount_usd >= 0)
  );

alter table employee_transactions
  drop constraint if exists employee_transactions_effect_by_kind_chk;

alter table employee_transactions
  drop constraint if exists employee_transactions_entry_kind_check;
alter table employee_transactions
  add constraint employee_transactions_entry_kind_check check (entry_kind in (
    'EMPLOYEE_EARNINGS',
    'EXPENSE_DEDUCTION',
    'EXPENSE_REIMBURSEMENT',
    'MANUAL_CREDIT',
    'MANUAL_DEBIT',
    'PAYMENT_TO_EMPLOYEE',
    'EMPLOYEE_PAYROLL_DIRECT_DEPOSIT',
    'EMPLOYEE_PAYROLL_CHECK',
    'PAYROLL_AMENDMENT_FEES',
    'EMPLOYER_TAX_FULL_PAYROLL',
    'EMPLOYER_TAX_LCA_DEFICIENCY',
    'CANDIDATE_PAYMENT_INDIA',
    'CANDIDATE_REPAYMENT_INDIA',
    'HEALTH_INSURANCE_DEDUCTION',
    'H1B_AMENDMENT_FILING_FEES',
    'H1B_AMENDMENT_ATTORNEY_FEES',
    'H1B_AMENDMENT_EXTENSION_FILING_FEES',
    'H1B_AMENDMENT_EXTENSION_ATTORNEY_FEES',
    'H4_FILING_FEES',
    'H4_ATTORNEY_FEES',
    'H4_EAD_FILING_FEES',
    'H4_EAD_ATTORNEY_FEES'
  ));

create index if not exists idx_employee_transactions_settlement
  on employee_transactions(business_id, settlement_group_id, layer_order);

create index if not exists idx_employee_transactions_accounts
  on employee_transactions(from_account_id, to_account_id);

create index if not exists idx_employee_transactions_parent
  on employee_transactions(parent_transaction_id);

create table if not exists employee_transaction_file_links (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references employee_transactions(id) on delete cascade,
  file_id uuid not null references transaction_files(id) on delete cascade,
  file_role text not null default 'SUPPORTING_DOCUMENT' check (file_role in ('TRANSACTION_SCREENSHOT', 'CONFIRMATION_SCREENSHOT', 'SUPPORTING_DOCUMENT')),
  created_at timestamptz not null default now(),
  constraint employee_transaction_file_links_unique unique (transaction_id, file_id)
);

create index if not exists idx_employee_transaction_file_links_txn
  on employee_transaction_file_links(transaction_id);

insert into employee_transaction_file_links (transaction_id, file_id, file_role)
select id, transaction_screenshot_id, 'TRANSACTION_SCREENSHOT'
from employee_transactions
where transaction_screenshot_id is not null
on conflict do nothing;

insert into employee_transaction_file_links (transaction_id, file_id, file_role)
select id, confirmation_screenshot_id, 'CONFIRMATION_SCREENSHOT'
from employee_transactions
where confirmation_screenshot_id is not null
on conflict do nothing;

grant all on recipient_accounts to anon, authenticated;
grant all on transaction_files to anon, authenticated;
grant all on employee_transaction_file_links to anon, authenticated;
