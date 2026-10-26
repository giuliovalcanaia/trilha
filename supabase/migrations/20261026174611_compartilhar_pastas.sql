-- Compartilhamento de pastas com outros professores.
--
-- O dono da pasta pode compartilhá-la com um ou mais professores; o acesso
-- vale para a pasta inteira, subpastas e atividades. Quem recebe o acesso é
-- editor: pode criar, editar, mover, excluir e restaurar o conteúdo. Só o dono
-- da pasta pode compartilhar/descompartilhar, e a pasta compartilhada em si
-- (a raiz do compartilhamento) não pode ser movida nem excluída por quem
-- recebeu o acesso.
--
-- A ordem canônica continua em `links.ordem`/`pastas.parent_id`; o
-- compartilhamento só amplia quem enxerga e edita essas linhas.

-- A pasta pode ficar dentro de uma pasta de outro professor (subpasta criada
-- por um colaborador). A FK antiga exigia o mesmo professor no pai.
alter table public.pastas
  drop constraint if exists pastas_parent_same_professor_fk;

-- Preserva o cascade de exclusão da árvore sem exigir o mesmo dono.
alter table public.pastas
  add constraint pastas_parent_id_fkey
  foreign key (parent_id) references public.pastas(id) on delete cascade;

create table public.pasta_compartilhamentos (
  pasta_id bigint not null references public.pastas(id) on delete cascade,
  professor_id bigint not null references public.professores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pasta_id, professor_id)
);

create index pasta_compartilhamentos_professor_id_idx
  on public.pasta_compartilhamentos (professor_id);

alter table public.pasta_compartilhamentos enable row level security;

-- Sem policies: o acesso é feito apenas pelas funções security definer abaixo.

-- ---------- Helpers de acesso ----------

create or replace function private.professor_owns_pasta(p_pasta_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pastas p
    where p.id = p_pasta_id
      and p.professor_id = (select private.current_professor_id())
  )
$$;

-- Dono da própria pasta ou de qualquer ancestral dela. Usado para proteger a
-- raiz do compartilhamento (quem é dono da árvore pode mexer na raiz).
create or replace function private.professor_owns_arvore(p_pasta_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive cadeia as (
    select p.id, p.parent_id, p.professor_id
    from public.pastas p
    where p.id = p_pasta_id
    union
    select p.id, p.parent_id, p.professor_id
    from public.pastas p
    join cadeia c on p.id = c.parent_id
  )
  select exists (
    select 1
    from cadeia c
    where c.professor_id = (select private.current_professor_id())
  )
$$;

-- Dono da própria pasta, dono de um ancestral ou alguém com acesso
-- compartilhado em qualquer ponto da cadeia.
create or replace function private.professor_acessa_pasta(p_pasta_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive cadeia as (
    select p.id, p.parent_id, p.professor_id
    from public.pastas p
    where p.id = p_pasta_id
    union
    select p.id, p.parent_id, p.professor_id
    from public.pastas p
    join cadeia c on p.id = c.parent_id
  )
  select
    exists (
      select 1
      from cadeia c
      where c.professor_id = (select private.current_professor_id())
    )
    or exists (
      select 1
      from cadeia c
      join public.pasta_compartilhamentos pc on pc.pasta_id = c.id
      where pc.professor_id = (select private.current_professor_id())
    )
$$;

create or replace function private.professor_acessa_atividade(p_atividade_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.atividades a
    where a.id = p_atividade_id
      and (
        a.professor_id = (select private.current_professor_id())
        or (
          a.pasta_id is not null
          and private.professor_acessa_pasta(a.pasta_id)
        )
      )
  )
$$;

create or replace function private.professor_tem_compartilhamento(p_pasta_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pasta_compartilhamentos pc
    where pc.pasta_id = p_pasta_id
      and pc.professor_id = (select private.current_professor_id())
  )
$$;

-- As policies antigas passam a usar o acesso (dono ou compartilhamento).
-- Os nomes "owns" são mantidos para não reescrever todas as policies, mas
-- significam "pode acessar" a partir desta migration.
create or replace function private.professor_owns_atividade(p_atividade_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.professor_acessa_atividade(p_atividade_id)
$$;

create or replace function private.professor_owns_aplicacao(p_aplicacao_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.aplicacoes ap
    where ap.id = p_aplicacao_id
      and private.professor_acessa_atividade(ap.atividade_id)
  )
$$;

create or replace function private.professor_owns_participacao(p_participacao_id bigint)
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
    where p.id = p_participacao_id
      and private.professor_acessa_atividade(ap.atividade_id)
  )
$$;

create or replace function private.professor_owns_link(p_link_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.links l
    where l.id = p_link_id
      and private.professor_acessa_atividade(l.atividade_id)
  )
$$;

create or replace function private.professor_owns_progresso_link(
  p_participacao_id bigint,
  p_link_id bigint
)
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
    join public.links l on l.atividade_id = ap.atividade_id
    where p.id = p_participacao_id
      and l.id = p_link_id
      and private.professor_acessa_atividade(ap.atividade_id)
  )
$$;

revoke all on function private.professor_owns_pasta(bigint) from public, anon;
revoke all on function private.professor_owns_arvore(bigint) from public, anon;
revoke all on function private.professor_acessa_pasta(bigint) from public, anon;
revoke all on function private.professor_acessa_atividade(bigint) from public, anon;
revoke all on function private.professor_tem_compartilhamento(bigint) from public, anon;

grant execute on function private.professor_owns_pasta(bigint) to authenticated;
grant execute on function private.professor_owns_arvore(bigint) to authenticated;
grant execute on function private.professor_acessa_pasta(bigint) to authenticated;
grant execute on function private.professor_acessa_atividade(bigint) to authenticated;
grant execute on function private.professor_tem_compartilhamento(bigint) to authenticated;

-- ---------- Policies de pastas e atividades ----------

drop policy if exists pastas_teacher_all on public.pastas;

create policy pastas_teacher_select
on public.pastas
for select
to authenticated
using (
  professor_id = (select private.current_professor_id())
  or (select private.professor_acessa_pasta(pastas.id))
);

create policy pastas_teacher_insert
on public.pastas
for insert
to authenticated
with check (
  professor_id = (select private.current_professor_id())
  and (
    parent_id is null
    or (select private.professor_acessa_pasta(pastas.parent_id))
  )
);

create policy pastas_teacher_update
on public.pastas
for update
to authenticated
using (
  professor_id = (select private.current_professor_id())
  or (select private.professor_acessa_pasta(pastas.id))
)
with check (
  professor_id = (select private.current_professor_id())
  or (select private.professor_acessa_pasta(pastas.id))
);

create policy pastas_teacher_delete
on public.pastas
for delete
to authenticated
using ((select private.professor_owns_arvore(pastas.id)));

drop policy if exists atividades_teacher_all on public.atividades;

create policy atividades_teacher_select
on public.atividades
for select
to authenticated
using (
  professor_id = (select private.current_professor_id())
  or (
    pasta_id is not null
    and (select private.professor_acessa_pasta(atividades.pasta_id))
  )
);

create policy atividades_teacher_insert
on public.atividades
for insert
to authenticated
with check (
  professor_id = (select private.current_professor_id())
  and (
    pasta_id is null
    or (select private.professor_acessa_pasta(atividades.pasta_id))
  )
);

create policy atividades_teacher_update
on public.atividades
for update
to authenticated
using (
  professor_id = (select private.current_professor_id())
  or (
    pasta_id is not null
    and (select private.professor_acessa_pasta(atividades.pasta_id))
  )
)
with check (
  professor_id = (select private.current_professor_id())
  or (
    pasta_id is not null
    and (select private.professor_acessa_pasta(atividades.pasta_id))
  )
);

-- Exclusão definitiva direta: o criador ou o dono da árvore. O fluxo normal
-- do app usa a lixeira (RPCs security definer).
create policy atividades_teacher_delete
on public.atividades
for delete
to authenticated
using (
  professor_id = (select private.current_professor_id())
  or (
    pasta_id is not null
    and (select private.professor_owns_arvore(atividades.pasta_id))
  )
);

drop policy if exists atividade_senhas_teacher_select on public.atividade_senhas;

create policy atividade_senhas_teacher_select
on public.atividade_senhas
for select
to authenticated
using ((select private.professor_acessa_atividade(atividade_senhas.atividade_id)));

-- ---------- Triggers de integridade ----------

-- Impede trocar o dono e mover a raiz de um compartilhamento. Também garante
-- que o destino de uma pasta esteja ativo e acessível.
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
      raise exception 'owner_immutable' using errcode = '42501';
    end if;

    if v_professor_id is not null
      and new.deleted_at is not null
      and old.deleted_at is null
      and not private.professor_owns_arvore(old.id)
      and private.professor_tem_compartilhamento(old.id)
    then
      raise exception 'shared_folder_root' using errcode = '42501';
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
        raise exception 'shared_folder_root' using errcode = '42501';
      end if;

      if new.parent_id is not null and not exists (
        select 1
        from public.pastas p
        where p.id = new.parent_id
          and p.deleted_at is null
          and private.professor_acessa_pasta(p.id)
      ) then
        raise exception 'folder_not_found' using errcode = 'P0002';
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
      raise exception 'folder_not_found' using errcode = 'P0002';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.pastas_guard() from public, anon, authenticated;

drop trigger if exists pastas_guard on public.pastas;
create trigger pastas_guard
before insert or update on public.pastas
for each row execute function private.pastas_guard();

-- Impede trocar o dono da atividade e criar/mover para uma pasta que não
-- esteja ativa e acessível.
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
    raise exception 'owner_immutable' using errcode = '42501';
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
        raise exception 'folder_not_found' using errcode = 'P0002';
      end if;
    elsif new.pasta_id is distinct from old.pasta_id then
      if not exists (
        select 1
        from public.pastas p
        where p.id = new.pasta_id
          and p.deleted_at is null
          and private.professor_acessa_pasta(p.id)
      ) then
        raise exception 'folder_not_found' using errcode = 'P0002';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.atividades_guard() from public, anon, authenticated;

drop trigger if exists atividades_guard on public.atividades;
create trigger atividades_guard
before insert or update on public.atividades
for each row execute function private.atividades_guard();

-- ---------- Compartilhamento (RPCs) ----------

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
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  select p.professor_id, dono.nome, u.email
  into v_dono_id, v_dono_nome, v_dono_email
  from public.pastas p
  join public.professores dono on dono.id = p.professor_id
  left join auth.users u on u.id = dono.user_id
  where p.id = p_pasta_id
    and p.deleted_at is null;

  if v_dono_id is null or not private.professor_acessa_pasta(p_pasta_id) then
    raise exception 'folder_not_found' using errcode = 'P0002';
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

revoke all on function public.get_pasta_compartilhamento(bigint)
  from public, anon;
grant execute on function public.get_pasta_compartilhamento(bigint)
  to authenticated;

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
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.pastas p
    where p.id = p_pasta_id
      and p.professor_id = v_professor_id
      and p.deleted_at is null
  ) then
    raise exception 'folder_not_found' using errcode = 'P0002';
  end if;

  select p.id
  into v_alvo_id
  from public.professores p
  join auth.users u on u.id = p.user_id
  where lower(u.email) = lower(trim(p_email));

  if v_alvo_id is null then
    raise exception 'professor_not_found' using errcode = 'P0002';
  end if;

  if v_alvo_id = v_professor_id then
    raise exception 'cannot_share_with_self' using errcode = '22023';
  end if;

  insert into public.pasta_compartilhamentos (pasta_id, professor_id)
  values (p_pasta_id, v_alvo_id)
  on conflict (pasta_id, professor_id) do nothing;
end;
$$;

revoke all on function public.share_folder(bigint, text) from public, anon;
grant execute on function public.share_folder(bigint, text) to authenticated;

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
    raise exception 'not_a_professor' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.pastas p
    where p.id = p_pasta_id
      and p.professor_id = v_professor_id
      and p.deleted_at is null
  ) then
    raise exception 'folder_not_found' using errcode = 'P0002';
  end if;

  delete from public.pasta_compartilhamentos
  where pasta_id = p_pasta_id
    and professor_id = p_professor_id;
end;
$$;

revoke all on function public.unshare_folder(bigint, bigint)
  from public, anon;
grant execute on function public.unshare_folder(bigint, bigint)
  to authenticated;
