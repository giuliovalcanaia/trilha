-- Editar o nome do aluno: o próprio aluno pela conexão ativa e o professor
-- pela aba Alunos (dono ou colaborador da pasta compartilhada). O nome repetido
-- é permitido, como no join_activity, e o progresso nunca é tocado.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(13);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', 'prof-nome@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000a2', 'prof-colab@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000a3', 'prof-fora@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000b1', null, true),
  ('00000000-0000-0000-0000-0000000000b2', null, true);

-- Professor dono cria a pasta, a atividade e a entrada, e compartilha a pasta.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

insert into public.pastas (professor_id, nome)
select id, 'Turma do nome' from public.professores
where user_id = '00000000-0000-0000-0000-0000000000a1';

insert into public.atividades (professor_id, pasta_id, titulo)
select p.id, pa.id, 'Renomear aluno'
from public.professores p
join public.pastas pa on pa.professor_id = p.id
where p.user_id = '00000000-0000-0000-0000-0000000000a1';

insert into public.links (atividade_id, ordem, titulo, href)
select id, 1, 'Primeiro', 'https://example.com/1'
from public.atividades where titulo = 'Renomear aluno';

insert into public.aplicacoes (atividade_id, codigo)
select id, 'NOME01' from public.atividades where titulo = 'Renomear aluno';

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Renomear aluno'),
  true
);

select public.share_folder(
  (select id from public.pastas where nome = 'Turma do nome'),
  'prof-colab@trilha.test'
);

reset role;

select id as aplicacao_id
from public.aplicacoes where codigo = 'NOME01' \gset

select id as link_1
from public.links where atividade_id = (
  select atividade_id from public.aplicacoes where codigo = 'NOME01'
) and ordem = 1 \gset

select id as pasta_id
from public.pastas where nome = 'Turma do nome' \gset

-- Aluna entra, começa o primeiro link e corrige o próprio nome.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',
  true
);

select public.join_activity('NOME01', 'ana');
select public.update_my_progress(:aplicacao_id, :link_1, 'fazendo');
select public.rename_my_participation(:aplicacao_id, '  Ana Maria  ');

reset role;

select id as participacao_ana
from public.participacoes where nome = 'Ana Maria' \gset

select is(
  (select nome from public.participacoes where id = :participacao_ana),
  'Ana Maria',
  'a aluna renomeia a própria participação (com trim)'
);

select is(
  (select nome from public.estudantes
   where user_id = '00000000-0000-0000-0000-0000000000b1'),
  'Ana Maria',
  'o rename mantém estudantes.nome coerente'
);

select is(
  (select pe.status
   from public.progresso_estudante pe
   where pe.participacao_id = :participacao_ana
     and pe.link_id = :link_1),
  'fazendo',
  'renomear não mexe no progresso'
);

select isnt(
  (select conexao_estudante_id from public.participacoes
   where id = :participacao_ana),
  null::bigint,
  'renomear não derruba a conexão'
);

-- Nome vazio e nome longo são recusados.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',
  true
);

select throws_ok(
  format($$select public.rename_my_participation(%s, '   ')$$, :aplicacao_id),
  'TRL04',
  'name_required',
  'nome vazio é recusado'
);

select throws_ok(
  format(
    $$select public.rename_my_participation(%s, repeat('a', 41))$$,
    :aplicacao_id
  ),
  'TRL34',
  'name_too_long',
  'nome com mais de 40 caracteres é recusado'
);

-- Outra aluna não alcança a linha da Ana: só renomeia a própria.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select public.join_activity('NOME01', 'Beatriz');
select public.rename_my_participation(:aplicacao_id, 'Bia');

reset role;

select is(
  (select nome from public.participacoes where id = :participacao_ana),
  'Ana Maria',
  'renomear a própria sessão não altera a participação de outra aluna'
);

select is(
  (select nome from public.participacoes
   where aplicacao_id = :aplicacao_id
     and id <> :participacao_ana),
  'Bia',
  'a outra aluna renomeou apenas a própria linha'
);

-- Professor dono renomeia.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select public.set_student_name(:participacao_ana, 'Ana Maria Silva');
reset role;

select is(
  (select nome from public.participacoes where id = :participacao_ana),
  'Ana Maria Silva',
  'o professor dono renomeia o aluno'
);

-- Colaborador da pasta compartilhada também renomeia — e pode repetir o nome.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select public.set_student_name(:participacao_ana, 'Bia');
reset role;

select is(
  (select nome from public.participacoes where id = :participacao_ana),
  'Bia',
  'o colaborador renomeia e nomes repetidos são permitidos'
);

-- Professor sem acesso é recusado.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  format($$select public.set_student_name(%s, 'Intruso')$$, :participacao_ana),
  'TRL27',
  'participation_not_found',
  'professor sem acesso não renomeia o aluno'
);

-- Professor não é aluno.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select throws_ok(
  format($$select public.rename_my_participation(%s, 'X')$$, :aplicacao_id),
  'TRL03',
  'not_a_student',
  'rename_my_participation exige sessão de aluno'
);

-- Sem conexão ativa, o aluno não renomeia.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',
  true
);

select public.leave_activity(:aplicacao_id);

select throws_ok(
  format($$select public.rename_my_participation(%s, 'Fantasma')$$, :aplicacao_id),
  'TRL27',
  'participation_not_found',
  'sem conexão ativa o aluno não renomeia'
);

reset role;

select * from finish();

rollback;
