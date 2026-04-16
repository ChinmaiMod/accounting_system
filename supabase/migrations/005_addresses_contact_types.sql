-- Add address fields to vendors
alter table vendors add column address1 text;
alter table vendors add column address2 text;
alter table vendors add column city text;
alter table vendors add column state text;
alter table vendors add column zip text;

-- Add address fields to end_clients
alter table end_clients add column address1 text;
alter table end_clients add column address2 text;
alter table end_clients add column city text;
alter table end_clients add column state text;
alter table end_clients add column zip text;

-- Update vendor_contacts check constraint to include RECRUITER and CEO
alter table vendor_contacts drop constraint vendor_contacts_contact_type_check;
alter table vendor_contacts add constraint vendor_contacts_contact_type_check
  check (contact_type in ('INVOICING', 'ACCOUNTS_PAYABLE', 'RECRUITER', 'CEO'));
