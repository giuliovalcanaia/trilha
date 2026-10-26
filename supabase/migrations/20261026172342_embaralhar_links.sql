-- Embaralhamento por aluno: a ordem dos links passa a poder ser sorteada para
-- cada participação, sem mexer em `links.ordem` (a ordem canônica usada pela
-- aba Alunos, pela prévia e pelo editor).
--
-- `progresso_estudante.ordem_embaralhada` guarda a posição do link na
-- sequência daquele aluno. A opção vale para quem entra depois; quem já tem
-- progresso mantém a ordem atual.
alter table public.atividades
  add column embaralhar_links boolean not null default false;

alter table public.progresso_estudante
  add column ordem_embaralhada integer;

create unique index progresso_estudante_ordem_embaralhada_idx
  on public.progresso_estudante (participacao_id, ordem_embaralhada)
  where ordem_embaralhada is not null;

-- Nova entrada: sorteia a sequência quando a atividade está configurada para
-- embaralhar; caso contrário, mantém a sequência canônica. Reentradas não
-- mexem na ordem existente; links novos entram pelo trigger
-- `create_progress_for_new_link`.
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
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if nullif(trim(p_nome), '') is null then
    raise exception 'name_required' using errcode = '22023';
  end if;

  if exists (select 1 from public.professores where user_id = v_uid) then
    raise exception 'teacher_cannot_join_as_student' using errcode = '42501';
  end if;

  select *
  into v_aplicacao
  from public.aplicacoes
  where codigo = upper(trim(p_codigo));

  if not found then
    raise exception 'invalid_activity_code' using errcode = 'P0002';
  end if;

  select * into v_atividade
  from public.atividades
  where id = v_aplicacao.atividade_id;

  if not found or v_atividade.deleted_at is not null then
    raise exception 'invalid_activity_code' using errcode = 'P0002';
  end if;

  if v_atividade.status <> 'publicada' then
    raise exception 'activity_not_published' using errcode = 'P0001';
  end if;

  if v_aplicacao.status <> 'aberta' then
    raise exception 'application_closed' using errcode = 'P0001';
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

  insert into public.participacoes as p (aplicacao_id, estudante_id, nome)
  values (v_aplicacao.id, v_estudante.id, trim(p_nome))
  on conflict (aplicacao_id, estudante_id) do update
    set nome = excluded.nome,
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

revoke all on function public.join_activity(text, text) from public, anon;
grant execute on function public.join_activity(text, text) to authenticated;

-- Conclui o link e abre o próximo na sequência do aluno: pela posição
-- embaralhada quando existe, senão pela ordem canônica.
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
  v_ordem_embaralhada integer;
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

  select status, ordem_embaralhada
  into v_progresso_status, v_ordem_embaralhada
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
    'link_id', p_link_id,
    'next_link_id', v_next_link_id
  );
end;
$$;

revoke all on function public.complete_link(bigint, bigint, text, numeric)
  from public, anon;
grant execute on function public.complete_link(bigint, bigint, text, numeric)
  to authenticated;

-- Ajuste manual do professor: usa a sequência do aluno para abrir a próxima
-- etapa, mantendo a lista da aba Alunos na ordem canônica.
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
  v_ordem_embaralhada integer;
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

  select l.atividade_id, l.ordem, pe.ordem_embaralhada
  into v_atividade_id, v_link_ordem, v_ordem_embaralhada
  from public.links l
  join public.aplicacoes ap on ap.atividade_id = l.atividade_id
  join public.participacoes p on p.aplicacao_id = ap.id
  join public.atividades a on a.id = l.atividade_id
  left join public.progresso_estudante pe
    on pe.participacao_id = p.id
    and pe.link_id = l.id
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
    if v_ordem_embaralhada is not null then
      select pe.link_id
      into v_next_link_id
      from public.progresso_estudante pe
      where pe.participacao_id = p_participacao_id
        and pe.ordem_embaralhada > v_ordem_embaralhada
      order by pe.ordem_embaralhada asc
      limit 1;
    else
      select l.id
      into v_next_link_id
      from public.links l
      where l.atividade_id = v_atividade_id
        and l.ordem > v_link_ordem
      order by l.ordem asc
      limit 1;
    end if;

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

-- Links adicionados depois que os alunos entraram: o trigger que já existia
-- cria as linhas de progresso; agora ele também posiciona o link na sequência
-- de quem está embaralhado (no fim) e abre o primeiro link de quem entrou
-- quando a atividade ainda estava vazia.
create or replace function public.create_progress_for_new_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.progresso_estudante (
    participacao_id,
    link_id,
    status,
    ordem_embaralhada
  )
  select
    p.id,
    new.id,
    case
      when not exists (
        select 1
        from public.progresso_estudante pe
        where pe.participacao_id = p.id
      ) then 'aberta'
      else 'bloqueada'
    end,
    case
      when exists (
        select 1
        from public.progresso_estudante pe
        where pe.participacao_id = p.id
          and pe.ordem_embaralhada is not null
      ) then (
        select coalesce(max(pe.ordem_embaralhada), 0) + 1
        from public.progresso_estudante pe
        where pe.participacao_id = p.id
      )
      when a.embaralhar_links and not exists (
        select 1
        from public.progresso_estudante pe
        where pe.participacao_id = p.id
      ) then 1
      else null
    end
  from public.participacoes p
  join public.aplicacoes ap on ap.id = p.aplicacao_id
  join public.atividades a on a.id = ap.atividade_id
  where ap.atividade_id = new.atividade_id
    and p.expulso_em is null
  on conflict (participacao_id, link_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_progress_for_new_link()
  from public, anon, authenticated;
grant execute on function public.create_progress_for_new_link()
  to postgres, service_role;

-- A cópia também leva a opção de embaralhar.
create or replace function public.duplicate_atividade(p_atividade_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_source public.atividades;
  v_pasta_id bigint;
  v_new_id bigint;
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  select * into v_source
  from public.atividades
  where id = p_atividade_id
    and professor_id = v_professor_id
    and deleted_at is null;

  if not found then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  select case
    when v_source.pasta_id is null then null
    when exists (
      select 1 from public.pastas p
      where p.id = v_source.pasta_id
        and p.deleted_at is null
    ) then v_source.pasta_id
    else null
  end
  into v_pasta_id;

  insert into public.atividades (
    professor_id,
    pasta_id,
    titulo,
    subtitulo,
    status,
    publicada_em,
    embaralhar_links
  )
  values (
    v_professor_id,
    v_pasta_id,
    v_source.titulo || ' (cópia)',
    v_source.subtitulo,
    'publicada',
    now(),
    v_source.embaralhar_links
  )
  returning id into v_new_id;

  insert into public.links (atividade_id, ordem, titulo, descricao, href)
  select v_new_id, l.ordem, l.titulo, l.descricao, l.href
  from public.links l
  where l.atividade_id = v_source.id;

  insert into public.atividade_senhas (atividade_id, senha_hash, senha_texto)
  select v_new_id, s.senha_hash, s.senha_texto
  from public.atividade_senhas s
  where s.atividade_id = v_source.id;

  insert into public.aplicacoes (atividade_id, turma_id, codigo, data)
  values (
    v_new_id,
    null,
    private.generate_application_code(),
    (now() at time zone 'America/Sao_Paulo')::date
  );

  return v_new_id;
end;
$$;

revoke all on function public.duplicate_atividade(bigint) from public, anon;
grant execute on function public.duplicate_atividade(bigint) to authenticated;
