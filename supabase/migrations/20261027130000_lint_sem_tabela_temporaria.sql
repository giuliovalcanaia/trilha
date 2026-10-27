-- Deixa `supabase db lint` limpo (o job de CI roda com `--fail-on warning`).
--
-- 1. `duplicate_pasta` não usa mais tabela temporária: a relação
--    pasta-original → pasta-cópia fica em dois arrays. O `plpgsql_check` não
--    enxerga `_pasta_map` (tabela temporária criada dentro da própria função) e
--    acusava `relation "_pasta_map" does not exist`.
-- 2. `trash_pasta` e `trash_items` inicializam `v_folder_ids` com
--    `array[]::bigint[]` em vez de `'{}'` (o literal sem tipo gerava aviso de
--    conversão de `text` para `bigint[]`).
create or replace function public.duplicate_pasta(p_pasta_id bigint)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_source public.pastas;
  v_new_root_id bigint;
  v_new_id bigint;
  v_inseridos integer;
  v_row record;
  v_origem bigint[] := array[]::bigint[];
  v_copia bigint[] := array[]::bigint[];
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  select * into v_source
  from public.pastas
  where id = p_pasta_id
    and deleted_at is null
    and private.professor_acessa_pasta(id);

  if not found then
    raise exception 'folder_not_found' using errcode = 'TRL19';
  end if;

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

  v_origem := v_origem || p_pasta_id;
  v_copia := v_copia || v_new_root_id;

  loop
    v_inseridos := 0;

    for v_row in
      select
        p.id,
        p.nome,
        v_copia[array_position(v_origem, p.parent_id)] as new_parent_id
      from public.pastas p
      where p.deleted_at is null
        and p.parent_id = any (v_origem)
        and not (p.id = any (v_origem))
      order by p.id
    loop
      insert into public.pastas (professor_id, parent_id, nome)
      values (v_professor_id, v_row.new_parent_id, v_row.nome)
      returning id into v_new_id;

      v_origem := v_origem || v_row.id;
      v_copia := v_copia || v_new_id;
      v_inseridos := v_inseridos + 1;
    end loop;

    exit when v_inseridos = 0;
  end loop;

  for v_row in
    select
      a.id,
      a.titulo,
      a.subtitulo,
      a.embaralhar_links,
      v_copia[array_position(v_origem, a.pasta_id)] as new_pasta_id
    from public.atividades a
    where a.deleted_at is null
      and a.pasta_id = any (v_origem)
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
$function$;

CREATE OR REPLACE FUNCTION public.trash_items(p_pastas bigint[] DEFAULT '{}'::bigint[], p_atividades bigint[] DEFAULT '{}'::bigint[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_trash_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_folder_ids bigint[] := array[]::bigint[];
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = 'TRL02';
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
    raise exception 'folder_not_found' using errcode = 'TRL19';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_pastas, '{}'::bigint[])) as item(id)
    join public.pastas p on p.id = item.id
    where not private.professor_owns_arvore(p.id)
      and private.professor_tem_compartilhamento(p.id)
  ) then
    raise exception 'shared_folder_root' using errcode = 'TRL22';
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
    raise exception 'activity_not_found' using errcode = 'TRL20';
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
$function$
;
CREATE OR REPLACE FUNCTION public.trash_pasta(p_pasta_id bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_trash_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_folder_ids bigint[] := array[]::bigint[];
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if not exists (
    select 1
    from public.pastas
    where id = p_pasta_id
      and deleted_at is null
      and private.professor_acessa_pasta(id)
  ) then
    raise exception 'folder_not_found' using errcode = 'TRL19';
  end if;

  if not private.professor_owns_arvore(p_pasta_id)
    and private.professor_tem_compartilhamento(p_pasta_id)
  then
    raise exception 'shared_folder_root' using errcode = 'TRL22';
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
$function$
;
