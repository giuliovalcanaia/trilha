-- Erros tipados: cada erro de negócio ganha um SQLSTATE estável (TRLxx).
-- Os corpos das funções abaixo foram copiados da última definição de cada uma
-- e só tiveram o `errcode` trocado; a lógica e as mensagens não mudaram.
--
-- Mapa (ver lib/dominio/erros.ts):
--   TRL01 not_authenticated              TRL17 invalid_score
--   TRL02 not_a_professor                TRL18 invalid_status
--   TRL03 not_a_student                  TRL19 folder_not_found
--   TRL04 name_required                  TRL20 activity_not_found
--   TRL05 teacher_cannot_join_as_student TRL21 trash_item_not_found
--   TRL06 invalid_activity_code          TRL22 shared_folder_root
--   TRL07 activity_not_published         TRL23 owner_immutable
--   TRL08 application_closed             TRL24 professor_not_found
--   TRL09 (reservado)                   TRL25 cannot_share_with_self
--   TRL10 password_required              TRL26 invalid_email
--   TRL11 application_not_found          TRL27 participation_not_found
--   TRL12 not_in_application             TRL28 progress_not_found
--   TRL13 link_not_found                 TRL29 invalid_link_set
--   TRL14 link_locked                    TRL30 invalid_direction
--   TRL15 password_not_set               TRL31 code_generation_failed
--   TRL16 invalid_password
--
-- `create or replace` preserva os grants já existentes.

-- (origem: 20261026174611_compartilhar_pastas.sql)
create or replace function private.atividades_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
begin
  if tg_op = 'UPDATE'
    and new.professor_id is distinct from old.professor_id
  then
    raise exception 'owner_immutable' using errcode = 'TRL23';
  end if;

  if v_professor_id is not null and new.pasta_id is not null then
    if tg_op = 'INSERT' then
      if not exists (
        select 1
        from public.pastas p
        where p.id = new.pasta_id
          and p.deleted_at is null
          and private.professor_acessa_pasta(p.id)
      ) then
        raise exception 'folder_not_found' using errcode = 'TRL19';
      end if;
    elsif new.pasta_id is distinct from old.pasta_id then
      if not exists (
        select 1
        from public.pastas p
        where p.id = new.pasta_id
          and p.deleted_at is null
          and private.professor_acessa_pasta(p.id)
      ) then
        raise exception 'folder_not_found' using errcode = 'TRL19';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- (origem: 20261021151534_activity_single_entry.sql)
create or replace function private.generate_application_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
  v_tentativa integer := 0;
begin
  loop
    v_codigo := '';

    for i in 1..6 loop
      v_codigo := v_codigo
        || substr(
          v_alfabeto,
          1 + floor(random() * length(v_alfabeto))::integer,
          1
        );
    end loop;

    exit when not exists (
      select 1 from public.aplicacoes where codigo = v_codigo
    );

    v_tentativa := v_tentativa + 1;

    if v_tentativa >= 20 then
      raise exception 'code_generation_failed' using errcode = 'TRL31';
    end if;
  end loop;

  return v_codigo;
end;
$$;

-- (origem: 20261026174611_compartilhar_pastas.sql)
create or replace function private.pastas_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
begin
  if tg_op = 'UPDATE' then
    if new.professor_id is distinct from old.professor_id then
      raise exception 'owner_immutable' using errcode = 'TRL23';
    end if;

    if v_professor_id is not null
      and new.deleted_at is not null
      and old.deleted_at is null
      and not private.professor_owns_arvore(old.id)
      and private.professor_tem_compartilhamento(old.id)
    then
      raise exception 'shared_folder_root' using errcode = 'TRL22';
    end if;

    if v_professor_id is not null
      and new.parent_id is distinct from old.parent_id
    then
      if not private.professor_owns_arvore(old.id)
        and private.professor_tem_compartilhamento(old.id)
        and not (
          new.parent_id is null
          and old.parent_id is not null
          and exists (
            select 1
            from public.pastas p
            where p.id = old.parent_id
              and p.deleted_at is not null
          )
        )
      then
        raise exception 'shared_folder_root' using errcode = 'TRL22';
      end if;

      if new.parent_id is not null and not exists (
        select 1
        from public.pastas p
        where p.id = new.parent_id
          and p.deleted_at is null
          and private.professor_acessa_pasta(p.id)
      ) then
        raise exception 'folder_not_found' using errcode = 'TRL19';
      end if;
    end if;
  elsif tg_op = 'INSERT' then
    if v_professor_id is not null
      and new.parent_id is not null
      and not exists (
        select 1
        from public.pastas p
        where p.id = new.parent_id
          and p.deleted_at is null
          and private.professor_acessa_pasta(p.id)
      )
    then
      raise exception 'folder_not_found' using errcode = 'TRL19';
    end if;
  end if;

  return new;
end;
$$;

-- (origem: 20261026172342_embaralhar_links.sql)
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

  if extensions.crypt(trim(p_senha), v_senha_hash) <> v_senha_hash then
    raise exception 'invalid_password' using errcode = 'TRL16';
  end if;

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
    'link_id', p_link_id,
    'next_link_id', v_next_link_id
  );
end;
$$;

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  select * into v_source
  from public.atividades
  where id = p_atividade_id
    and deleted_at is null
    and private.professor_acessa_atividade(id);

  if not found then
    raise exception 'activity_not_found' using errcode = 'TRL20';
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
  set expulso_em = coalesce(expulso_em, now())
  where id = p_participacao_id;

  delete from public.progresso_estudante
  where participacao_id = p_participacao_id;
end;
$$;

-- (origem: 20261026174611_compartilhar_pastas.sql)
create or replace function public.get_pasta_compartilhamento(p_pasta_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_dono_id bigint;
  v_dono_nome text;
  v_dono_email text;
  v_compartilhamentos jsonb := '[]'::jsonb;
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  select p.professor_id, dono.nome, u.email
  into v_dono_id, v_dono_nome, v_dono_email
  from public.pastas p
  join public.professores dono on dono.id = p.professor_id
  left join auth.users u on u.id = dono.user_id
  where p.id = p_pasta_id
    and p.deleted_at is null;

  if v_dono_id is null or not private.professor_acessa_pasta(p_pasta_id) then
    raise exception 'folder_not_found' using errcode = 'TRL19';
  end if;

  if v_dono_id = v_professor_id then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'professor_id', p.id,
          'nome', p.nome,
          'email', u.email
        )
        order by p.nome
      ),
      '[]'::jsonb
    )
    into v_compartilhamentos
    from public.pasta_compartilhamentos pc
    join public.professores p on p.id = pc.professor_id
    left join auth.users u on u.id = p.user_id
    where pc.pasta_id = p_pasta_id;
  end if;

  return jsonb_build_object(
    'is_owner', v_dono_id = v_professor_id,
    'owner', jsonb_build_object('nome', v_dono_nome, 'email', v_dono_email),
    'compartilhamentos', v_compartilhamentos
  );
end;
$$;

-- (origem: 20261026172342_embaralhar_links.sql)
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if p_direcao not in (-1, 1) then
    raise exception 'invalid_direction' using errcode = 'TRL30';
  end if;

  select * into v_link from public.links where id = p_link_id;

  if not found then
    raise exception 'link_not_found' using errcode = 'TRL13';
  end if;

  if not private.professor_acessa_atividade(v_link.atividade_id) then
    raise exception 'activity_not_found' using errcode = 'TRL20';
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if not exists (
    select 1 from public.pastas where trash_id = p_trash_id
  ) and not exists (
    select 1 from public.atividades where trash_id = p_trash_id
  ) then
    raise exception 'trash_item_not_found' using errcode = 'TRL21';
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
    raise exception 'trash_item_not_found' using errcode = 'TRL21';
  end if;

  if exists (
    select 1
    from public.pastas p
    where p.trash_id = p_trash_id
      and not private.professor_owns_arvore(p.id)
      and private.professor_tem_compartilhamento(p.id)
  ) then
    raise exception 'shared_folder_root' using errcode = 'TRL22';
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = p_atividade_id
      and deleted_at is null
      and private.professor_acessa_atividade(id)
  ) then
    raise exception 'activity_not_found' using errcode = 'TRL20';
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
    raise exception 'invalid_link_set' using errcode = 'TRL29';
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if not exists (
    select 1 from public.pastas where trash_id = p_trash_id
  ) and not exists (
    select 1 from public.atividades where trash_id = p_trash_id
  ) then
    raise exception 'trash_item_not_found' using errcode = 'TRL21';
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
    raise exception 'trash_item_not_found' using errcode = 'TRL21';
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if nullif(trim(p_senha), '') is null then
    raise exception 'password_required' using errcode = 'TRL10';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = p_atividade_id
      and deleted_at is null
      and private.professor_acessa_atividade(id)
  ) then
    raise exception 'activity_not_found' using errcode = 'TRL20';
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = p_atividade_id
      and deleted_at is null
      and private.professor_acessa_atividade(id)
  ) then
    raise exception 'activity_not_found' using errcode = 'TRL20';
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

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if p_status not in ('aberta', 'fazendo', 'concluida', 'bloqueada') then
    raise exception 'invalid_status' using errcode = 'TRL18';
  end if;

  if p_pontuacao is not null and p_pontuacao < 0 then
    raise exception 'invalid_score' using errcode = 'TRL17';
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
    raise exception 'progress_not_found' using errcode = 'TRL28';
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

-- (origem: 20261026174611_compartilhar_pastas.sql)
create or replace function public.share_folder(p_pasta_id bigint, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_alvo_id bigint;
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'invalid_email' using errcode = 'TRL26';
  end if;

  if not exists (
    select 1
    from public.pastas p
    where p.id = p_pasta_id
      and p.professor_id = v_professor_id
      and p.deleted_at is null
  ) then
    raise exception 'folder_not_found' using errcode = 'TRL19';
  end if;

  select p.id
  into v_alvo_id
  from public.professores p
  join auth.users u on u.id = p.user_id
  where lower(u.email) = lower(trim(p_email));

  if v_alvo_id is null then
    raise exception 'professor_not_found' using errcode = 'TRL24';
  end if;

  if v_alvo_id = v_professor_id then
    raise exception 'cannot_share_with_self' using errcode = 'TRL25';
  end if;

  insert into public.pasta_compartilhamentos (pasta_id, professor_id)
  values (p_pasta_id, v_alvo_id)
  on conflict (pasta_id, professor_id) do nothing;
end;
$$;

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if not exists (
    select 1
    from public.atividades
    where id = p_atividade_id
      and deleted_at is null
      and private.professor_acessa_atividade(id)
  ) then
    raise exception 'activity_not_found' using errcode = 'TRL20';
  end if;

  update public.atividades
  set deleted_at = now(),
      trash_id = v_trash_id
  where id = p_atividade_id;

  return v_trash_id;
end;
$$;

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
$$;

-- (origem: 20261026174710_compartilhar_pastas_acesso.sql)
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
$$;

-- (origem: 20261026174611_compartilhar_pastas.sql)
create or replace function public.unshare_folder(
  p_pasta_id bigint,
  p_professor_id bigint
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
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if not exists (
    select 1
    from public.pastas p
    where p.id = p_pasta_id
      and p.professor_id = v_professor_id
      and p.deleted_at is null
  ) then
    raise exception 'folder_not_found' using errcode = 'TRL19';
  end if;

  delete from public.pasta_compartilhamentos
  where pasta_id = p_pasta_id
    and professor_id = p_professor_id;
end;
$$;

-- (origem: 20261020210000_explorer_trash_duplicate.sql)
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
    and estudante_id = v_estudante_id;

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

