-- Replace legacy employee_earnings table with employee_transactions (EMPLOYEE_EARNINGS)

-- Temporarily allow both earning kind values during migration.
alter table employee_transactions
  drop constraint if exists employee_transactions_entry_kind_check;

alter table employee_transactions
  add constraint employee_transactions_entry_kind_check check (entry_kind in (
    'EARNING_FROM_TIMESHEET',
    'EMPLOYEE_EARNINGS',
    'EXPENSE_DEDUCTION',
    'EXPENSE_REIMBURSEMENT',
    'MANUAL_CREDIT',
    'MANUAL_DEBIT',
    'PAYMENT_TO_EMPLOYEE'
  ));

-- Backfill missing system earnings transactions from employee_earnings.
insert into employee_transactions (
  business_id,
  employee_id,
  project_id,
  txn_date,
  period_month,
  entry_kind,
  amount,
  description,
  notes,
  is_system_generated,
  source_earning_id,
  source_expense_id
)
select
  e.business_id,
  e.employee_id,
  e.project_id,
  (date_trunc('month', e.earning_month)::date + interval '1 month - 1 day')::date as txn_date,
  date_trunc('month', e.earning_month)::date as period_month,
  'EMPLOYEE_EARNINGS' as entry_kind,
  e.total_earnings as amount,
  'Timesheet earnings ('
    || trim(to_char(e.total_hours, 'FM9999999990.00'))
    || ' hrs @ $'
    || trim(to_char(e.hourly_rate, 'FM9999999990.00'))
    || '/hr)' as description,
  null as notes,
  true as is_system_generated,
  e.id as source_earning_id,
  null as source_expense_id
from employee_earnings e
left join employee_transactions t
  on t.business_id = e.business_id
 and t.employee_id = e.employee_id
 and t.project_id = e.project_id
 and t.period_month = date_trunc('month', e.earning_month)::date
 and t.entry_kind in ('EARNING_FROM_TIMESHEET', 'EMPLOYEE_EARNINGS')
 and t.is_system_generated = true
where t.id is null
  and coalesce(e.total_earnings, 0) <> 0;

-- Normalize earning kind to EMPLOYEE_EARNINGS.
update employee_transactions
set entry_kind = 'EMPLOYEE_EARNINGS'
where entry_kind = 'EARNING_FROM_TIMESHEET';

-- Keep only one system-generated earnings row per employee/project/month.
with ranked as (
  select
    id,
    row_number() over (
      partition by business_id, employee_id, project_id, period_month, entry_kind, is_system_generated
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from employee_transactions
  where entry_kind = 'EMPLOYEE_EARNINGS'
    and is_system_generated = true
)
delete from employee_transactions t
using ranked r
where t.id = r.id
  and r.rn > 1;

-- Remove legacy source_earning references.
drop index if exists employee_transactions_uq_earning;
alter table employee_transactions
  drop constraint if exists employee_transactions_source_one_chk;
alter table employee_transactions
  drop column if exists source_earning_id;

-- Ensure expense source links are only used for expense entries.
alter table employee_transactions
  add constraint employee_transactions_source_one_chk check (
    source_expense_id is null
    or entry_kind in ('EXPENSE_DEDUCTION', 'EXPENSE_REIMBURSEMENT')
  );

-- Finalize allowed transaction kinds (legacy value removed).
alter table employee_transactions
  drop constraint if exists employee_transactions_entry_kind_check;

alter table employee_transactions
  add constraint employee_transactions_entry_kind_check check (entry_kind in (
    'EMPLOYEE_EARNINGS',
    'EXPENSE_DEDUCTION',
    'EXPENSE_REIMBURSEMENT',
    'MANUAL_CREDIT',
    'MANUAL_DEBIT',
    'PAYMENT_TO_EMPLOYEE'
  ));

create unique index if not exists employee_transactions_uq_emp_earnings_month
  on employee_transactions (business_id, employee_id, project_id, period_month)
  where is_system_generated = true
    and entry_kind = 'EMPLOYEE_EARNINGS'
    and project_id is not null;

-- Remove legacy timesheet->employee_earnings linkage.
drop index if exists idx_timesheets_earning;
alter table timesheets
  drop column if exists earning_id;

-- employee_earnings is now fully replaced by employee_transactions.
drop table if exists employee_earnings;

-- Migrate lookup defaults for transaction kind labels.
update lookup_values lv
set code = 'EMPLOYEE_EARNINGS',
    label = 'Employee earnings'
where lv.category = 'employee_transaction_kind'
  and lv.code = 'EARNING_FROM_TIMESHEET'
  and not exists (
    select 1
    from lookup_values x
    where x.business_id = lv.business_id
      and x.category = lv.category
      and x.code = 'EMPLOYEE_EARNINGS'
  );

update lookup_values
set is_active = false
where category = 'employee_transaction_kind'
  and code = 'EARNING_FROM_TIMESHEET';
