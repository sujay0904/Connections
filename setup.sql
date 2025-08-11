-- Players
table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Scores
create table if not exists public.scores (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  date date not null,
  score int not null check (score between 0 and 100),
  mode text not null check (mode in ('daily','random')),
  strikes int not null default 0 check (strikes between 0 and 4),
  duration_ms int not null default 0,
  created_at timestamptz default now()
);

-- Convenience view with names
create or replace view public.scores_with_names as
select s.*, p.name from public.scores s join public.players p on p.id = s.player_id;

-- RLS
alter table public.players enable row level security;
alter table public.scores enable row level security;

-- Anyone can read leaderboards; inserts are allowed; updates/deletes blocked.
create policy "read-players" on public.players for select using ( true );
create policy "read-scores" on public.scores for select using ( true );
create policy "insert-players" on public.players for insert with check ( true );
create policy "insert-scores" on public.scores for insert with check ( true );
-- (No update/delete policies)
