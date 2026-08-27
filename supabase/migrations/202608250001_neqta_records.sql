create table if not exists public.neqta_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  namespace text not null,
  record_key text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, namespace, record_key)
);

create index if not exists neqta_records_store_namespace_idx on public.neqta_records (store_id, namespace);
alter table public.neqta_records enable row level security;

create or replace function public.neqta_can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.stores s
    join public.organization_members om on om.organization_id = s.organization_id
    where s.id = target_store_id
      and om.user_id = auth.uid()
      and om.active = true
      and s.active = true
  );
$fn$;

revoke all on function public.neqta_can_access_store(uuid) from public;
grant execute on function public.neqta_can_access_store(uuid) to authenticated;

drop policy if exists "neqta_records_select_store_members" on public.neqta_records;
create policy "neqta_records_select_store_members" on public.neqta_records for select
using (public.neqta_can_access_store(store_id));
drop policy if exists "neqta_records_insert_store_members" on public.neqta_records;
create policy "neqta_records_insert_store_members" on public.neqta_records for insert
with check (public.neqta_can_access_store(store_id));
drop policy if exists "neqta_records_update_store_members" on public.neqta_records;
create policy "neqta_records_update_store_members" on public.neqta_records for update
using (public.neqta_can_access_store(store_id))
with check (public.neqta_can_access_store(store_id));
drop policy if exists "neqta_records_delete_store_members" on public.neqta_records;
create policy "neqta_records_delete_store_members" on public.neqta_records for delete
using (public.neqta_can_access_store(store_id));

grant select, insert, update, delete on table public.neqta_records to authenticated;
