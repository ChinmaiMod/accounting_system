-- Remove legacy employee_expenses table and store calculation effects on employee_transactions.

-- Backfill expense transactions from applied expenses if not already synced.
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
  source_expense_id
)
select
  e.business_id,
  e.employee_id,
  null as project_id,
  e.expense_date as txn_date,
  date_trunc('month', e.expense_date)::date as period_month,
  case
    when e.deduction_mode = 'REIMBURSEMENT' then 'EXPENSE_REIMBURSEMENT'
    when e.borne_by = 'EMPLOYEE' then 'EXPENSE_DEDUCTION'
    else null
  end as entry_kind,
  e.amount as amount,
  coalesce(nullif(trim(e.expense_type), ''), 'Employee expense') || ' (' || e.expense_date::text || ')' as description,
  e.notes,
  true as is_system_generated,
  e.id as source_expense_id
from employee_expenses e
left join employee_transactions t on t.source_expense_id = e.id
where e.status = 'APPLIED'
  and (e.deduction_mode = 'REIMBURSEMENT' or e.borne_by = 'EMPLOYEE')
  and t.id is null;

-- Drop legacy source-expense linkage now that expenses are first-class transactions.
drop index if exists employee_transactions_uq_expense;
alter table employee_transactions
  drop constraint if exists employee_transactions_source_one_chk;
alter table employee_transactions
  drop column if exists source_expense_id;

-- Add explicit transaction effects used for employee balance and employer profitability calculations.
alter table employee_transactions
  add column if not exists employee_balance_effect text,
  add column if not exists employer_profitability_effect text;

update employee_transactions
set
  amount = abs(amount),
  employee_balance_effect = case entry_kind
    when 'EMPLOYEE_EARNINGS' then 'ADD'
    when 'EXPENSE_DEDUCTION' then 'SUBTRACT'
    when 'EXPENSE_REIMBURSEMENT' then 'ADD'
    when 'MANUAL_CREDIT' then 'ADD'
    when 'MANUAL_DEBIT' then 'SUBTRACT'
    when 'PAYMENT_TO_EMPLOYEE' then 'SUBTRACT'
    else 'ADD'
  end,
  employer_profitability_effect = case entry_kind
    when 'EMPLOYEE_EARNINGS' then 'SUBTRACT'
    when 'EXPENSE_DEDUCTION' then 'ADD'
    when 'EXPENSE_REIMBURSEMENT' then 'SUBTRACT'
    when 'MANUAL_CREDIT' then 'SUBTRACT'
    when 'MANUAL_DEBIT' then 'ADD'
    when 'PAYMENT_TO_EMPLOYEE' then 'ADD'
    else 'SUBTRACT'
  end;

alter table employee_transactions
  alter column employee_balance_effect set not null,
  alter column employer_profitability_effect set not null;

alter table employee_transactions
  drop constraint if exists employee_transactions_employee_effect_chk;
alter table employee_transactions
  add constraint employee_transactions_employee_effect_chk
  check (employee_balance_effect in ('ADD', 'SUBTRACT'));

alter table employee_transactions
  drop constraint if exists employee_transactions_employer_effect_chk;
alter table employee_transactions
  add constraint employee_transactions_employer_effect_chk
  check (employer_profitability_effect in ('ADD', 'SUBTRACT'));

alter table employee_transactions
  drop constraint if exists employee_transactions_effect_by_kind_chk;
alter table employee_transactions
  add constraint employee_transactions_effect_by_kind_chk check (
    (entry_kind = 'EMPLOYEE_EARNINGS' and employee_balance_effect = 'ADD' and employer_profitability_effect = 'SUBTRACT')
    or (entry_kind = 'EXPENSE_DEDUCTION' and employee_balance_effect = 'SUBTRACT' and employer_profitability_effect = 'ADD')
    or (entry_kind = 'EXPENSE_REIMBURSEMENT' and employee_balance_effect = 'ADD' and employer_profitability_effect = 'SUBTRACT')
    or (entry_kind = 'MANUAL_CREDIT' and employee_balance_effect = 'ADD' and employer_profitability_effect = 'SUBTRACT')
    or (entry_kind = 'MANUAL_DEBIT' and employee_balance_effect = 'SUBTRACT' and employer_profitability_effect = 'ADD')
    or (entry_kind = 'PAYMENT_TO_EMPLOYEE' and employee_balance_effect = 'SUBTRACT' and employer_profitability_effect = 'ADD')
  );

alter table employee_transactions
  drop constraint if exists employee_transactions_amount_nonnegative_chk;
alter table employee_transactions
  add constraint employee_transactions_amount_nonnegative_chk check (amount >= 0);

-- Expense lookup categories are no longer used after moving all expense activity to employee_transactions.
update lookup_values
set is_active = false
where category in ('expense_deduction_mode', 'expense_borne_by', 'expense_status');

-- Remove legacy employee_expenses table.
drop index if exists idx_expenses_employee;
drop table if exists employee_expenses;
