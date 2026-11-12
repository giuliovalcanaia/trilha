-- Um nome conectado não pode ser assumido por outro aluno.
--
-- A troca anterior era “última conexão vence”. Na sala, isso deixava qualquer
-- aluno derrubar o colega escolhendo o nome dele. Agora só o professor libera
-- a conexão (`release_participation`); o aluno que já está conectado pode
-- repetir a operação, mas outro aluno recebe `TRL33`.
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

  if v_participacao.conexao_estudante_id is not null
     and v_participacao.conexao_estudante_id <> v_estudante.id then
    raise exception 'participation_in_use' using errcode = 'TRL33';
  end if;

  -- Uma conexão por aluno/entrada. Antes de assumir o nome escolhido, solta
  -- qualquer outra participação deste aluno na mesma entrada.
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
