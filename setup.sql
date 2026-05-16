-- Execute este SQL no Supabase > SQL Editor

-- Tabela de transações
create table if not exists transactions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users not null,
  date        date not null,
  description text not null,
  amount      decimal(12,2) not null,
  category    text not null default 'Outros',
  month_year  text not null,
  created_at  timestamptz default now()
);

-- Tabela de regras de categoria (aprendizado)
create table if not exists category_rules (
  id                   uuid default gen_random_uuid() primary key,
  user_id              uuid references auth.users not null,
  description_pattern  text not null,
  category_name        text not null,
  created_at           timestamptz default now(),
  unique(user_id, description_pattern)
);

-- Tabela de metas
create table if not exists goals (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users not null,
  target_amount  decimal(12,2) not null,
  label          text not null default 'Independência Financeira',
  created_at     timestamptz default now(),
  unique(user_id)
);

-- Tabela de limites por categoria
create table if not exists budget_limits (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users not null,
  category_name  text not null,
  monthly_limit  decimal(12,2) not null,
  created_at     timestamptz default now(),
  unique(user_id, category_name)
);

-- Segurança: cada usuário só vê seus próprios dados
alter table transactions    enable row level security;
alter table category_rules  enable row level security;
alter table goals            enable row level security;
alter table budget_limits    enable row level security;

create policy "transactions_owner" on transactions
  for all using (auth.uid() = user_id);

create policy "category_rules_owner" on category_rules
  for all using (auth.uid() = user_id);

create policy "goals_owner" on goals
  for all using (auth.uid() = user_id);

create policy "budget_limits_owner" on budget_limits
  for all using (auth.uid() = user_id);

-- Índice para acelerar consultas por mês
create index if not exists idx_tx_user_month on transactions(user_id, month_year);
