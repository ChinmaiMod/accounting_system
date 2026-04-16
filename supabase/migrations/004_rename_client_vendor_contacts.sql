-- Drop dependent views
drop view if exists v_business_profitability_daily;
drop view if exists v_timesheet_profitability;

-- Rename clients table to end_clients
alter table clients rename to end_clients;

-- Rename client_id to end_client_id in projects
alter table projects rename column client_id to end_client_id;
alter table projects rename column client_actual_bill_rate to end_client_actual_bill_rate;
alter table projects rename column client_informed_bill_rate to end_client_informed_bill_rate;

-- Make vendor_id nullable on projects (end client can act as vendor)
alter table projects alter column vendor_id drop not null;

-- Create vendor_contacts table
create table if not exists vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  contact_type text not null check (contact_type in ('INVOICING', 'ACCOUNTS_PAYABLE')),
  contact_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create index if not exists idx_vendor_contacts_vendor on vendor_contacts(vendor_id);
grant all on vendor_contacts to anon, authenticated;

-- Recreate profitability views with renamed columns
create or replace view v_timesheet_profitability as
select
  t.id as timesheet_id,
  t.business_id,
  t.employee_id,
  t.project_id,
  t.work_date,
  t.work_type,
  t.hours,
  t.travel_hours,
  e.employee_type,
  p.end_client_actual_bill_rate,
  p.employee_agreed_percent,
  p.employee_project_rate,
  p.end_client_actual_bill_rate * t.hours as revenue_amount,
  case
    when e.employee_type = 'W2' then
      (p.employee_project_rate * t.hours)
      + (e.travel_reimbursement_rate * t.travel_hours)
    else coalesce(pbr.third_party_cost_rate, 0) * t.hours
  end as direct_cost_amount,
  case
    when e.employee_type = 'W2' then
      (p.employee_project_rate * t.hours)
      * (e.employer_tax_percent / 100.0)
    else 0
  end as employer_tax_amount
from timesheets t
join employees e on e.id = t.employee_id
join projects p on p.id = t.project_id
left join lateral (
  select pbr_inner.third_party_cost_rate
  from project_bill_rates pbr_inner
  where pbr_inner.project_id = t.project_id
    and pbr_inner.work_type = t.work_type
    and pbr_inner.effective_from <= t.work_date
    and (pbr_inner.effective_to is null or pbr_inner.effective_to >= t.work_date)
  order by pbr_inner.effective_from desc
  limit 1
) pbr on true;

create or replace view v_business_profitability_daily as
select
  business_id,
  work_date,
  sum(revenue_amount) as revenue_amount,
  sum(direct_cost_amount) as direct_cost_amount,
  sum(employer_tax_amount) as employer_tax_amount,
  sum(revenue_amount - direct_cost_amount - employer_tax_amount) as gross_profit_amount
from v_timesheet_profitability
group by business_id, work_date;

grant select on v_timesheet_profitability to anon, authenticated;
grant select on v_business_profitability_daily to anon, authenticated;
