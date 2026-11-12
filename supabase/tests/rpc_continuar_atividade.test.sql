-- Continuar a atividade em outro dia: o aluno assume uma participação livre,
-- um nome conectado não pode ser tomado por outro aluno, o professor derruba
-- a conexão sem apagar o progresso e o aluno original pode reassumir depois.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(30);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000d1', 'prof-cont@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000d2', 'prof-cont-2@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000e1', null, true),
  ('00000000-0000-0000-0000-0000000000e2', null, true);

-- Professor A publica a atividade usada no fluxo.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}',
  true
);

insert into public.atividades (professor_id, titulo)
select id, 'Continuar atividade' from public.professores
where user_id = '00000000-0000-0000-0000-0000000000d1';

insert into public.links (atividade_id, ordem, titulo, href)
select id, 1, 'Primeiro', 'https://example.com/1'
from public.atividades where titulo = 'Continuar atividade';

insert into public.links (atividade_id, ordem, titulo, href)
select id, 2, 'Segundo', 'https://example.com/2'
from public.atividades where titulo = 'Continuar atividade';

select public.set_activity_password(
  (select id from public.atividades where titulo = 'Continuar atividade'),
  'aula123'
);

insert into public.aplicacoes (atividade_id, codigo)
select id, 'CONT01' from public.atividades
where titulo = 'Continuar atividade';

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Continuar atividade'),
  true
);

reset role;

select id as aplicacao_id
from public.aplicacoes where codigo = 'CONT01' \gset

select id as link_1
from public.links where atividade_id = (
  select atividade_id from public.aplicacoes where codigo = 'CONT01'
) and ordem = 1 \gset

select id as link_2
from public.links where atividade_id = (
  select atividade_id from public.aplicacoes where codigo = 'CONT01'
) and ordem = 2 \gset

-- Aluno A entra e começa o primeiro link.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}',
  true
);

select public.join_activity('CONT01', 'Ana');
select public.update_my_progress(:aplicacao_id, :link_1, 'fazendo');

reset role;

select id as participacao_ana
from public.participacoes where nome = 'Ana' \gset

select conexao_estudante_id as estudante_ana
from public.participacoes where id = :participacao_ana \gset

select is(
  (select conexao_estudante_id from public.participacoes where id = :participacao_ana),
  :estudante_ana::bigint,
  'join_activity conecta a participação ao aluno'
);

-- Aluno B entra com outro nome.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}',
  true
);

select public.join_activity('CONT01', 'Bia');
reset role;

select id as participacao_bia
from public.participacoes where nome = 'Bia' \gset

-- Ana está conectada: B não pode tomar o nome.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    $$select public.continue_activity('CONT01', %s)$$,
    :participacao_ana
  ),
  'TRL33',
  'participation_in_use',
  'continue_activity recusa um nome já conectado'
);

-- Professor derruba a conexão e B assume o nome livre.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}',
  true
);

select public.release_participation(:participacao_ana);
reset role;

select is(
  (select conexao_estudante_id from public.participacoes where id = :participacao_ana),
  null::bigint,
  'release_participation limpa a conexão'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}',
  true
);

select public.continue_activity('CONT01', :participacao_ana);

select is(
  (select conexao_estudante_id from public.participacoes where id = :participacao_ana),
  (select id from public.estudantes
   where user_id = '00000000-0000-0000-0000-0000000000e2'),
  'continue_activity conecta a sessão ao nome livre'
);

select is(
  (select count(*) from public.participacoes),
  1::bigint,
  'B deixa de ver a própria participação ao assumir outro nome'
);

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.participacao_id = :participacao_ana
      and pe.link_id = :link_1
  ),
  'fazendo',
  'o progresso do nome escolhido fica visível para B'
);

select is(
  (
    select em_uso
    from public.list_activity_students('CONT01')
    where aluno_nome = 'Ana'
  ),
  true,
  'a lista marca o nome conectado como em uso'
);

select public.complete_link(:aplicacao_id, :link_1, 'aula123', 8);

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.participacao_id = :participacao_ana
      and pe.link_id = :link_1
  ),
  'concluida',
  'a escrita do aluno vai para a participação conectada'
);

-- O aluno original perde o acesso enquanto B segura o nome.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.participacoes),
  0::bigint,
  'o aluno original perde a participação depois da troca'
);

select throws_ok(
  $$select public.update_my_progress(
      (select id from public.aplicacoes where codigo = 'CONT01'),
      (select l.id from public.links l
       join public.atividades a on a.id = l.atividade_id
       where a.titulo = 'Continuar atividade' and l.ordem = 1),
      'fazendo')$$,
  'TRL12',
  'not_in_application',
  'a escrita do aluno original é recusada'
);

select throws_ok(
  format(
    $$select public.continue_activity('CONT01', %s)$$,
    :participacao_ana
  ),
  'TRL33',
  'participation_in_use',
  'o aluno original também não toma o nome enquanto B está conectado'
);

-- Professor derruba de novo: o progresso continua e o original reassume.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}',
  true
);

select public.release_participation(:participacao_ana);
reset role;

select is(
  (
    select count(*)
    from public.progresso_estudante
    where participacao_id = :participacao_ana
  ),
  2::bigint,
  'release_participation não apaga o progresso'
);

select is(
  (select count(*) from public.list_activity_students('CONT01')),
  2::bigint,
  'a lista de nomes traz os dois alunos da entrada'
);

select is(
  (
    select em_uso
    from public.list_activity_students('CONT01')
    where aluno_nome = 'Ana'
  ),
  false,
  'Ana aparece desconectada depois do derrubar'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}',
  true
);

select public.continue_activity('CONT01', :participacao_ana);

select is(
  (select conexao_estudante_id from public.participacoes where id = :participacao_ana),
  :estudante_ana::bigint,
  'o aluno original pode reassumir o próprio nome depois do derrubar'
);

-- Conexão abandonada (aba fechada): o batimento velho libera o nome sem o
-- professor precisar clicar em Derrubar.
reset role;
update public.participacoes
set conexao_em = now() - interval '10 minutes'
where id = :participacao_ana;

select is(
  (
    select em_uso
    from public.list_activity_students('CONT01')
    where aluno_nome = 'Ana'
  ),
  false,
  'conexão sem batimento aparece livre na lista'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}',
  true
);

select public.continue_activity('CONT01', :participacao_ana);

select is(
  (
    select conexao_estudante_id
    from public.participacoes
    where id = :participacao_ana
  ),
  (
    select id from public.estudantes
    where user_id = '00000000-0000-0000-0000-0000000000e2'
  ),
  'a conexão expirada pode ser assumida por outro aluno'
);

select ok(
  (
    select conexao_em > now() - interval '1 minute'
    from public.participacoes
    where id = :participacao_ana
  ),
  'assumir o nome renova o batimento'
);

-- O batimento da tela do aluno renova a conexão sem passar pelo professor.
reset role;
update public.participacoes
set conexao_em = now() - interval '10 minutes'
where id = :participacao_ana;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}',
  true
);

select public.touch_participation(:aplicacao_id);
reset role;

select ok(
  (
    select conexao_em > now() - interval '1 minute'
    from public.participacoes
    where id = :participacao_ana
  ),
  'touch_participation renova o batimento'
);

-- Fechar a aba (pagehide) agenda a saída; o nome libera depois da carência.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}',
  true
);

select public.agendar_desconexao(:aplicacao_id);
reset role;

select ok(
  (
    select desconexao_agendada_em > now()
    from public.participacoes
    where id = :participacao_ana
  ),
  'agendar_desconexao marca a saída com carência'
);

update public.participacoes
set desconexao_agendada_em = now() - interval '1 second'
where id = :participacao_ana;

select is(
  (
    select em_uso
    from public.list_activity_students('CONT01')
    where aluno_nome = 'Ana'
  ),
  false,
  'o nome fica livre depois da saída agendada'
);

-- Voltar para a aba (ou recarregar) cancela a saída agendada.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}',
  true
);

select ok(
  public.touch_participation(:aplicacao_id),
  'touch_participation confirma que a conexão ainda é desta sessão'
);
reset role;

select is(
  (
    select em_uso
    from public.list_activity_students('CONT01')
    where aluno_nome = 'Ana'
  ),
  true,
  'batimento cancela a saída agendada'
);

-- Código de outra atividade não pode ser usado para assumir a participação.
select throws_ok(
  format(
    $$select public.continue_activity('OUTRO1', %s)$$,
    :participacao_ana
  ),
  'TRL06',
  'invalid_activity_code',
  'continue_activity recusa um código de outra atividade'
);

-- Atividade encerrada some da lista e recusa a continuação.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}',
  true
);

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Continuar atividade'),
  false
);

reset role;

select is(
  (select count(*) from public.list_activity_students('CONT01')),
  0::bigint,
  'atividade encerrada não lista nomes'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    $$select public.continue_activity('CONT01', %s)$$,
    :participacao_ana
  ),
  'TRL07',
  'activity_not_published',
  'continue_activity recusa atividade encerrada'
);

-- Reabre, expulsa Ana e confere que a lista e a continuação respeitam isso.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}',
  true
);

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Continuar atividade'),
  true
);

select public.expel_student(:participacao_ana);
reset role;

select is(
  (
    select count(*)
    from public.list_activity_students('CONT01')
    where aluno_nome = 'Ana'
  ),
  0::bigint,
  'aluno expulso não aparece na lista'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    $$select public.continue_activity('CONT01', %s)$$,
    :participacao_ana
  ),
  'TRL27',
  'participation_not_found',
  'continue_activity recusa participação expulsa'
);

select is(
  public.touch_participation(:aplicacao_id),
  false,
  'batimento de uma participação expulsa responde false'
);

-- Professor de outra atividade não derruba a conexão.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    $$select public.release_participation(%s)$$,
    :participacao_bia
  ),
  'TRL27',
  'participation_not_found',
  'professor sem acesso não derruba a conexão'
);

reset role;

select * from finish();
rollback;
