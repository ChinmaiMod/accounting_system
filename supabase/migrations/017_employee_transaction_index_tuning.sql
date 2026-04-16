-- Add targeted indexes for high-traffic foreign keys in transaction flows.

create index if not exists idx_employee_transactions_project_id
  on employee_transactions(project_id);

create index if not exists idx_employee_transactions_to_account_id
  on employee_transactions(to_account_id);

create index if not exists idx_employee_transactions_transaction_screenshot_id
  on employee_transactions(transaction_screenshot_id);

create index if not exists idx_employee_transactions_confirmation_screenshot_id
  on employee_transactions(confirmation_screenshot_id);

create index if not exists idx_employee_transaction_file_links_file_id
  on employee_transaction_file_links(file_id);
