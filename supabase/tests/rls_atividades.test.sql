-- RLS de `atividades`, `links` e `atividade_senhas`.
--
-- Cobre: isolamento entre professores, colaborador com acesso de edição na
-- pasta compartilhada, aluno que só enxerga a atividade depois de entrar e o
-- efeito de encerrar a atividade na visão do aluno.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(13);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', 'prof-a@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000b2', 'prof-b@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000c3', null, true);

-- Professor A: pasta compartilhada com uma atividade publicada e uma atividade
-- solta (rascunho) que B não deve enxergar.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

insert into public.pastas (professor_id, parent_id, nome)
select id, null, 'Pasta compartilhada' from public.professores;

select public.share_folder(
  (select id from public.pastas where nome = 'Pasta compartilhada'),
  'prof-b@trilha.test'
);

insert into public.atividades (professor_id, pasta_id, titulo)
select
  id,
  (select id from public.pastas where nome = 'Pasta compartilhada'),
  'Dentro da pasta'
from public.professores;

insert into public.atividades (professor_id, titulo)
select id, 'Fora da pasta' from public.professores;

insert into public.links (atividade_id, ordem, titulo, href)
select id, 1, 'Primeiro', 'https://example.com/1'
from public.atividades where titulo = 'Dentro da pasta';

insert into public.links (atividade_id, ordem, titulo, href)
select id, 2, 'Segundo', 'https://example.com/2'
from public.atividades where titulo = 'Dentro da pasta';

select public.set_activity_password(
  (select id from public.atividades where titulo = 'Dentro da pasta'),
  'aula123'
);

insert into public.aplicacoes (atividade_id, codigo)
select id, 'RLS001' from public.atividades where titulo = 'Dentro da pasta';

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Dentro da pasta'),
  true
);

select is(
  (select count(*) from public.atividades),
  2::bigint,
  'professor A vê as próprias atividades'
);

select is(
  (select senha_texto from public.atividade_senhas),
  'aula123',
  'o dono consulta a senha de liberação em texto'
);

-- Professor B: colaborador da pasta compartilhada.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.atividades),
  1::bigint,
  'colaborador vê só a atividade da pasta compartilhada'
);

select is(
  (select count(*) from public.links),
  2::bigint,
  'colaborador vê os links da atividade compartilhada'
);

select is(
  (select count(*) from public.atividades where titulo = 'Fora da pasta'),
  0::bigint,
  'colaborador não vê atividade fora do compartilhamento'
);

with alteradas as (
  update public.atividades
  set subtitulo = 'editado pelo colaborador'
  where titulo = 'Dentro da pasta'
  returning id
)
select is(
  (select count(*) from alteradas),
  1::bigint,
  'colaborador edita a atividade compartilhada'
);

-- Aluno anônimo, antes de entrar.
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
  'aluno sem participação não vê atividade nenhuma'
);

select is(
  (select count(*) from public.links),
  0::bigint,
  'aluno sem participação não vê link nenhum'
);

-- Aluno entra pelo código.
select public.join_activity('RLS001', 'Aluno RLS');

select is(
  (select count(*) from public.atividades),
  1::bigint,
  'depois de entrar, o aluno vê a atividade publicada'
);

select is(
  (select count(*) from public.links),
  2::bigint,
  'depois de entrar, o aluno vê os links da atividade'
);

select is(
  (select count(*) from public.atividade_senhas),
  0::bigint,
  'aluno não lê a senha de liberação'
);

-- Professor A encerra a atividade.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select public.set_atividade_ativa(
  (select id from public.atividades where titulo = 'Dentro da pasta'),
  false
);

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
  'com a atividade encerrada, o aluno deixa de ver a atividade'
);

select is(
  (select count(*) from public.aplicacoes),
  1::bigint,
  'a entrada continua legível para o aluno detectar o encerramento'
);

select * from finish();

rollback;
