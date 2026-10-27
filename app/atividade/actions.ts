"use server"

import { revalidatePath } from "next/cache"

import { fail, type ActionResult } from "@/lib/actions/result"
import { falhaDeRpc } from "@/lib/actions/rpc-error"
import { SESSAO_EXPIRADA } from "@/lib/actions/with-professor"
import { getEstudante } from "@/lib/auth/estudante"

export async function markLinkAsStarted(
  aplicacaoId: number,
  linkId: number
): Promise<ActionResult> {
  const aluno = await getEstudante()

  if (!aluno) return fail(SESSAO_EXPIRADA, "sessao")

  const { error } = await aluno.supabase.rpc("update_my_progress", {
    p_aplicacao_id: aplicacaoId,
    p_link_id: linkId,
    p_status: "fazendo",
  })

  if (error) {
    return falhaDeRpc(error, "Não foi possível iniciar o link.")
  }

  revalidatePath("/atividade")
  return { error: null }
}

export async function completeLink(
  aplicacaoId: number,
  linkId: number,
  senha: string,
  pontuacao: number | null
): Promise<ActionResult> {
  const aluno = await getEstudante()

  if (!aluno) return fail(SESSAO_EXPIRADA, "sessao")

  const { error } = await aluno.supabase.rpc("complete_link", {
    p_aplicacao_id: aplicacaoId,
    p_link_id: linkId,
    p_senha: senha,
    p_pontuacao: pontuacao,
  })

  if (error) {
    return falhaDeRpc(error, "Não foi possível concluir o link.")
  }

  revalidatePath("/atividade")
  return { error: null }
}
