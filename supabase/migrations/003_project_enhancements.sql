-- Drop views that depend on regular_pay_rate before altering employees
drop view if exists v_business_profitability_daily;
drop view if exists v_timesheet_profitability;

-- Add employee assignment, project details, and billing to projects
alter table projects add column employee_id uuid references employees(id) on delete set null;
alter table projects add column start_date date;
alter table projects add column end_date date;
alter table projects add column work_mode text not null default 'REMOTE' check (work_mode in ('REMOTE', 'HYBRID', 'ONSITE'));
alter table projects add column work_location_address1 text;
alter table projects add column work_location_address2 text;
alter table projects add column work_location_city text;
alter table projects add column work_location_state text;
alter table projects add column work_location_zip text;
alter table projects add column end_client_actual_bill_rate numeric(12,2) not null default 0;
alter table projects add column end_client_informed_bill_rate numeric(12,2) not null default 0;
alter table projects add column employee_agreed_percent numeric(5,2) not null default 0;
alter table projects add column employee_project_rate numeric(12,2) not null default 0;
alter table projects add column tenure_discount_percent numeric(5,2) not null default 0;
alter table projects add column volume_discount_percent numeric(5,2) not null default 0;
alter table projects add column vms_discount_percent numeric(5,2) not null default 0;
alter table projects add column early_payment_discount_percent numeric(5,2) not null default 0;

-- Remove regular_pay_rate from employees
alter table employees drop column regular_pay_rate;
