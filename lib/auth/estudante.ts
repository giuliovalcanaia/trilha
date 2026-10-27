import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type SessaoEstudante = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  estudante: { id: number; nome: string }
}

/** Sessão do aluno anônimo, ou `null` quando não há sessão/registro. */
export const getEstudante = cache(async (): Promise<SessaoEstudante | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (!userId) return null

  const { data: estudante, error } = await supabase
    .from("estudantes")
    .select("id, nome")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error("estudante_lookup_failed")

  if (!estudante) return null

  return { supabase, userId, estudante }
})

/**
 * Entrada e participação do aluno logado na atividade do código informado.
 * Retorna `null` quando o código não existe ou o aluno ainda não entrou;
 * a participação expulsa continua sendo devolvida para a página decidir.
 */
export const getParticipacaoDoAluno = cache(async (codigo: string) => {
  const aluno = await getEstudante()
  if (!aluno) return null

  const { supabase, estudante } = aluno

  const { data: aplicacao, error: aplicacaoError } = await supabase
    .from("aplicacoes")
    .select("id, atividade_id, status, data")
    .eq("codigo", codigo)
    .maybeSingle()

  if (aplicacaoError) throw new Error("aplicacao_lookup_failed")

  if (!aplicacao) return null

  const { data: participacao, error: participacaoError } = await supabase
    .from("participacoes")
    .select("id, nome, iniciado_em, concluido_em, expulso_em")
    .eq("aplicacao_id", aplicacao.id)
    .eq("estudante_id", estudante.id)
    .maybeSingle()

  if (participacaoError) throw new Error("participacao_lookup_failed")

  if (!participacao) return null

  return { supabase, estudante, aplicacao, participacao }
})
