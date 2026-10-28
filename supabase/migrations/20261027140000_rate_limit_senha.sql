-- Rate limit da senha de liberação, do lado do servidor.
--
-- A partir de 5 erros seguidos, a participação fica bloqueada por 60 segundos
-- e nem a senha correta passa. O contador zera no acerto e ao entrar em um novo
-- bloqueio.
--
-- Por que `complete_link` passou a devolver `{ ok: false, ... }` em vez de
-- levantar exceção para senha errada: uma exceção desfaz a transação inteira do
-- RPC (o PostgREST envolve cada chamada em uma), então o incremento de
-- `tentativas_senha` seria perdido junto com o erro. Devolvendo um payload, a
-- tentativa é gravada e o cliente continua sabendo o motivo da recusa. Os
-- demais erros (sessão, atividade encerrada, link bloqueado, etc.) continuam
-- como exceção `TRLxx`, porque não precisam sobreviver ao erro.
alter table public.participacoes
  add column tentativas_senha integer not null default 0,
  add column bloqueado_ate timestamptz;

alter table public.participacoes
  add constraint participacoes_tentativas_senha_check
  check (tentativas_senha >= 0);

comment on column public.participacoes.tentativas_senha is
  'Erros de senha seguidos em complete_link; zera no acerto ou ao bloquear.';

comment on column public.participacoes.bloqueado_ate is
  'Enquanto estiver no futuro, complete_link recusa qualquer tentativa.';

create or replace function public.complete_link(
  p_aplicacao_id bigint,
  p_link_id bigint,
  p_senha text,
  p_pontuacao numeric default null::numeric
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_estudante_id bigint := (select private.current_estudante_id());
  v_aplicacao public.aplicacoes;
  v_participacao public.participacoes;
  v_link public.links;
  v_progresso_status text;
  v_ordem_embaralhada integer;
  v_senha_hash text;
  v_next_link_id bigint;
  v_pending integer;
  v_tentativas integer;
  v_bloqueado_ate timestamptz;
begin
  if v_estudante_id is null then
    raise exception 'not_a_student' using errcode = 'TRL03';
  end if;

  if nullif(trim(p_senha), '') is null then
    raise exception 'password_required' using errcode = 'TRL10';
  end if;

  select * into v_aplicacao
  from public.aplicacoes
  where id = p_aplicacao_id;

  if not found then
    raise exception 'application_not_found' using errcode = 'TRL11';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = v_aplicacao.atividade_id
      and deleted_at is null
  ) then
    raise exception 'application_not_found' using errcode = 'TRL11';
  end if;

  if v_aplicacao.status <> 'aberta' then
    raise exception 'application_closed' using errcode = 'TRL08';
  end if;

  select * into v_participacao
  from public.participacoes
  where aplicacao_id = p_aplicacao_id
    and estudante_id = v_estudante_id;

  if not found then
    raise exception 'not_in_application' using errcode = 'TRL12';
  end if;

  select * into v_link
  from public.links
  where id = p_link_id
    and atividade_id = v_aplicacao.atividade_id;

  if not found then
    raise exception 'link_not_found' using errcode = 'TRL13';
  end if;

  select status, ordem_embaralhada
  into v_progresso_status, v_ordem_embaralhada
  from public.progresso_estudante
  where participacao_id = v_participacao.id
    and link_id = p_link_id;

  if v_progresso_status is null or v_progresso_status not in ('aberta', 'fazendo') then
    raise exception 'link_locked' using errcode = 'TRL14';
  end if;

  select senha_hash
  into v_senha_hash
  from public.atividade_senhas
  where atividade_id = v_aplicacao.atividade_id;

  if v_senha_hash is null then
    raise exception 'password_not_set' using errcode = 'TRL15';
  end if;

  -- Bloqueio por tentativas: vale mesmo para a senha correta.
  select tentativas_senha, bloqueado_ate
  into v_tentativas, v_bloqueado_ate
  from public.participacoes
  where id = v_participacao.id;

  if v_bloqueado_ate is not null and v_bloqueado_ate > now() then
    return jsonb_build_object(
      'ok', false,
      'error', 'password_locked',
      'tentativas_restantes', 0,
      'segundos_restantes', greatest(
        1,
        ceil(extract(epoch from (v_bloqueado_ate - now())))::int
      )
    );
  end if;

  if extensions.crypt(trim(p_senha), v_senha_hash) <> v_senha_hash then
    -- Incremento atômico: duas abas errando ao mesmo tempo não se sobrescrevem.
    update public.participacoes
    set tentativas_senha = tentativas_senha + 1
    where id = v_participacao.id
    returning tentativas_senha into v_tentativas;

    if v_tentativas >= 5 then
      update public.participacoes
      set tentativas_senha = 0,
          bloqueado_ate = now() + interval '60 seconds'
      where id = v_participacao.id;

      return jsonb_build_object(
        'ok', false,
        'error', 'password_locked',
        'tentativas_restantes', 0,
        'segundos_restantes', 60
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_password',
      'tentativas_restantes', 5 - v_tentativas
    );
  end if;

  -- Senha correta: o contador zera, inclusive um bloqueio já vencido.
  update public.participacoes
  set tentativas_senha = 0,
      bloqueado_ate = null
  where id = v_participacao.id;

  -- A nota só é considerada depois de a senha ser validada: qualquer escrita
  -- abaixo acontece apenas quando a senha confere, então a nota nunca é
  -- gravada em uma tentativa com senha errada.
  if p_pontuacao is not null and p_pontuacao < 0 then
    raise exception 'invalid_score' using errcode = 'TRL17';
  end if;

  update public.progresso_estudante
  set status = 'concluida',
      pontuacao = coalesce(round(p_pontuacao, 2), pontuacao)
  where participacao_id = v_participacao.id
    and link_id = p_link_id;

  if v_ordem_embaralhada is not null then
    select p.link_id
    into v_next_link_id
    from public.progresso_estudante p
    where p.participacao_id = v_participacao.id
      and p.ordem_embaralhada > v_ordem_embaralhada
    order by p.ordem_embaralhada asc
    limit 1;
  else
    select l.id
    into v_next_link_id
    from public.links l
    where l.atividade_id = v_aplicacao.atividade_id
      and l.ordem > v_link.ordem
    order by l.ordem asc
    limit 1;
  end if;

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
    'ok', true,
    'link_id', p_link_id,
    'next_link_id', v_next_link_id
  );
end;
$function$;
