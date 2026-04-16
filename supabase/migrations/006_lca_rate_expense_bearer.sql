-- Add optional LCA hourly rate to projects
alter table projects add column lca_hourly_rate numeric(12,2);

-- Add expense bearer to employee_expenses: COMPANY or EMPLOYEE
alter table employee_expenses add column borne_by text not null default 'COMPANY' check (borne_by in ('COMPANY', 'EMPLOYEE'));
