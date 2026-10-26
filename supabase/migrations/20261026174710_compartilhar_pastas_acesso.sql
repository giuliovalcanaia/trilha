-- RPCs de conteúdo passam a validar acesso (dono ou compartilhamento), não
-- apenas a posse. A ordem canônica e as regras de negócio continuam iguais.
-- A raiz do compartilhamento continua protegida para quem recebeu o acesso.

-- ---------- Lixeira ----------

create or replace function public.trash_pasta(p_pasta_id bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_trash_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_folder_ids bigint[] := '{}';
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.pastas
    where id = p_pasta_id
      and deleted_at is null
      and private.professor_acessa_pasta(id)
  ) then
    raise exception 'folder_not_found' using errcode = 'P0002';
  end if;

  if not private.professor_owns_arvore(p_pasta_id)
    and private.professor_tem_compartilhamento(p_pasta_id)
  then
    raise exception 'shared_folder_root' using errcode = '42501';
  end if;

  with recursive subtree as (
    select p.id
    from public.pastas p
    where p.id = p_pasta_id
      and p.deleted_at is null
    union
    select child.id
    from public.pastas child
    join subtree parent on parent.id = child.parent_id
    where child.deleted_at is null
  )
  select coalesce(array_agg(id), '{}'::bigint[])
  into v_folder_ids
  from subtree;

  update public.pastas
  set deleted_at = v_now,
      trash_id = v_trash_id
  where id = any(v_folder_ids);

  update public.atividades
  set deleted_at = v_now,
      trash_id = v_trash_id
  where deleted_at is null
    and pasta_id = any(v_folder_ids);

  return v_trash_id;
end;
$$;

create or replace function public.trash_atividade(p_atividade_id bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_trash_id uuid := gen_random_uuid();
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = p_atividade_id
      and deleted_at is null
      and private.professor_acessa_atividade(id)
  ) then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  update public.atividades
  set deleted_at = now(),
      trash_id = v_trash_id
  where id = p_atividade_id;

  return v_trash_id;
end;
$$;

create or replace function public.trash_items(
  p_pastas bigint[] default '{}',
  p_atividades bigint[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_trash_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_folder_ids bigint[] := '{}';
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_pastas, '{}'::bigint[])) as item(id)
    where not exists (
      select 1
      from public.pastas p
      where p.id = item.id
        and p.deleted_at is null
        and private.professor_acessa_pasta(p.id)
    )
  ) then
    raise exception 'folder_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_pastas, '{}'::bigint[])) as item(id)
    join public.pastas p on p.id = item.id
    where not private.professor_owns_arvore(p.id)
      and private.professor_tem_compartilhamento(p.id)
  ) then
    raise exception 'shared_folder_root' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_atividades, '{}'::bigint[])) as item(id)
    where not exists (
      select 1
      from public.atividades a
      where a.id = item.id
        and a.deleted_at is null
        and private.professor_acessa_atividade(a.id)
    )
  ) then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  with recursive subtree as (
    select p.id
    from public.pastas p
    where p.id = any(coalesce(p_pastas, '{}'::bigint[]))
      and p.deleted_at is null
    union
    select child.id
    from public.pastas child
    join subtree parent on parent.id = child.parent_id
    where child.deleted_at is null
  )
  select coalesce(array_agg(id), '{}'::bigint[])
  into v_folder_ids
  from subtree;

  update public.pastas
  set deleted_at = v_now,
      trash_id = v_trash_id
  where id = any(v_folder_ids);

  update public.atividades
  set deleted_at = v_now,
      trash_id = v_trash_id
  where deleted_at is null
    and (
      pasta_id = any(v_folder_ids)
      or id = any(coalesce(p_atividades, '{}'::bigint[]))
    );

  return v_trash_id;
end;
$$;

create or replace function public.restore_trash(p_trash_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.pastas where trash_id = p_trash_id
  ) and not exists (
    select 1 from public.atividades where trash_id = p_trash_id
  ) then
    raise exception 'trash_item_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.pastas p
    where p.trash_id = p_trash_id
      and not private.professor_acessa_pasta(p.id)
  ) or exists (
    select 1
    from public.atividades a
    where a.trash_id = p_trash_id
      and not private.professor_acessa_atividade(a.id)
  ) then
    raise exception 'trash_item_not_found' using errcode = 'P0002';
  end if;

  update public.pastas p
  set deleted_at = null,
      trash_id = null,
      parent_id = case
        when p.parent_id is null then null
        when exists (
          select 1 from public.pastas parent
          where parent.id = p.parent_id
            and parent.trash_id = p_trash_id
        ) then p.parent_id
        when exists (
          select 1 from public.pastas parent
          where parent.id = p.parent_id
            and parent.deleted_at is null
        ) then p.parent_id
        else null
      end
  where p.trash_id = p_trash_id;

  update public.atividades a
  set deleted_at = null,
      trash_id = null,
      pasta_id = case
        when a.pasta_id is null then null
        when exists (
          select 1 from public.pastas p
          where p.id = a.pasta_id
            and p.deleted_at is null
        ) then a.pasta_id
        else null
      end
  where a.trash_id = p_trash_id;
end;
$$;

create or replace function public.purge_trash(p_trash_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.pastas where trash_id = p_trash_id
  ) and not exists (
    select 1 from public.atividades where trash_id = p_trash_id
  ) then
    raise exception 'trash_item_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.pastas p
    where p.trash_id = p_trash_id
      and not private.professor_acessa_pasta(p.id)
  ) or exists (
    select 1
    from public.atividades a
    where a.trash_id = p_trash_id
      and not private.professor_acessa_atividade(a.id)
  ) then
    raise exception 'trash_item_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.pastas p
    where p.trash_id = p_trash_id
      and not private.professor_owns_arvore(p.id)
      and private.professor_tem_compartilhamento(p.id)
  ) then
    raise exception 'shared_folder_root' using errcode = '42501';
  end if;

  -- Atividades primeiro: leva junto links, turmas, nomes e progresso.
  delete from public.atividades
  where trash_id = p_trash_id;

  -- Subpastas ativas ou de outra leva não podem ser apagadas em cascata.
  update public.pastas child
  set parent_id = null
  where child.trash_id is distinct from p_trash_id
    and child.parent_id in (
      select p.id from public.pastas p
      where p.trash_id = p_trash_id
    );

  delete from public.pastas
  where trash_id = p_trash_id;
end;
$$;

-- Esvaziar remove o que pertence ao professor (e o conteúdo das árvores que
-- ele possui), sem apagar a raiz de um compartilhamento alheio. Itens
-- compartilhados de outros professores continuam na lixeira.
create or replace function public.empty_trash()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  delete from public.atividades a
  where a.deleted_at is not null
    and (
      a.professor_id = v_professor_id
      or (
        a.pasta_id is not null
        and private.professor_owns_arvore(a.pasta_id)
      )
    );

  update public.pastas child
  set parent_id = null
  where child.deleted_at is null
    and child.parent_id in (
      select p.id from public.pastas p
      where p.deleted_at is not null
        and private.professor_owns_arvore(p.id)
    );

  delete from public.pastas p
  where p.deleted_at is not null
    and private.professor_owns_arvore(p.id);
end;
$$;

-- ---------- Configurações e ordem ----------

create or replace function public.set_activity_password(
  p_atividade_id bigint,
  p_senha text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if nullif(trim(p_senha), '') is null then
    raise exception 'password_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = p_atividade_id
      and deleted_at is null
      and private.professor_acessa_atividade(id)
  ) then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  insert into public.atividade_senhas (atividade_id, senha_hash, senha_texto)
  values (
    p_atividade_id,
    extensions.crypt(trim(p_senha), extensions.gen_salt('bf')),
    trim(p_senha)
  )
  on conflict (atividade_id) do update
    set senha_hash = excluded.senha_hash,
        senha_texto = excluded.senha_texto,
        updated_at = now();
end;
$$;

create or replace function public.set_atividade_ativa(
  p_atividade_id bigint,
  p_ativa boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = p_atividade_id
      and deleted_at is null
      and private.professor_acessa_atividade(id)
  ) then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  update public.atividades
  set
    status = case when p_ativa then 'publicada' else 'rascunho' end,
    publicada_em = case when p_ativa then now() else null end
  where id = p_atividade_id
    and deleted_at is null;

  update public.aplicacoes
  set status = case when p_ativa then 'aberta' else 'encerrada' end
  where atividade_id = p_atividade_id;
end;
$$;

create or replace function public.move_link(p_link_id bigint, p_direcao integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_link public.links;
  v_other public.links;
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if p_direcao not in (-1, 1) then
    raise exception 'invalid_direction' using errcode = '22023';
  end if;

  select * into v_link from public.links where id = p_link_id;

  if not found then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;

  if not private.professor_acessa_atividade(v_link.atividade_id) then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  if p_direcao = -1 then
    select *
    into v_other
    from public.links
    where atividade_id = v_link.atividade_id
      and ordem < v_link.ordem
    order by ordem desc
    limit 1;
  else
    select *
    into v_other
    from public.links
    where atividade_id = v_link.atividade_id
      and ordem > v_link.ordem
    order by ordem asc
    limit 1;
  end if;

  if not found then
    return;
  end if;

  update public.links set ordem = -1 where id = v_link.id;
  update public.links set ordem = v_link.ordem where id = v_other.id;
  update public.links set ordem = v_other.ordem where id = v_link.id;
end;
$$;

create or replace function public.reorder_links(
  p_atividade_id bigint,
  p_link_ids bigint[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_total integer;
  v_validos integer;
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = p_atividade_id
      and deleted_at is null
      and private.professor_acessa_atividade(id)
  ) then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  select count(*)
  into v_total
  from public.links
  where atividade_id = p_atividade_id;

  select count(distinct l.id)
  into v_validos
  from public.links l
  join unnest(p_link_ids) as t(id) on t.id = l.id
  where l.atividade_id = p_atividade_id;

  if v_total = 0
    or v_total <> coalesce(array_length(p_link_ids, 1), 0)
    or v_validos <> v_total then
    raise exception 'invalid_link_set' using errcode = '22023';
  end if;

  update public.links
  set ordem = -id
  where atividade_id = p_atividade_id;

  update public.links l
  set ordem = t.ord
  from unnest(p_link_ids) with ordinality as t(id, ord)
  where l.id = t.id
    and l.atividade_id = p_atividade_id;
end;
$$;

-- ---------- Progresso e alunos ----------

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
    and a.deleted_at is null
    and private.professor_acessa_atividade(a.id);

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

create or replace function public.expel_student(p_participacao_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
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
    raise exception 'participation_not_found' using errcode = 'P0002';
  end if;

  update public.participacoes
  set expulso_em = coalesce(expulso_em, now())
  where id = p_participacao_id;

  delete from public.progresso_estudante
  where participacao_id = p_participacao_id;
end;
$$;

-- ---------- Duplicação ----------

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
    and deleted_at is null
    and private.professor_acessa_atividade(id);

  if not found then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  select case
    when v_source.pasta_id is null then null
    when exists (
      select 1 from public.pastas p
      where p.id = v_source.pasta_id
        and p.deleted_at is null
        and private.professor_acessa_pasta(p.id)
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

create or replace function public.duplicate_pasta(p_pasta_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_source public.pastas;
  v_new_root_id bigint;
  v_new_id bigint;
  v_inserted integer;
  v_row record;
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  select * into v_source
  from public.pastas
  where id = p_pasta_id
    and deleted_at is null
    and private.professor_acessa_pasta(id);

  if not found then
    raise exception 'folder_not_found' using errcode = 'P0002';
  end if;

  create temp table if not exists _pasta_map (
    old_id bigint primary key,
    new_id bigint not null
  ) on commit drop;

  truncate _pasta_map;

  insert into public.pastas (professor_id, parent_id, nome)
  values (
    v_professor_id,
    case
      when v_source.parent_id is null then null
      when exists (
        select 1 from public.pastas p
        where p.id = v_source.parent_id
          and p.deleted_at is null
          and private.professor_acessa_pasta(p.id)
      ) then v_source.parent_id
      else null
    end,
    v_source.nome || ' (cópia)'
  )
  returning id into v_new_root_id;

  insert into _pasta_map (old_id, new_id)
  values (p_pasta_id, v_new_root_id);

  loop
    v_inserted := 0;

    for v_row in
      select
        p.id,
        p.nome,
        m.new_id as new_parent_id
      from public.pastas p
      join _pasta_map m on m.old_id = p.parent_id
      where p.deleted_at is null
        and not exists (
          select 1 from _pasta_map x where x.old_id = p.id
        )
      order by p.id
    loop
      insert into public.pastas (professor_id, parent_id, nome)
      values (v_professor_id, v_row.new_parent_id, v_row.nome)
      returning id into v_new_id;

      insert into _pasta_map (old_id, new_id)
      values (v_row.id, v_new_id);

      v_inserted := v_inserted + 1;
    end loop;

    exit when v_inserted = 0;
  end loop;

  for v_row in
    select
      a.id,
      a.titulo,
      a.subtitulo,
      a.embaralhar_links,
      m.new_id as new_pasta_id
    from public.atividades a
    join _pasta_map m on m.old_id = a.pasta_id
    where a.deleted_at is null
  loop
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
      v_row.new_pasta_id,
      v_row.titulo || ' (cópia)',
      v_row.subtitulo,
      'publicada',
      now(),
      v_row.embaralhar_links
    )
    returning id into v_new_id;

    insert into public.links (atividade_id, ordem, titulo, descricao, href)
    select v_new_id, l.ordem, l.titulo, l.descricao, l.href
    from public.links l
    where l.atividade_id = v_row.id;

    insert into public.atividade_senhas (atividade_id, senha_hash, senha_texto)
    select v_new_id, s.senha_hash, s.senha_texto
    from public.atividade_senhas s
    where s.atividade_id = v_row.id;

    insert into public.aplicacoes (atividade_id, turma_id, codigo, data)
    values (
      v_new_id,
      null,
      private.generate_application_code(),
      (now() at time zone 'America/Sao_Paulo')::date
    );
  end loop;

  return v_new_root_id;
end;
$$;
