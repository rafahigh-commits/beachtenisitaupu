
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token text not null unique,
  platform text default 'web',
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index device_tokens_user_id_idx on public.device_tokens(user_id);
alter table public.device_tokens enable row level security;

create policy "Usuário gerencia próprios tokens" on public.device_tokens
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins veem todos tokens" on public.device_tokens
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index notifications_user_id_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;

create policy "Usuário vê próprias notificações" on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Usuário marca como lida" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins criam notificações" on public.notifications
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') or created_by = auth.uid());
create policy "Admins gerenciam notificações" on public.notifications
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

alter publication supabase_realtime add table public.notifications;
