-- Editar o nome do aluno.
--
-- O aluno corrige o próprio nome pela conexão ativa (sem tocar em progresso,
-- notas ou conexão); o professor corrige pela aba Alunos, inclusive quando a
-- atividade está numa pasta compartilhada com ele. Nome repetido é permitido,
-- como no `join_activity`; a grade separa os homônimos pela hora de entrada.
create or replace function public.rename_my_participation(
  p_aplicacao_id bigint,
  p_nome text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estudante_id bigint := (select private.current_estudante_id());
  v_nome text := nullif(btrim(p_nome), '');
begin
  if v_estudante_id is null then
    raise exception 'not_a_student' using errcode = 'TRL03';
  end if;

  if v_nome is null then
    raise exception 'name_required' using errcode = 'TRL04';
  end if;

  if char_length(v_nome) > 40 then
    raise exception 'name_too_long' using errcode = 'TRL34';
  end if;

  update public.participacoes
  set nome = v_nome
  where aplicacao_id = p_aplicacao_id
    and conexao_estudante_id = v_estudante_id
    and expulso_em is null;

  if not found then
    raise exception 'participation_not_found' using errcode = 'TRL27';
  end if;

  -- `estudantes.nome` é o "último nome usado" pelo usuário (o `continue_activity`
  -- também o atualiza ao assumir um nome). Mantém os dois coerentes.
  update public.estudantes
  set nome = v_nome
  where id = v_estudante_id;
end;
$$;

create or replace function public.set_student_name(
  p_participacao_id bigint,
  p_nome text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professor_id bigint := (select private.current_professor_id());
  v_nome text := nullif(btrim(p_nome), '');
  v_atividade_id bigint;
begin
  if v_professor_id is null then
    raise exception 'not_a_professor' using errcode = 'TRL02';
  end if;

  if v_nome is null then
    raise exception 'name_required' using errcode = 'TRL04';
  end if;

  if char_length(v_nome) > 40 then
    raise exception 'name_too_long' using errcode = 'TRL34';
  end if;

  select ap.atividade_id
  into v_atividade_id
  from public.participacoes p
  join public.aplicacoes ap on ap.id = p.aplicacao_id
  where p.id = p_participacao_id;

  if not found or not private.professor_acessa_atividade(v_atividade_id) then
    raise exception 'participation_not_found' using errcode = 'TRL27';
  end if;

  update public.participacoes
  set nome = v_nome
  where id = p_participacao_id;
end;
$$;

revoke all on function public.rename_my_participation(bigint, text) from public, anon;
revoke all on function public.set_student_name(bigint, text) from public, anon;

grant execute on function public.rename_my_participation(bigint, text) to authenticated;
grant execute on function public.set_student_name(bigint, text) to authenticated;
