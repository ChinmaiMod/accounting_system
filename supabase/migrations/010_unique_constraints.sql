-- Businesses: unique name per owner
alter table businesses add constraint businesses_owner_name_uq unique (owner_user_id, name);

-- Employees: unique first+last name per business
alter table employees add constraint employees_business_name_uq unique (business_id, first_name, last_name);

-- End clients: unique name per business
alter table end_clients add constraint end_clients_business_name_uq unique (business_id, name);

-- Vendors: unique name per business
alter table vendors add constraint vendors_business_name_uq unique (business_id, name);

-- Projects: unique name per business
alter table projects add constraint projects_business_name_uq unique (business_id, name);

-- Timesheets: one entry per employee+project+date+work_type
alter table timesheets add constraint timesheets_emp_proj_date_type_uq unique (employee_id, project_id, work_date, work_type);

-- Invoice projects: one link per invoice+project
alter table invoice_projects add constraint invoice_projects_inv_proj_uq unique (invoice_id, project_id);

-- Vendor contacts: unique email per vendor (when email is not null)
create unique index vendor_contacts_vendor_email_uq on vendor_contacts (vendor_id, email) where email is not null;

-- Employee contacts: unique phone per employee+type
alter table employee_contacts add constraint employee_contacts_emp_type_phone_uq unique (employee_id, contact_type, phone);
