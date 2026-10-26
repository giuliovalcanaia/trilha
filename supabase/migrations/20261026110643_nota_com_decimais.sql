-- A nota passa a aceitar casas decimais (o app digita no padrão brasileiro,
-- com vírgula, e normaliza para ponto antes de chamar o RPC). Os RPCs
-- arredondam para duas casas, que é o limite aceito pelo formulário.
alter table public.progresso_estudante
  alter column pontuacao type numeric
  using pontuacao::numeric;

-- A assinatura muda (integer → numeric), então a versão antiga precisa sair
-- antes para não deixar duas sobrecargas do mesmo RPC.
drop function if exists public.complete_link(bigint, bigint, text, integer);

create or replace function public.complete_link(
  p_aplicacao_id bigint,
  p_link_id bigint,
  p_senha text,
  p_pontuacao numeric default null
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
      pontuacao = coalesce(round(p_pontuacao, 2), pontuacao)
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

revoke all on function public.complete_link(bigint, bigint, text, numeric)
  from public, anon;
grant execute on function public.complete_link(bigint, bigint, text, numeric)
  to authenticated;

-- Ajuste manual do professor: também passa a aceitar nota com decimais.
drop function if exists public.set_student_progress(bigint, bigint, text, integer);

create or replace function public.set_student_progress(
  p_participacao_id bigint,
  p_link_id bigint,
  p_status text,
  p_pontuacao numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_atividade_id bigint;
  v_link_ordem integer;
  v_next_link_id bigint;
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if p_status not in ('aberta', 'fazendo', 'concluida', 'bloqueada') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  if p_pontuacao is not null and p_pontuacao < 0 then
    raise exception 'invalid_score' using errcode = '22023';
  end if;

  select l.atividade_id, l.ordem
  into v_atividade_id, v_link_ordem
  from public.links l
  join public.aplicacoes ap on ap.atividade_id = l.atividade_id
  join public.participacoes p on p.aplicacao_id = ap.id
  join public.atividades a on a.id = l.atividade_id
  where l.id = p_link_id
    and p.id = p_participacao_id
    and a.professor_id = v_professor_id
    and a.deleted_at is null;

  if v_atividade_id is null then
    raise exception 'progress_not_found' using errcode = 'P0002';
  end if;

  update public.progresso_estudante
  set status = p_status,
      pontuacao = round(p_pontuacao, 2)
  where participacao_id = p_participacao_id
    and link_id = p_link_id;

  if p_status = 'concluida' then
    select l.id
    into v_next_link_id
    from public.links l
    where l.atividade_id = v_atividade_id
      and l.ordem > v_link_ordem
    order by l.ordem asc
    limit 1;

    if v_next_link_id is not null then
      update public.progresso_estudante
      set status = 'aberta'
      where participacao_id = p_participacao_id
        and link_id = v_next_link_id
        and status = 'bloqueada';
    end if;
  end if;
end;
$$;

revoke all on function public.set_student_progress(bigint, bigint, text, numeric)
  from public, anon;
grant execute on function public.set_student_progress(bigint, bigint, text, numeric)
  to authenticated;
