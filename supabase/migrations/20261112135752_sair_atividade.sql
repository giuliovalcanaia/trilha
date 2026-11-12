-- "Sair" da atividade: o aluno libera a própria conexão na hora.
--
-- Serve para quem entrou com o nome errado (ou quer trocar de nome sem fechar
-- a aba). O progresso do nome fica salvo — sair só solta a conexão, como o
-- beacon de 15s e o batimento vencido, mas sem esperar.
create or replace function public.leave_activity(p_aplicacao_id bigint)
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
  set conexao_estudante_id = null,
      conexao_em = null,
      desconexao_agendada_em = null
  where aplicacao_id = p_aplicacao_id
    and conexao_estudante_id = v_estudante_id;

  -- false quer dizer que esta sessão já não estava conectada (o professor
  -- derrubou, outro aluno assumiu o nome ou a participação foi expulsa).
  return found;
end;
$$;

revoke all on function public.leave_activity(bigint) from public, anon;
grant execute on function public.leave_activity(bigint) to authenticated;
