-- Move employee_balance_effect / employer_profitability_effect off of employee_transactions
-- onto lookup_values (category='employee_transaction_kind'), since the effect is determined
-- by the transaction kind, not per-row.

alter table lookup_values
  add column if not exists employee_balance_effect text,
  add column if not exists employer_profitability_effect text;

alter table lookup_values
  drop constraint if exists lookup_values_employee_balance_effect_chk;
alter table lookup_values
  add constraint lookup_values_employee_balance_effect_chk
  check (employee_balance_effect is null or employee_balance_effect in ('ADD', 'SUBTRACT'));

alter table lookup_values
  drop constraint if exists lookup_values_employer_profitability_effect_chk;
alter table lookup_values
  add constraint lookup_values_employer_profitability_effect_chk
  check (employer_profitability_effect is null or employer_profitability_effect in ('ADD', 'SUBTRACT'));

-- Backfill effects for every existing employee_transaction_kind row.
update lookup_values
set
  employee_balance_effect = case code
    when 'EMPLOYEE_EARNINGS' then 'ADD'
    when 'EXPENSE_DEDUCTION' then 'SUBTRACT'
    when 'EXPENSE_REIMBURSEMENT' then 'ADD'
    when 'MANUAL_CREDIT' then 'ADD'
    when 'MANUAL_DEBIT' then 'SUBTRACT'
    when 'PAYMENT_TO_EMPLOYEE' then 'SUBTRACT'
    when 'EMPLOYEE_PAYROLL_DIRECT_DEPOSIT' then 'SUBTRACT'
    when 'EMPLOYEE_PAYROLL_CHECK' then 'SUBTRACT'
    when 'PAYROLL_AMENDMENT_FEES' then 'SUBTRACT'
    when 'EMPLOYER_TAX_FULL_PAYROLL' then 'SUBTRACT'
    when 'EMPLOYER_TAX_LCA_DEFICIENCY' then 'SUBTRACT'
    when 'CANDIDATE_PAYMENT_INDIA' then 'SUBTRACT'
    when 'CANDIDATE_REPAYMENT_INDIA' then 'ADD'
    when 'HEALTH_INSURANCE_DEDUCTION' then 'SUBTRACT'
    when 'H1B_AMENDMENT_FILING_FEES' then 'SUBTRACT'
    when 'H1B_AMENDMENT_ATTORNEY_FEES' then 'SUBTRACT'
    when 'H1B_AMENDMENT_EXTENSION_FILING_FEES' then 'SUBTRACT'
    when 'H1B_AMENDMENT_EXTENSION_ATTORNEY_FEES' then 'SUBTRACT'
    when 'H4_FILING_FEES' then 'SUBTRACT'
    when 'H4_ATTORNEY_FEES' then 'SUBTRACT'
    when 'H4_EAD_FILING_FEES' then 'SUBTRACT'
    when 'H4_EAD_ATTORNEY_FEES' then 'SUBTRACT'
    else null
  end,
  employer_profitability_effect = case code
    when 'EMPLOYEE_EARNINGS' then 'SUBTRACT'
    when 'EXPENSE_DEDUCTION' then 'ADD'
    when 'EXPENSE_REIMBURSEMENT' then 'SUBTRACT'
    when 'MANUAL_CREDIT' then 'SUBTRACT'
    when 'MANUAL_DEBIT' then 'ADD'
    when 'PAYMENT_TO_EMPLOYEE' then 'ADD'
    when 'EMPLOYEE_PAYROLL_DIRECT_DEPOSIT' then 'SUBTRACT'
    when 'EMPLOYEE_PAYROLL_CHECK' then 'SUBTRACT'
    when 'PAYROLL_AMENDMENT_FEES' then 'SUBTRACT'
    when 'EMPLOYER_TAX_FULL_PAYROLL' then 'SUBTRACT'
    when 'EMPLOYER_TAX_LCA_DEFICIENCY' then 'SUBTRACT'
    when 'CANDIDATE_PAYMENT_INDIA' then 'SUBTRACT'
    when 'CANDIDATE_REPAYMENT_INDIA' then 'ADD'
    when 'HEALTH_INSURANCE_DEDUCTION' then 'ADD'
    when 'H1B_AMENDMENT_FILING_FEES' then 'SUBTRACT'
    when 'H1B_AMENDMENT_ATTORNEY_FEES' then 'SUBTRACT'
    when 'H1B_AMENDMENT_EXTENSION_FILING_FEES' then 'SUBTRACT'
    when 'H1B_AMENDMENT_EXTENSION_ATTORNEY_FEES' then 'SUBTRACT'
    when 'H4_FILING_FEES' then 'SUBTRACT'
    when 'H4_ATTORNEY_FEES' then 'SUBTRACT'
    when 'H4_EAD_FILING_FEES' then 'SUBTRACT'
    when 'H4_EAD_ATTORNEY_FEES' then 'SUBTRACT'
    else null
  end
where category = 'employee_transaction_kind';

-- Seed the full set of 22 transaction kinds (with effects) into lookup_values for every
-- existing business. Idempotent: existing (business_id, category, code) rows are skipped,
-- so user-edited labels / sort_order on already-seeded rows are preserved.
with kinds(code, label, sort_order, employee_balance_effect, employer_profitability_effect) as (
  values
    ('EMPLOYEE_EARNINGS', 'Employee earnings', 10, 'ADD', 'SUBTRACT'),
    ('EXPENSE_DEDUCTION', 'Expense deduction', 20, 'SUBTRACT', 'ADD'),
    ('EXPENSE_REIMBURSEMENT', 'Expense reimbursement', 30, 'ADD', 'SUBTRACT'),
    ('MANUAL_CREDIT', 'Manual credit', 40, 'ADD', 'SUBTRACT'),
    ('MANUAL_DEBIT', 'Manual debit', 50, 'SUBTRACT', 'ADD'),
    ('PAYMENT_TO_EMPLOYEE', 'Payment to employee', 60, 'SUBTRACT', 'ADD'),
    ('EMPLOYEE_PAYROLL_DIRECT_DEPOSIT', 'Employee Payroll with Direct Deposit', 70, 'SUBTRACT', 'SUBTRACT'),
    ('EMPLOYEE_PAYROLL_CHECK', 'Employee Payroll with Check', 80, 'SUBTRACT', 'SUBTRACT'),
    ('PAYROLL_AMENDMENT_FEES', 'Payroll Amendment Fees', 90, 'SUBTRACT', 'SUBTRACT'),
    ('EMPLOYER_TAX_FULL_PAYROLL', 'Employer Taxes for full payroll', 100, 'SUBTRACT', 'SUBTRACT'),
    ('EMPLOYER_TAX_LCA_DEFICIENCY', 'Employer Taxes for LCA deficiency', 110, 'SUBTRACT', 'SUBTRACT'),
    ('CANDIDATE_PAYMENT_INDIA', 'Payment to Candidate in India', 120, 'SUBTRACT', 'SUBTRACT'),
    ('CANDIDATE_REPAYMENT_INDIA', 'Payment made by candidate in India', 130, 'ADD', 'ADD'),
    ('HEALTH_INSURANCE_DEDUCTION', 'Health Insurance Deduction', 140, 'SUBTRACT', 'ADD'),
    ('H1B_AMENDMENT_FILING_FEES', 'H1B Amendment Filing Fees', 150, 'SUBTRACT', 'SUBTRACT'),
    ('H1B_AMENDMENT_ATTORNEY_FEES', 'H1B Amendment Attorney Fees', 160, 'SUBTRACT', 'SUBTRACT'),
    ('H1B_AMENDMENT_EXTENSION_FILING_FEES', 'H1B Amendment + Extension Filing Fees', 170, 'SUBTRACT', 'SUBTRACT'),
    ('H1B_AMENDMENT_EXTENSION_ATTORNEY_FEES', 'H1B Amendment + Extension Attorney Fees', 180, 'SUBTRACT', 'SUBTRACT'),
    ('H4_FILING_FEES', 'H4 Filing Fees', 190, 'SUBTRACT', 'SUBTRACT'),
    ('H4_ATTORNEY_FEES', 'H4 Attorney Fees', 200, 'SUBTRACT', 'SUBTRACT'),
    ('H4_EAD_FILING_FEES', 'H4 EAD Filing Fees', 210, 'SUBTRACT', 'SUBTRACT'),
    ('H4_EAD_ATTORNEY_FEES', 'H4 EAD Attorney Fees', 220, 'SUBTRACT', 'SUBTRACT')
)
insert into lookup_values (
  business_id, category, code, label, sort_order, is_active,
  employee_balance_effect, employer_profitability_effect
)
select b.id, 'employee_transaction_kind', k.code, k.label, k.sort_order, true,
       k.employee_balance_effect, k.employer_profitability_effect
from businesses b cross join kinds k
on conflict (business_id, category, code) do nothing;

-- For any pre-existing 'employee_transaction_kind' rows where the effect columns are still
-- NULL (e.g. seeded before this migration without effect values), apply the canonical mapping.
update lookup_values lv
set
  employee_balance_effect = coalesce(lv.employee_balance_effect, k.employee_balance_effect),
  employer_profitability_effect = coalesce(lv.employer_profitability_effect, k.employer_profitability_effect)
from (values
  ('EMPLOYEE_EARNINGS', 'ADD', 'SUBTRACT'),
  ('EXPENSE_DEDUCTION', 'SUBTRACT', 'ADD'),
  ('EXPENSE_REIMBURSEMENT', 'ADD', 'SUBTRACT'),
  ('MANUAL_CREDIT', 'ADD', 'SUBTRACT'),
  ('MANUAL_DEBIT', 'SUBTRACT', 'ADD'),
  ('PAYMENT_TO_EMPLOYEE', 'SUBTRACT', 'ADD'),
  ('EMPLOYEE_PAYROLL_DIRECT_DEPOSIT', 'SUBTRACT', 'SUBTRACT'),
  ('EMPLOYEE_PAYROLL_CHECK', 'SUBTRACT', 'SUBTRACT'),
  ('PAYROLL_AMENDMENT_FEES', 'SUBTRACT', 'SUBTRACT'),
  ('EMPLOYER_TAX_FULL_PAYROLL', 'SUBTRACT', 'SUBTRACT'),
  ('EMPLOYER_TAX_LCA_DEFICIENCY', 'SUBTRACT', 'SUBTRACT'),
  ('CANDIDATE_PAYMENT_INDIA', 'SUBTRACT', 'SUBTRACT'),
  ('CANDIDATE_REPAYMENT_INDIA', 'ADD', 'ADD'),
  ('HEALTH_INSURANCE_DEDUCTION', 'SUBTRACT', 'ADD'),
  ('H1B_AMENDMENT_FILING_FEES', 'SUBTRACT', 'SUBTRACT'),
  ('H1B_AMENDMENT_ATTORNEY_FEES', 'SUBTRACT', 'SUBTRACT'),
  ('H1B_AMENDMENT_EXTENSION_FILING_FEES', 'SUBTRACT', 'SUBTRACT'),
  ('H1B_AMENDMENT_EXTENSION_ATTORNEY_FEES', 'SUBTRACT', 'SUBTRACT'),
  ('H4_FILING_FEES', 'SUBTRACT', 'SUBTRACT'),
  ('H4_ATTORNEY_FEES', 'SUBTRACT', 'SUBTRACT'),
  ('H4_EAD_FILING_FEES', 'SUBTRACT', 'SUBTRACT'),
  ('H4_EAD_ATTORNEY_FEES', 'SUBTRACT', 'SUBTRACT')
) as k(code, employee_balance_effect, employer_profitability_effect)
where lv.category = 'employee_transaction_kind'
  and lv.code = k.code
  and (lv.employee_balance_effect is null or lv.employer_profitability_effect is null);

-- Drop per-row effect columns from employee_transactions. Effects are now sourced from
-- lookup_values by entry_kind at read time.
alter table employee_transactions
  drop constraint if exists employee_transactions_employee_effect_chk;
alter table employee_transactions
  drop constraint if exists employee_transactions_employer_effect_chk;
alter table employee_transactions
  drop constraint if exists employee_transactions_effect_by_kind_chk;

alter table employee_transactions
  drop column if exists employee_balance_effect,
  drop column if exists employer_profitability_effect;
