-- Add first_name and last_name columns
alter table employees add column first_name text;
alter table employees add column last_name text;

-- Migrate existing full_name data: first word -> first_name, rest -> last_name
update employees set
  first_name = split_part(full_name, ' ', 1),
  last_name = case
    when position(' ' in full_name) > 0
      then substring(full_name from position(' ' in full_name) + 1)
    else ''
  end;

-- Make them not null now that data is populated
alter table employees alter column first_name set not null;
alter table employees alter column last_name set not null;

-- Drop the old full_name column and recreate as generated
alter table employees drop column full_name;
alter table employees add column full_name text generated always as (first_name || ' ' || last_name) stored;
