create table if not exists public.akstudio_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.akstudio_user_data enable row level security;

drop policy if exists "Users can view own AkStudio data"
on public.akstudio_user_data;

create policy "Users can view own AkStudio data"
on public.akstudio_user_data
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own AkStudio data"
on public.akstudio_user_data;

create policy "Users can insert own AkStudio data"
on public.akstudio_user_data
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own AkStudio data"
on public.akstudio_user_data;

create policy "Users can update own AkStudio data"
on public.akstudio_user_data
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update
on public.akstudio_user_data
to authenticated;
