-- RLS de `participacoes` e `progresso_estudante`.
--
-- Cobre: cada aluno enxerga apenas a própria participação e o próprio
-- progresso; o professor dono vê a turma inteira; professor de fora não vê
-- nada; e o aluno não escreve direto no progresso.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(9);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', 'prof-a@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000b2', 'prof-b@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000c3', null, true),
  ('00000000-0000-0000-0000-0000000000d4', null, true);

-- Professor A publica uma atividade com dois links.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

insert into public.atividades (professor_id, titulo)
select id, 'Turma RLS' from public.professores;

insert into public.links (atividade_id, ordem, titulo, href)
select id, 1, 'Primeiro', 'https://example.com/1'
from public.atividades where titulo = 'Turma RLS';

insert into public.links (atividade_id, ordem, titulo, href)
select id, 2, 'Segundo', 'https://example.com/2'
from public.atividades where titulo = 'Turma RLS';

select public.set_activity_password(
  (select id from public.atividades where titulo = 'Turma RLS'),
  'aula123'
);

insert into public.aplicacoes (atividade_id, codigo)
select id, 'RLS002' from public.atividades where titulo = 'Turma RLS';

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Turma RLS'),
  true
);

-- Aluno 1 entra.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select public.join_activity('RLS002', 'Aluno 1');

-- Aluno 2 entra.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}',
  true
);

select public.join_activity('RLS002', 'Aluno 2');

select id as participacao_2
from public.participacoes where nome = 'Aluno 2' \gset

-- Aluno 1: só vê a si mesmo.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.participacoes),
  1::bigint,
  'aluno vê apenas a própria participação'
);

select is(
  (select nome from public.participacoes),
  'Aluno 1',
  'a participação visível é a do próprio aluno'
);

select is(
  (select count(*) from public.progresso_estudante),
  2::bigint,
  'aluno vê o próprio progresso (um registro por link)'
);

select is(
  (
    select count(*)
    from public.progresso_estudante
    where participacao_id = :participacao_2
  ),
  0::bigint,
  'aluno não vê o progresso do outro aluno'
);

with alterados as (
  update public.progresso_estudante set status = 'concluida' returning link_id
)
select is(
  (select count(*) from alterados),
  0::bigint,
  'aluno não conclui link por update direto na tabela'
);

select throws_ok(
  format(
    'insert into public.progresso_estudante (participacao_id, link_id, status)
     select %s, id, ''aberta'' from public.links limit 1',
    :participacao_2
  ),
  '42501',
  'new row violates row-level security policy for table "progresso_estudante"',
  'aluno não cria linha de progresso por insert direto'
);

-- Professor dono da atividade.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.participacoes),
  2::bigint,
  'professor dono vê a turma inteira'
);

select is(
  (select count(*) from public.progresso_estudante),
  4::bigint,
  'professor dono vê o progresso de todos os alunos'
);

-- Professor B, sem acesso à atividade.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.participacoes),
  0::bigint,
  'professor de fora não vê participação nem progresso alheio'
);

select * from finish();

rollback;
