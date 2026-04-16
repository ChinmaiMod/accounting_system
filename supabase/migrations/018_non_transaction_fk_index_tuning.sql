-- Add covering indexes for remaining non-transaction foreign keys flagged by Supabase advisors.

create index if not exists idx_invoice_projects_employee_id
  on invoice_projects(employee_id);

create index if not exists idx_invoice_projects_project_id
  on invoice_projects(project_id);

create index if not exists idx_invoices_vendor_id
  on invoices(vendor_id);

create index if not exists idx_payments_business_id
  on payments(business_id);

create index if not exists idx_payments_invoice_id
  on payments(invoice_id);

create index if not exists idx_profiles_default_business_id
  on profiles(default_business_id);

create index if not exists idx_projects_client_id
  on projects(end_client_id);

create index if not exists idx_projects_employee_id
  on projects(employee_id);

create index if not exists idx_projects_vendor_id
  on projects(vendor_id);

create index if not exists idx_timesheets_project_id
  on timesheets(project_id);
