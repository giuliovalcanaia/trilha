-- Expulsão de aluno pelo professor: a participação é marcada com
-- `expulso_em` (em vez de apagada), o progresso é removido e o aluno volta
-- para a tela de nome. A marca permite avisar o aluno mesmo depois de um
-- reload e, quando ele entra de novo, reaproveita a mesma linha com
-- progresso zerado.
alter table public.participacoes
  add column expulso_em timestamptz;

-- Aluno expulso deixa de enxergar a atividade e os links. A aplicação
-- continua visível de propósito: é por ela que a tela do aluno chega na
-- participação expulsa e consegue redirecionar com o aviso.
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
      and p.estudante_id = (select private.current_estudante_id())
  )
$$;

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
      and p.estudante_id = (select private.current_estudante_id())
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
      and p.estudante_id = (select private.current_estudante_id())
  )
$$;

revoke all on function private.estudante_participa_atividade(bigint) from public, anon;
revoke all on function private.estudante_participa_aplicacao(bigint) from public, anon;
revoke all on function private.estudante_owns_participacao(bigint) from public, anon;

grant execute on function private.estudante_participa_atividade(bigint) to authenticated;
grant execute on function private.estudante_participa_aplicacao(bigint) to authenticated;
grant execute on function private.estudante_owns_participacao(bigint) to authenticated;

-- Só o professor dono da atividade pode expulsar. O progresso é apagado para
-- o aluno recomeçar do zero se entrar de novo; a linha da participação fica
-- para o aviso e para bloquear o acesso enquanto expulso.
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
      and a.professor_id = v_professor_id
      and a.deleted_at is null
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

revoke all on function public.expel_student(bigint) from public, anon;
grant execute on function public.expel_student(bigint) to authenticated;

-- Reentrada depois da expulsão: limpa a marca, zera o progresso e recomeça a
-- contagem de início/fim. Sem expulsão, mantém o comportamento anterior.
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
  where l.atividade_id = v_atividade.id
  on conflict (participacao_id, link_id) do nothing;

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
