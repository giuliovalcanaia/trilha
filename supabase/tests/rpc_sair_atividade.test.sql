-- "Sair" da atividade: o aluno libera a própria conexão na hora, sem perder o
-- progresso, e o nome volta a ficar disponível na grade de continuar.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(11);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000f1', 'prof-sair@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000f2', null, true),
  ('00000000-0000-0000-0000-0000000000f3', null, true);

-- Professor publica a atividade usada no fluxo.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}',
  true
);

insert into public.atividades (professor_id, titulo)
select id, 'Sair da atividade' from public.professores
where user_id = '00000000-0000-0000-0000-0000000000f1';

insert into public.links (atividade_id, ordem, titulo, href)
select id, 1, 'Primeiro', 'https://example.com/1'
from public.atividades where titulo = 'Sair da atividade';

insert into public.links (atividade_id, ordem, titulo, href)
select id, 2, 'Segundo', 'https://example.com/2'
from public.atividades where titulo = 'Sair da atividade';

select public.set_activity_password(
  (select id from public.atividades where titulo = 'Sair da atividade'),
  'aula123'
);

insert into public.aplicacoes (atividade_id, codigo)
select id, 'SAIR1' from public.atividades
where titulo = 'Sair da atividade';

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Sair da atividade'),
  true
);

reset role;

select id as aplicacao_id
from public.aplicacoes where codigo = 'SAIR1' \gset

select id as link_1
from public.links where atividade_id = (
  select atividade_id from public.aplicacoes where codigo = 'SAIR1'
) and ordem = 1 \gset

-- A aluna entra, começa o primeiro link e a aba agenda a desconexão (beacon).
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}',
  true
);

select public.join_activity('SAIR1', 'Ana');
select public.update_my_progress(:aplicacao_id, :link_1, 'fazendo');
select public.agendar_desconexao(:aplicacao_id);

reset role;

select id as participacao_ana
from public.participacoes where nome = 'Ana' \gset

select isnt(
  (select conexao_estudante_id from public.participacoes
   where id = :participacao_ana),
  null::bigint,
  'join_activity deixa a participação conectada'
);

-- "Sair" limpa a conexão e o agendamento na hora.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}',
  true
);

select is(
  public.leave_activity(:aplicacao_id),
  true,
  'leave_activity devolve true quando havia conexão'
);

reset role;

select is(
  (select conexao_estudante_id from public.participacoes
   where id = :participacao_ana),
  null::bigint,
  'leave_activity limpa a conexão'
);

select is(
  (select conexao_em from public.participacoes
   where id = :participacao_ana),
  null::timestamptz,
  'leave_activity limpa o batimento'
);

select is(
  (select desconexao_agendada_em from public.participacoes
   where id = :participacao_ana),
  null::timestamptz,
  'leave_activity cancela a desconexão agendada'
);

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.participacao_id = :participacao_ana
      and pe.link_id = :link_1
  ),
  'fazendo',
  'sair preserva o progresso do nome'
);

select is(
  (
    select em_uso
    from public.list_activity_students('SAIR1')
    where aluno_nome = 'Ana'
  ),
  false,
  'o nome volta a aparecer livre na grade'
);

-- Sair de novo não é erro: só não havia mais nada para liberar.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}',
  true
);

select is(
  public.leave_activity(:aplicacao_id),
  false,
  'leave_activity devolve false quando a sessão já não estava conectada'
);

-- Outra aluna assume o nome livre e continua de onde Ana parou.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}',
  true
);

select public.continue_activity('SAIR1', :participacao_ana);

select is(
  (select conexao_estudante_id from public.participacoes
   where id = :participacao_ana),
  (select id from public.estudantes
   where user_id = '00000000-0000-0000-0000-0000000000f3'),
  'o nome liberado pode ser assumido por outra aluna'
);

select is(
  (select count(*) from public.participacoes),
  1::bigint,
  'a aluna que saiu deixa de ver a própria participação'
);

-- Professor não é aluno: a função recusa a chamada.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}',
  true
);

select throws_ok(
  format($$select public.leave_activity(%s)$$, :aplicacao_id),
  'TRL03',
  'not_a_student',
  'leave_activity exige uma sessão de aluno'
);

reset role;

select * from finish();

rollback;
