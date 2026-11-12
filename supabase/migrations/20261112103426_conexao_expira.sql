-- A conexão do aluno expira quando o navegador para de dar sinal de vida.
--
-- Antes, fechar a aba deixava o nome bloqueado para sempre: só o professor,
-- com "Derrubar", limpava `conexao_estudante_id`. Agora a conexão guarda um
-- batimento (`conexao_em`), renovado pela tela da atividade. Uma conexão sem
-- batimento há mais de 3 minutos é considerada livre — aparece disponível na
-- lista e pode ser assumida por outro aluno. O professor continua podendo
-- derrubar na hora, sem esperar a expiração.

alter table public.participacoes
  add column conexao_em timestamptz,
  add column desconexao_agendada_em timestamptz;

comment on column public.participacoes.conexao_em is
  'Último batimento da conexão ativa; depois de 3 minutos sem batimento a conexão expira.';

comment on column public.participacoes.desconexao_agendada_em is
  'Quando a aba pediu para sair (pagehide); depois desse instante a conexão conta como livre. Um novo batimento cancela.';

-- Quem já estava conectado no deploy ganha a janela cheia; o batimento da
-- tela aberta mantém a conexão a partir daí.
update public.participacoes
set conexao_em = now()
where conexao_estudante_id is not null;

create or replace function private.conexao_ativa(
  p_conexao_estudante_id bigint,
  p_conexao_em timestamptz,
  p_desconexao_agendada_em timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_conexao_estudante_id is not null
    and p_conexao_em is not null
    and p_conexao_em > now() - interval '3 minutes'
    and (
      p_desconexao_agendada_em is null
      or p_desconexao_agendada_em > now()
    )
$$;

revoke all on function private.conexao_ativa(bigint, timestamptz, timestamptz)
  from public;
grant execute on function private.conexao_ativa(bigint, timestamptz, timestamptz)
  to anon, authenticated;

-- ============================================================
-- Lista de nomes: em uso só enquanto o batimento está fresco.
-- ============================================================
create or replace function public.list_activity_students(p_codigo text)
returns table (
  participacao_id bigint,
  aluno_nome text,
  entrou_em timestamptz,
  em_uso boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.nome,
    p.iniciado_em,
    private.conexao_ativa(
      p.conexao_estudante_id,
      p.conexao_em,
      p.desconexao_agendada_em
    )
  from public.aplicacoes ap
  join public.atividades a on a.id = ap.atividade_id
  join public.participacoes p on p.aplicacao_id = ap.id
  where ap.codigo = upper(trim(p_codigo))
    and a.deleted_at is null
    and a.status = 'publicada'
    and ap.status = 'aberta'
    and p.expulso_em is null
  order by p.nome, p.iniciado_em
$$;

-- ============================================================
-- Entrada normal: grava o batimento junto com a conexão.
-- ============================================================
create or replace function public.join_activity(p_codigo text, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_aplicacao public.aplicacoes;
  v_atividade public.atividades;
  v_estudante public.estudantes;
  v_participacao public.participacoes;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'TRL01';
  end if;

  if nullif(trim(p_nome), '') is null then
    raise exception 'name_required' using errcode = 'TRL04';
  end if;

  if exists (select 1 from public.professores where user_id = v_uid) then
    raise exception 'teacher_cannot_join_as_student' using errcode = 'TRL05';
  end if;

  select *
  into v_aplicacao
  from public.aplicacoes
  where codigo = upper(trim(p_codigo));

  if not found then
    raise exception 'invalid_activity_code' using errcode = 'TRL06';
  end if;

  select * into v_atividade
  from public.atividades
  where id = v_aplicacao.atividade_id;

  if not found or v_atividade.deleted_at is not null then
    raise exception 'invalid_activity_code' using errcode = 'TRL06';
  end if;

  if v_atividade.status <> 'publicada' then
    raise exception 'activity_not_published' using errcode = 'TRL07';
  end if;

  if v_aplicacao.status <> 'aberta' then
    raise exception 'application_closed' using errcode = 'TRL08';
  end if;

  select * into v_estudante
  from public.estudantes
  where user_id = v_uid;

  if not found then
    insert into public.estudantes (user_id, nome)
    values (v_uid, trim(p_nome))
    returning * into v_estudante;
  else
    update public.estudantes
    set nome = trim(p_nome)
    where id = v_estudante.id
    returning * into v_estudante;
  end if;

  -- Se este aluno tinha assumido outro nome na mesma entrada, solta antes de
  -- conectar a própria participação (a conexão é única por aluno/entrada).
  update public.participacoes
  set conexao_estudante_id = null,
      conexao_em = null,
      desconexao_agendada_em = null
  where aplicacao_id = v_aplicacao.id
    and conexao_estudante_id = v_estudante.id;

  insert into public.participacoes as p (
    aplicacao_id,
    estudante_id,
    nome,
    conexao_estudante_id,
    conexao_em,
    desconexao_agendada_em
  )
  values (
    v_aplicacao.id,
    v_estudante.id,
    trim(p_nome),
    v_estudante.id,
    now(),
    null
  )
  on conflict (aplicacao_id, estudante_id) do update
    set nome = excluded.nome,
        conexao_estudante_id = excluded.conexao_estudante_id,
        conexao_em = excluded.conexao_em,
        desconexao_agendada_em = null,
        iniciado_em = case
          when p.expulso_em is not null then now()
          else p.iniciado_em
        end,
        concluido_em = case
          when p.expulso_em is not null then null
          else p.concluido_em
        end,
        expulso_em = null
  returning * into v_participacao;

  if not exists (
    select 1
    from public.progresso_estudante pe
    where pe.participacao_id = v_participacao.id
  ) then
    if v_atividade.embaralhar_links then
      with ordenadas as (
        select l.id, row_number() over (order by random()) as pos
        from public.links l
        where l.atividade_id = v_atividade.id
      )
      insert into public.progresso_estudante (
        participacao_id,
        link_id,
        status,
        ordem_embaralhada
      )
      select
        v_participacao.id,
        id,
        case when pos = 1 then 'aberta' else 'bloqueada' end,
        pos
      from ordenadas;
    else
      insert into public.progresso_estudante (participacao_id, link_id, status)
      select
        v_participacao.id,
        l.id,
        case
          when l.ordem = (
            select min(l2.ordem)
            from public.links l2
            where l2.atividade_id = v_atividade.id
          ) then 'aberta'
          else 'bloqueada'
        end
      from public.links l
      where l.atividade_id = v_atividade.id;
    end if;
  end if;

  return jsonb_build_object(
    'estudante_id', v_estudante.id,
    'participacao_id', v_participacao.id,
    'aplicacao_id', v_aplicacao.id,
    'atividade_id', v_atividade.id
  );
end;
$$;

-- ============================================================
-- Continuar atividade: conexão expirada não bloqueia mais o nome.
-- ============================================================
create or replace function public.continue_activity(
  p_codigo text,
  p_participacao_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_aplicacao public.aplicacoes;
  v_atividade public.atividades;
  v_estudante public.estudantes;
  v_participacao public.participacoes;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'TRL01';
  end if;

  if exists (select 1 from public.professores where user_id = v_uid) then
    raise exception 'teacher_cannot_join_as_student' using errcode = 'TRL05';
  end if;

  select *
  into v_aplicacao
  from public.aplicacoes
  where codigo = upper(trim(p_codigo));

  if not found then
    raise exception 'invalid_activity_code' using errcode = 'TRL06';
  end if;

  select * into v_atividade
  from public.atividades
  where id = v_aplicacao.atividade_id;

  if not found or v_atividade.deleted_at is not null then
    raise exception 'invalid_activity_code' using errcode = 'TRL06';
  end if;

  if v_atividade.status <> 'publicada' then
    raise exception 'activity_not_published' using errcode = 'TRL07';
  end if;

  if v_aplicacao.status <> 'aberta' then
    raise exception 'application_closed' using errcode = 'TRL08';
  end if;

  select *
  into v_participacao
  from public.participacoes
  where id = p_participacao_id
    and aplicacao_id = v_aplicacao.id
    and expulso_em is null;

  if not found then
    raise exception 'participation_not_found' using errcode = 'TRL27';
  end if;

  select * into v_estudante
  from public.estudantes
  where user_id = v_uid;

  if not found then
    insert into public.estudantes (user_id, nome)
    values (v_uid, v_participacao.nome)
    returning * into v_estudante;
  else
    update public.estudantes
    set nome = v_participacao.nome
    where id = v_estudante.id
    returning * into v_estudante;
  end if;

  -- Só um batimento fresco bloqueia o nome. Uma conexão abandonada (aba
  -- fechada, celular desligado) já está livre e pode ser assumida por outro.
  if private.conexao_ativa(
       v_participacao.conexao_estudante_id,
       v_participacao.conexao_em,
       v_participacao.desconexao_agendada_em
     )
     and v_participacao.conexao_estudante_id <> v_estudante.id then
    raise exception 'participation_in_use' using errcode = 'TRL33';
  end if;

  -- Uma conexão por aluno/entrada. Antes de assumir o nome escolhido, solta
  -- qualquer outra participação deste aluno na mesma entrada.
  update public.participacoes
  set conexao_estudante_id = null,
      conexao_em = null,
      desconexao_agendada_em = null
  where aplicacao_id = v_aplicacao.id
    and conexao_estudante_id = v_estudante.id
    and id <> v_participacao.id;

  update public.participacoes
  set conexao_estudante_id = v_estudante.id,
      conexao_em = now(),
      desconexao_agendada_em = null
  where id = v_participacao.id;

  return jsonb_build_object(
    'participacao_id', v_participacao.id,
    'aplicacao_id', v_aplicacao.id,
    'atividade_id', v_atividade.id
  );
end;
$$;

-- ============================================================
-- Batimento da tela do aluno: renova a conexão sem tocar no progresso.
-- ============================================================
create or replace function public.touch_participation(p_aplicacao_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estudante_id bigint := (select private.current_estudante_id());
begin
  if v_estudante_id is null then
    raise exception 'not_a_student' using errcode = 'TRL03';
  end if;

  update public.participacoes
  set conexao_em = now(),
      desconexao_agendada_em = null
  where aplicacao_id = p_aplicacao_id
    and conexao_estudante_id = v_estudante_id
    and expulso_em is null;

  -- false quer dizer que esta sessão não está mais conectada (o professor
  -- derrubou, outro aluno assumiu o nome ou a participação foi expulsa).
  return found;
end;
$$;

-- ============================================================
-- Aviso de saída da aba (pagehide): agenda a liberação do nome.
-- ============================================================
create or replace function public.agendar_desconexao(p_aplicacao_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estudante_id bigint := (select private.current_estudante_id());
begin
  if v_estudante_id is null then
    raise exception 'not_a_student' using errcode = 'TRL03';
  end if;

  -- A carência cobre recarregar a página e o bfcache: a tela que volta dá um
  -- novo batimento e cancela o agendamento.
  update public.participacoes
  set desconexao_agendada_em = now() + interval '15 seconds'
  where aplicacao_id = p_aplicacao_id
    and conexao_estudante_id = v_estudante_id
    and expulso_em is null;
end;
$$;

-- ============================================================
-- Derrubar: limpa a conexão e o batimento.
-- ============================================================
create or replace function public.release_participation(p_participacao_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if not exists (
    select 1
    from public.participacoes p
    join public.aplicacoes ap on ap.id = p.aplicacao_id
    join public.atividades a on a.id = ap.atividade_id
    where p.id = p_participacao_id
      and a.deleted_at is null
      and private.professor_acessa_atividade(a.id)
  ) then
    raise exception 'participation_not_found' using errcode = 'TRL27';
  end if;

  update public.participacoes
  set conexao_estudante_id = null,
      conexao_em = null,
      desconexao_agendada_em = null
  where id = p_participacao_id;
end;
$$;

revoke all on function public.touch_participation(bigint) from public, anon;
grant execute on function public.touch_participation(bigint) to authenticated;

revoke all on function public.agendar_desconexao(bigint) from public, anon;
grant execute on function public.agendar_desconexao(bigint) to authenticated;
