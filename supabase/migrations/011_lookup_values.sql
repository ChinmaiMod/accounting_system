create table if not exists lookup_values (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  category text not null,
  code text not null,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint lookup_values_biz_cat_code_uq unique (business_id, category, code)
);

create index if not exists idx_lookup_values_biz_cat on lookup_values(business_id, category);

grant all on lookup_values to anon, authenticated;
