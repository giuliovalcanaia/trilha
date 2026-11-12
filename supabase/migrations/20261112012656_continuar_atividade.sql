-- Continuar atividade em outro dia.
--
-- `estudante_id` continua sendo o criador original da participação (e a base
-- da constraint única por entrada). `conexao_estudante_id` é o aluno anônimo
-- conectado agora: ele pode assumir uma participação existente pelo nome sem
-- que o progresso mude de dono. `null` significa desconectado (o professor
-- derrubou ou outra sessão assumiu o nome).

alter table public.participacoes
  add column conexao_estudante_id bigint
    references public.estudantes(id) on delete set null;

-- Sessões que já estavam abertas continuam funcionando após a migration.
update public.participacoes
set conexao_estudante_id = estudante_id
where conexao_estudante_id is null;

-- A página lê a própria participação com maybeSingle(); a conexão é única
-- por aluno/entrada, então a troca de nome não pode gerar duas linhas.
create unique index participacoes_conexao_unica
  on public.participacoes (aplicacao_id, conexao_estudante_id)
  where conexao_estudante_id is not null;

create index participacoes_conexao_estudante_id_idx
  on public.participacoes (conexao_estudante_id)
  where conexao_estudante_id is not null;

comment on column public.participacoes.conexao_estudante_id is
  'Aluno conectado agora; null quando a conexão foi derrubada ou assumida por outra sessão.';

-- ============================================================
-- Acesso do aluno passa a olhar para a conexão, não para o criador.
-- ============================================================
create or replace function private.estudante_participa_atividade(p_atividade_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participacoes p
    join public.aplicacoes ap on ap.id = p.aplicacao_id
    join public.atividades a on a.id = ap.atividade_id
    where ap.atividade_id = p_atividade_id
      and a.deleted_at is null
      and p.expulso_em is null
      and p.conexao_estudante_id = (select private.current_estudante_id())
  )
$$;

-- A aplicação continua visível para o aluno expulso de propósito: é por ela
-- que a tela chega na participação expulsa e mostra o aviso. Por isso esta
-- função não filtra `expulso_em` (diferente das outras duas).
create or replace function private.estudante_participa_aplicacao(p_aplicacao_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participacoes p
    join public.aplicacoes ap on ap.id = p.aplicacao_id
    join public.atividades a on a.id = ap.atividade_id
    where p.aplicacao_id = p_aplicacao_id
      and a.deleted_at is null
      and p.conexao_estudante_id = (select private.current_estudante_id())
  )
$$;

create or replace function private.estudante_owns_participacao(p_participacao_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participacoes p
    join public.aplicacoes ap on ap.id = p.aplicacao_id
    join public.atividades a on a.id = ap.atividade_id
    where p.id = p_participacao_id
      and a.deleted_at is null
      and p.expulso_em is null
      and p.conexao_estudante_id = (select private.current_estudante_id())
  )
$$;

revoke all on function private.estudante_participa_atividade(bigint) from public, anon;
revoke all on function private.estudante_participa_aplicacao(bigint) from public, anon;
revoke all on function private.estudante_owns_participacao(bigint) from public, anon;

grant execute on function private.estudante_participa_atividade(bigint) to authenticated;
grant execute on function private.estudante_participa_aplicacao(bigint) to authenticated;
grant execute on function private.estudante_owns_participacao(bigint) to authenticated;

drop policy if exists participacoes_student_select on public.participacoes;

create policy participacoes_student_select
on public.participacoes
for select
to authenticated
using (conexao_estudante_id = (select private.current_estudante_id()));

-- ============================================================
-- Entrada normal: cria/reativa a participação já conectada ao aluno.
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
  set conexao_estudante_id = null
  where aplicacao_id = v_aplicacao.id
    and conexao_estudante_id = v_estudante.id;

  insert into public.participacoes as p (
    aplicacao_id,
    estudante_id,
    nome,
    conexao_estudante_id
  )
  values (
    v_aplicacao.id,
    v_estudante.id,
    trim(p_nome),
    v_estudante.id
  )
  on conflict (aplicacao_id, estudante_id) do update
    set nome = excluded.nome,
        conexao_estudante_id = excluded.conexao_estudante_id,
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
-- Escritas do aluno: a participação é a da conexão atual.
-- ============================================================
create or replace function public.update_my_progress(
  p_aplicacao_id bigint,
  p_link_id bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estudante_id bigint := (select private.current_estudante_id());
  v_participacao_id bigint;
  v_progresso_status text;
begin
  if v_estudante_id is null then
    raise exception 'not_a_student' using errcode = 'TRL03';
  end if;

  if p_status <> 'fazendo' then
    raise exception 'invalid_status' using errcode = 'TRL18';
  end if;

  select id into v_participacao_id
  from public.participacoes
  where aplicacao_id = p_aplicacao_id
    and conexao_estudante_id = v_estudante_id
    and expulso_em is null;

  if v_participacao_id is null then
    raise exception 'not_in_application' using errcode = 'TRL12';
  end if;

  if not exists (
    select 1
    from public.links l
    join public.aplicacoes ap on ap.atividade_id = l.atividade_id
    join public.atividades a on a.id = ap.atividade_id
    where l.id = p_link_id
      and ap.id = p_aplicacao_id
      and a.deleted_at is null
  ) then
    raise exception 'link_not_found' using errcode = 'TRL13';
  end if;

  select status into v_progresso_status
  from public.progresso_estudante
  where participacao_id = v_participacao_id
    and link_id = p_link_id;

  if v_progresso_status is null or v_progresso_status not in ('aberta', 'fazendo') then
    raise exception 'link_locked' using errcode = 'TRL14';
  end if;

  update public.progresso_estudante
  set status = 'fazendo'
  where participacao_id = v_participacao_id
    and link_id = p_link_id;
end;
$$;

create or replace function public.complete_link(
  p_aplicacao_id bigint,
  p_link_id bigint,
  p_senha text,
  p_pontuacao numeric default null::numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
    and conexao_estudante_id = v_estudante_id
    and expulso_em is null;

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

-- ============================================================
-- Continuar atividade
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
    p.conexao_estudante_id is not null
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

  -- A última conexão vence. Antes de assumir o nome escolhido, solta qualquer
  -- outra participação deste aluno na mesma entrada.
  update public.participacoes
  set conexao_estudante_id = null
  where aplicacao_id = v_aplicacao.id
    and conexao_estudante_id = v_estudante.id
    and id <> v_participacao.id;

  update public.participacoes
  set conexao_estudante_id = v_estudante.id
  where id = v_participacao.id;

  return jsonb_build_object(
    'participacao_id', v_participacao.id,
    'aplicacao_id', v_aplicacao.id,
    'atividade_id', v_atividade.id
  );
end;
$$;

-- Derrubar a conexão de um aluno sem apagar o progresso. Quem pode ver a
-- atividade (dono ou colaborador da pasta) pode liberar a conexão.
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
  set conexao_estudante_id = null
  where id = p_participacao_id;
end;
$$;

revoke all on function public.list_activity_students(text) from public;
grant execute on function public.list_activity_students(text) to anon, authenticated;

revoke all on function public.continue_activity(text, bigint) from public, anon;
grant execute on function public.continue_activity(text, bigint) to authenticated;

revoke all on function public.release_participation(bigint) from public, anon;
grant execute on function public.release_participation(bigint) to authenticated;
