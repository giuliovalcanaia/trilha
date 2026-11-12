import type { SupabaseClient } from "@/lib/supabase/server"

export type AlunoParaContinuar = {
  participacao_id: number
  aluno_nome: string
  entrou_em: string
  em_uso: boolean
}

/**
 * Nomes já existentes na entrada do código, para a tela de continuar.
 *
 * O RPC é `security definer` e liberado para `anon`: a lista aparece antes de
 * o aluno anônimo existir. Qualquer pessoa com o código vê os nomes da turma;
 * é o mesmo segredo que já libera a entrada na atividade.
 */
export async function getAlunosParaContinuar(
  supabase: SupabaseClient,
  codigo: string
): Promise<AlunoParaContinuar[] | null> {
  const { data, error } = await supabase.rpc("list_activity_students", {
    p_codigo: codigo,
  })

  if (error) return null

  return data ?? []
}

/** Links e progresso do aluno na atividade, na ordem canônica dos links. */
export async function getLinksComProgresso(
  supabase: SupabaseClient,
  atividadeId: number,
  participacaoId: number
) {
  const [
    { data: links, error: linksError },
    { data: progresso, error: progressoError },
  ] = await Promise.all([
    supabase
      .from("links")
      .select("id, titulo, href, ordem")
      .eq("atividade_id", atividadeId)
      .order("ordem", { ascending: true }),
    supabase
      .from("progresso_estudante")
      .select("link_id, status, ordem_embaralhada")
      .eq("participacao_id", participacaoId),
  ])

  if (linksError || progressoError) {
    throw new Error("aluno_progresso_lookup_failed")
  }

  return { links: links ?? [], progresso: progresso ?? [] }
}
