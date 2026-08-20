-- Rode no SQL Editor do Supabase (uma vez).
-- Depois preencha .env.local com a URL e a service role key.

create table if not exists public.app_store (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS: o app usa service role no servidor; bloqueia acesso público direto.
alter table public.app_store enable row level security;

-- (opcional) seed inicial vazio — o app grava sozinho no primeiro save
-- insert into public.app_store (id, data) values ('main', '{}'::jsonb);
