-- =====================================================
-- TEOLOGIA VIVA — Setup SQL
-- Copie TUDO e cole em: Supabase Dashboard → SQL Editor → New Query → Run
-- =====================================================

-- 1) Criar tabela anotacoes (não existe ainda)
create table if not exists public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists anotacoes_user_id_idx on public.anotacoes(user_id);
create index if not exists anotacoes_created_at_idx on public.anotacoes(created_at desc);

-- 2) Habilitar RLS em todas as tabelas do app
alter table public.profiles enable row level security;
alter table public.anotacoes enable row level security;
alter table public.mural_oracoes enable row level security;
alter table public.interacoes_oracao enable row level security;
alter table public.devocionais enable row level security;
alter table public.eixos enable row level security;
alter table public.cursos enable row level security;
alter table public.aulas enable row level security;
alter table public.eventos_comunidade enable row level security;

-- 3) Policies — usuário gerencia apenas seus próprios dados
drop policy if exists "self rw profiles" on public.profiles;
create policy "self rw profiles" on public.profiles for all
  to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "self rw anotacoes" on public.anotacoes;
create policy "self rw anotacoes" on public.anotacoes for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "self rw interacoes" on public.interacoes_oracao;
create policy "self rw interacoes" on public.interacoes_oracao for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Mural — leitura pública (autenticado), escrita do próprio, update do contador permitido
drop policy if exists "read all mural" on public.mural_oracoes;
create policy "read all mural" on public.mural_oracoes for select
  to authenticated using (true);

drop policy if exists "insert own mural" on public.mural_oracoes;
create policy "insert own mural" on public.mural_oracoes for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "update mural" on public.mural_oracoes;
create policy "update mural" on public.mural_oracoes for update
  to authenticated using (true) with check (true);

-- 5) Conteúdo público (devocionais/eixos/cursos/aulas/eventos)
drop policy if exists "read devocionais" on public.devocionais;
create policy "read devocionais" on public.devocionais for select
  to authenticated using (true);

drop policy if exists "read eixos" on public.eixos;
create policy "read eixos" on public.eixos for select
  to authenticated using (true);

drop policy if exists "read cursos" on public.cursos;
create policy "read cursos" on public.cursos for select
  to authenticated using (true);

drop policy if exists "read aulas" on public.aulas;
create policy "read aulas" on public.aulas for select
  to authenticated using (true);

drop policy if exists "read eventos approved" on public.eventos_comunidade;
create policy "read eventos approved" on public.eventos_comunidade for select
  to authenticated using (status = 'approved');

-- 6) Streaks — colunas auxiliares na tabela profiles
-- (você já criou current_streak; estas duas adicionais são necessárias para a lógica)
alter table public.profiles
  add column if not exists last_devo_date date,
  add column if not exists best_streak integer not null default 0;

-- 7) Função RPC para registrar leitura do devocional do dia e atualizar streak
create or replace function public.register_devo_read()
returns table (current_streak integer, best_streak integer, last_devo_date date)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := current_date;
  last_d date;
  cur int;
  best int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select p.last_devo_date, coalesce(p.current_streak, 0), coalesce(p.best_streak, 0)
    into last_d, cur, best
  from public.profiles p where p.id = uid;

  if last_d = today then
    -- já leu hoje, não muda nada
    return query select cur, best, last_d;
    return;
  end if;

  if last_d = today - 1 then
    cur := cur + 1;
  else
    cur := 1;
  end if;

  if cur > best then
    best := cur;
  end if;

  update public.profiles
    set current_streak = cur, best_streak = best, last_devo_date = today
    where id = uid;

  return query select cur, best, today;
end $$;

grant execute on function public.register_devo_read() to authenticated;

-- 8) Seed mínimo (opcional, mas útil para teste imediato)
-- Devocional de hoje (só insere se ainda não houver para a data)
insert into public.devocionais (data, titulo, versiculo, referencia, reflexao)
select
  current_date,
  'A Luz que Permanece',
  'Lâmpada para os meus pés é tua palavra, e luz para o meu caminho.',
  'Salmos 119:105',
  'Quando o caminho parece obscuro, a Palavra ilumina. Hoje, escolha buscar a Escritura como bússola — não para responder a tudo, mas para sustentar cada passo. Que a luz da Palavra traga clareza onde houver dúvida e firmeza onde houver hesitação.'
where not exists (select 1 from public.devocionais where data = current_date);
