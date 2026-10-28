-- Fluxo do aluno pelas RPCs: entrada pelo código, andamento, conclusão com
-- senha, expulsão e retorno. É o teste que amarra as regras que o app não
-- consegue garantir só com RLS.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(31);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', 'prof-a@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000c3', null, true);

-- Professor A publica a atividade usada no fluxo.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

insert into public.atividades (professor_id, titulo)
select id, 'Fluxo do aluno' from public.professores;

insert into public.links (atividade_id, ordem, titulo, href)
select id, 1, 'Primeiro', 'https://example.com/1'
from public.atividades where titulo = 'Fluxo do aluno';

insert into public.links (atividade_id, ordem, titulo, href)
select id, 2, 'Segundo', 'https://example.com/2'
from public.atividades where titulo = 'Fluxo do aluno';

select public.set_activity_password(
  (select id from public.atividades where titulo = 'Fluxo do aluno'),
  'aula123'
);

insert into public.aplicacoes (atividade_id, codigo)
select id, 'RPC001' from public.atividades where titulo = 'Fluxo do aluno';

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Fluxo do aluno'),
  true
);

reset role;

select id as aplicacao_id
from public.aplicacoes where codigo = 'RPC001' \gset

select id as link_1
from public.links where atividade_id = (
  select atividade_id from public.aplicacoes where codigo = 'RPC001'
) and ordem = 1 \gset

select id as link_2
from public.links where atividade_id = (
  select atividade_id from public.aplicacoes where codigo = 'RPC001'
) and ordem = 2 \gset

select ok(
  public.validate_join_code('RPC001'),
  'código de entrada da atividade ativa é válido'
);

-- Aluno anônimo entra pela primeira vez.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select ok(
  public.join_activity('RPC001', 'Aluno Fluxo') ? 'participacao_id',
  'join_activity devolve a participação criada'
);

reset role;

select id as participacao_id
from public.participacoes where nome = 'Aluno Fluxo' \gset

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.progresso_estudante),
  2::bigint,
  'entrar na atividade cria uma linha de progresso por link'
);

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.link_id = :link_1
  ),
  'aberta',
  'o primeiro link nasce aberto'
);

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.link_id = :link_2
  ),
  'bloqueada',
  'os links seguintes nascem bloqueados'
);

select public.update_my_progress(:aplicacao_id, :link_1, 'fazendo');

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.link_id = :link_1
  ),
  'fazendo',
  'abrir o link marca o progresso como fazendo'
);

-- Senha errada: volta como payload (não como exceção) para a tentativa
-- sobreviver à transação, não conclui e não grava a nota informada junto.
select is(
  (
    public.complete_link(:aplicacao_id, :link_1, 'senha-errada', 10)
  )->>'error',
  'invalid_password',
  'complete_link recusa a senha errada'
);

select is(
  (
    public.complete_link(:aplicacao_id, :link_1, 'senha-errada', null)
  )->>'tentativas_restantes',
  '3',
  'a recusa informa quantas tentativas restam'
);

select is(
  (select tentativas_senha from public.participacoes),
  2,
  'os erros de senha ficam gravados na participação'
);

select is(
  (
    select pe.pontuacao
    from public.progresso_estudante pe
    where pe.link_id = :link_1
  ),
  null::numeric,
  'a tentativa com senha errada não grava nota'
);

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.link_id = :link_1
  ),
  'fazendo',
  'a tentativa com senha errada não conclui o link'
);

-- Senha correta, com nota.
select public.complete_link(:aplicacao_id, :link_1, 'aula123', 9.5);

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.link_id = :link_1
  ),
  'concluida',
  'senha correta conclui o link'
);

select is(
  (
    select pe.pontuacao
    from public.progresso_estudante pe
    where pe.link_id = :link_1
  ),
  9.5::numeric,
  'a nota informada é gravada na conclusão'
);

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.link_id = :link_2
  ),
  'aberta',
  'concluir um link abre o próximo'
);

select public.complete_link(:aplicacao_id, :link_2, 'aula123', null);

reset role;

select ok(
  (select concluido_em from public.participacoes where id = :participacao_id)
    is not null,
  'concluir o último link fecha a participação'
);

-- Professor acompanha a nota pela RLS.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  (
    select pe.pontuacao
    from public.progresso_estudante pe
    where pe.link_id = :link_1
  ),
  9.5::numeric,
  'professor vê a nota registrada pelo aluno'
);

-- Expulsão.
select public.expel_student(:participacao_id);

select ok(
  (select expulso_em from public.participacoes where id = :participacao_id)
    is not null,
  'expel_student marca a participação como expulsa'
);

select is(
  (
    select count(*)
    from public.progresso_estudante
    where participacao_id = :participacao_id
  ),
  0::bigint,
  'expulsão apaga o progresso do aluno'
);

-- Aluno expulso.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.atividades),
  0::bigint,
  'aluno expulso perde o acesso à atividade'
);

select public.join_activity('RPC001', 'Aluno Fluxo');

select is(
  (select expulso_em from public.participacoes),
  null::timestamptz,
  'entrar de novo limpa a expulsão'
);

select is(
  (select count(*) from public.progresso_estudante where status = 'aberta'),
  1::bigint,
  'ao voltar, o aluno recomeça com apenas o primeiro link aberto'
);

-- Rate limit: cinco erros seguidos bloqueiam por 60 segundos.
select is(
  (
    select array_agg((public.complete_link(:aplicacao_id, :link_1, 'errada', null))->>'error')
    from generate_series(1, 4)
  ),
  array[
    'invalid_password',
    'invalid_password',
    'invalid_password',
    'invalid_password'
  ],
  'quatro tentativas erradas ainda não bloqueiam'
);

select is(
  (
    public.complete_link(:aplicacao_id, :link_1, 'errada', null)
  )->>'error',
  'password_locked',
  'a quinta tentativa errada bloqueia a participação'
);

select ok(
  (select bloqueado_ate > now() from public.participacoes),
  'a participação guarda até quando fica bloqueada'
);

select is(
  (
    public.complete_link(:aplicacao_id, :link_1, 'aula123', null)
  )->>'error',
  'password_locked',
  'durante o bloqueio nem a senha correta passa'
);

select is(
  (
    select pe.status
    from public.progresso_estudante pe
    where pe.link_id = :link_1
  ),
  'aberta',
  'o bloqueio não altera o progresso'
);

-- Simula o fim do bloqueio (não dá para esperar 60s dentro do teste).
reset role;
update public.participacoes
set bloqueado_ate = now() - interval '1 second'
where id = :participacao_id;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select ok(
  (public.complete_link(:aplicacao_id, :link_1, 'aula123', null))->>'ok'
    = 'true',
  'depois do bloqueio, a senha correta conclui o link'
);

select is(
  (
    select tentativas_senha
    from public.participacoes
    where id = :participacao_id
  ),
  0,
  'o acerto zera o contador de tentativas'
);

select is(
  (
    select bloqueado_ate
    from public.participacoes
    where id = :participacao_id
  ),
  null::timestamptz,
  'o acerto limpa o bloqueio'
);

-- Atividade encerrada.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Fluxo do aluno'),
  false
);

reset role;

select isnt(
  public.validate_join_code('RPC001'),
  true,
  'código de entrada de atividade encerrada é recusado'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.join_activity('RPC001', 'Aluno Fluxo')$$,
  'TRL07',
  'activity_not_published',
  'join_activity recusa atividade encerrada'
);

select * from finish();

rollback;
