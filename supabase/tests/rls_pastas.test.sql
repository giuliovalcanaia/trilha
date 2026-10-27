-- RLS de `pastas` e compartilhamento entre professores.
--
-- Cobre: isolamento por professor, acesso do colaborador à pasta compartilhada
-- e às subpastas, bloqueio de mover/excluir a raiz compartilhada e perda de
-- acesso quando o compartilhamento é removido.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(10);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', 'prof-a@trilha.test', false),
  ('00000000-0000-0000-0000-0000000000b2', 'prof-b@trilha.test', false);

-- Os ids são lidos como `postgres` porque a RLS esconde o professor B de A
-- (e vice-versa) nas consultas feitas com `authenticated`.
select id as prof_b_id from public.professores where nome = 'prof-b' \gset

-- Professor A cria a árvore que vai compartilhar.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

insert into public.pastas (professor_id, parent_id, nome)
select id, null, 'Raiz A' from public.professores;

insert into public.pastas (professor_id, parent_id, nome)
select id, (select id from public.pastas where nome = 'Raiz A'), 'Subpasta A'
from public.professores;

select is(
  (select count(*) from public.pastas),
  2::bigint,
  'professor A vê as duas pastas que criou'
);

-- Professor B, antes de ter qualquer acesso.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.pastas),
  0::bigint,
  'professor B não vê pastas de A sem compartilhamento'
);

select is(
  (select count(*) from public.pasta_compartilhamentos),
  0::bigint,
  'a tabela de compartilhamentos não é legível direto pela RLS'
);

-- Professor A compartilha a raiz.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select public.share_folder(
  (select id from public.pastas where nome = 'Raiz A'),
  'prof-b@trilha.test'
);

-- Professor B, agora colaborador.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.pastas),
  2::bigint,
  'colaborador vê a pasta compartilhada e a subpasta dela'
);

insert into public.pastas (professor_id, parent_id, nome)
select id, (select id from public.pastas where nome = 'Raiz A'), 'Subpasta B'
from public.professores;

select is(
  (select count(*) from public.pastas where nome = 'Subpasta B'),
  1::bigint,
  'colaborador cria subpasta dentro da pasta compartilhada'
);

select throws_ok(
  format(
    'update public.pastas set parent_id = %s where nome = %L',
    (select id from public.pastas where nome = 'Subpasta B'),
    'Raiz A'
  ),
  'TRL22',
  'shared_folder_root',
  'colaborador não move a raiz compartilhada'
);

select throws_ok(
  format(
    'update public.pastas set deleted_at = now(), trash_id = gen_random_uuid() where nome = %L',
    'Raiz A'
  ),
  'TRL22',
  'shared_folder_root',
  'colaborador não manda a raiz compartilhada para a lixeira'
);

with removidas as (
  delete from public.pastas where nome = 'Raiz A' returning id
)
select is(
  (select count(*) from removidas),
  0::bigint,
  'colaborador não apaga a raiz compartilhada de vez'
);

-- Professor A remove o acesso de B.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select public.unshare_folder(
  (select id from public.pastas where nome = 'Raiz A'),
  :prof_b_id
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.pastas where nome = 'Raiz A'),
  0::bigint,
  'sem o compartilhamento, o colaborador perde o acesso à pasta e às subpastas'
);

select is(
  (select count(*) from public.pastas),
  1::bigint,
  'a subpasta criada pelo colaborador continua visível para ele'
);

select * from finish();

rollback;
