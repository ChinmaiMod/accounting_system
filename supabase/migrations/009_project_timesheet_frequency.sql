alter table projects add column timesheet_frequency text not null default 'WEEKLY'
  check (timesheet_frequency in ('WEEKLY', 'BI_WEEKLY', 'MONTHLY'));
