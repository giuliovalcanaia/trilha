-- RLS de `professores`: cada professor enxerga apenas o próprio cadastro e o
-- aluno anônimo não enxerga nenhum.
--
-- Roda contra o banco local (`npx supabase db reset` antes, para o seed) e
-- desfaz tudo no final: nada do que é criado aqui fica no banco.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(7);

-- Fixtures: o trigger `on_auth_user_created` cria a linha em `professores`
-- para usuários com e-mail, e ignora alunos anônimos.
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', 'prof-a@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000b2', 'prof-b@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000c3', null, true);

-- Professor A.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.professores),
  1::bigint,
  'professor A vê somente a própria linha em professores'
);

select is(
  (select nome from public.professores),
  'prof-a',
  'o trigger de cadastro deriva o nome do e-mail'
);

select is(
  private.current_professor_id(),
  (select id from public.professores where nome = 'prof-a'),
  'current_professor_id resolve o professor da sessão'
);

with alterado as (
  update public.professores
  set nome = 'invadido'
  where user_id = '00000000-0000-0000-0000-0000000000b2'
  returning id
)
select is(
  (select count(*) from alterado),
  0::bigint,
  'professor A não altera o cadastro do professor B'
);

-- Aluno anônimo.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.professores),
  0::bigint,
  'aluno anônimo não vê nenhum professor'
);

select ok(
  private.current_professor_id() is null,
  'aluno anônimo não tem professor associado'
);

select is(
  (select count(*) from public.estudantes),
  0::bigint,
  'aluno anônimo só vira estudante ao entrar em uma atividade'
);

select * from finish();

rollback;
