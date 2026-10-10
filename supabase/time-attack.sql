-- Supabase SQL Editor에서 한 번 실행합니다.
-- 기존 players/runs와 클래식 기록은 그대로 유지합니다.
do $$
declare
  player_id_type text;
begin
  select format_type(a.atttypid,a.atttypmod) into player_id_type
    from pg_attribute a
    where a.attrelid = 'public.players'::regclass and a.attname = 'id';
  execute format($ddl$
    create table if not exists public.time_attack_runs (
      id bigint generated always as identity primary key,
      player_id %s not null references public.players(id),
      distance_km numeric not null default 417 check (distance_km = 417),
      avg_speed_kmh numeric not null check (avg_speed_kmh >= 0),
      elapsed_ms bigint not null check (elapsed_ms > 0),
      created_at timestamptz not null default now()
    )
  $ddl$,player_id_type);
end $$;

create index if not exists time_attack_runs_ranking_idx
  on public.time_attack_runs(elapsed_ms,id);
create index if not exists time_attack_runs_player_idx
  on public.time_attack_runs(player_id,elapsed_ms,id);
alter table public.time_attack_runs enable row level security;
grant select,insert on public.time_attack_runs to anon,authenticated;
grant usage,select on sequence public.time_attack_runs_id_seq to anon,authenticated;
drop policy if exists "Read time attack rankings" on public.time_attack_runs;
create policy "Read time attack rankings" on public.time_attack_runs
  for select to anon,authenticated using (true);
drop policy if exists "Submit completed time attack" on public.time_attack_runs;
create policy "Submit completed time attack" on public.time_attack_runs
  for insert to anon,authenticated with check (distance_km = 417 and elapsed_ms > 0);
notify pgrst,'reload schema';
