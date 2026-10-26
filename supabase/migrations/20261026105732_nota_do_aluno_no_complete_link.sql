-- A nota do aluno pode ser informada junto com a senha, no próprio fluxo de
-- conclusão do link. Ela é opcional: sem valor, a nota atual é preservada
-- (inclusive uma nota já lançada pelo professor). A senha é validada antes de
-- qualquer escrita, então uma tentativa com senha errada não grava a nota.
--
-- A assinatura muda (novo parâmetro), então a versão antiga precisa sair antes
-- para não deixar duas sobrecargas de `complete_link` com o mesmo nome.
drop function if exists public.complete_link(bigint, bigint, text);

create or replace function public.complete_link(
  p_aplicacao_id bigint,
  p_link_id bigint,
  p_senha text,
  p_pontuacao integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estudante_id bigint := (select private.current_estudante_id());
  v_aplicacao public.aplicacoes;
  v_participacao public.participacoes;
  v_link public.links;
  v_progresso_status text;
  v_senha_hash text;
  v_next_link_id bigint;
  v_pending integer;
begin
  if v_estudante_id is null then
    raise exception 'not_a_student' using errcode = '42501';
  end if;

  if nullif(trim(p_senha), '') is null then
    raise exception 'password_required' using errcode = '22023';
  end if;

  select * into v_aplicacao
  from public.aplicacoes
  where id = p_aplicacao_id;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = v_aplicacao.atividade_id
      and deleted_at is null
  ) then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  if v_aplicacao.status <> 'aberta' then
    raise exception 'application_closed' using errcode = 'P0001';
  end if;

  select * into v_participacao
  from public.participacoes
  where aplicacao_id = p_aplicacao_id
    and estudante_id = v_estudante_id;

  if not found then
    raise exception 'not_in_application' using errcode = '42501';
  end if;

  select * into v_link
  from public.links
  where id = p_link_id
    and atividade_id = v_aplicacao.atividade_id;

  if not found then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;

  select status into v_progresso_status
  from public.progresso_estudante
  where participacao_id = v_participacao.id
    and link_id = p_link_id;

  if v_progresso_status is null or v_progresso_status not in ('aberta', 'fazendo') then
    raise exception 'link_locked' using errcode = 'P0001';
  end if;

  select senha_hash
  into v_senha_hash
  from public.atividade_senhas
  where atividade_id = v_aplicacao.atividade_id;

  if v_senha_hash is null then
    raise exception 'password_not_set' using errcode = 'P0001';
  end if;

  if extensions.crypt(trim(p_senha), v_senha_hash) <> v_senha_hash then
    raise exception 'invalid_password' using errcode = 'P0001';
  end if;

  -- A nota só é considerada depois de a senha ser validada: qualquer escrita
  -- abaixo acontece apenas quando a senha confere, então a nota nunca é
  -- gravada em uma tentativa com senha errada.
  if p_pontuacao is not null and p_pontuacao < 0 then
    raise exception 'invalid_score' using errcode = '22023';
  end if;

  update public.progresso_estudante
  set status = 'concluida',
      pontuacao = coalesce(p_pontuacao, pontuacao)
  where participacao_id = v_participacao.id
    and link_id = p_link_id;

  select l.id
  into v_next_link_id
  from public.links l
  where l.atividade_id = v_aplicacao.atividade_id
    and l.ordem > v_link.ordem
  order by l.ordem asc
  limit 1;

  if v_next_link_id is not null then
    update public.progresso_estudante
    set status = 'aberta'
    where participacao_id = v_participacao.id
      and link_id = v_next_link_id
      and status = 'bloqueada';
  end if;

  select count(*)
  into v_pending
  from public.progresso_estudante p
  join public.links l on l.id = p.link_id
  where p.participacao_id = v_participacao.id
    and l.atividade_id = v_aplicacao.atividade_id
    and p.status <> 'concluida';

  if v_pending = 0 then
    update public.participacoes
    set concluido_em = coalesce(concluido_em, now())
    where id = v_participacao.id;
  end if;

  return jsonb_build_object(
    'link_id', p_link_id,
    'next_link_id', v_next_link_id
  );
end;
$$;

revoke all on function public.complete_link(bigint, bigint, text, integer)
  from public, anon;
grant execute on function public.complete_link(bigint, bigint, text, integer)
  to authenticated;
