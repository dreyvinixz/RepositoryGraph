-- RepositoryGraph v0.1.0: per-user workspace state.
create table if not exists public.repository_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint state_must_be_object check (jsonb_typeof(state) = 'object')
);

alter table public.repository_workspaces enable row level security;

create policy "Owners read their workspace"
  on public.repository_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners insert their workspace"
  on public.repository_workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners update their workspace"
  on public.repository_workspaces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners delete their workspace"
  on public.repository_workspaces for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.repository_workspaces to authenticated;
revoke all on public.repository_workspaces from anon;
