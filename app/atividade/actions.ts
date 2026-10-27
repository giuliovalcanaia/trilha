"use server"

import { revalidatePath } from "next/cache"

import { getEstudante } from "@/lib/auth/estudante"

export async function markLinkAsStarted(aplicacaoId: number, linkId: number) {
  const aluno = await getEstudante()

  if (!aluno) {
    return { error: "not_authenticated" as const }
  }

  const { error } = await aluno.supabase.rpc("update_my_progress", {
    p_aplicacao_id: aplicacaoId,
    p_link_id: linkId,
    p_status: "fazendo",
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/atividade")
  return { error: null }
}

export async function completeLink(
  aplicacaoId: number,
  linkId: number,
  senha: string,
  pontuacao: number | null
) {
  const aluno = await getEstudante()

  if (!aluno) {
    return { error: "not_authenticated" as const }
  }

  const { error } = await aluno.supabase.rpc("complete_link", {
    p_aplicacao_id: aplicacaoId,
    p_link_id: linkId,
    p_senha: senha,
    p_pontuacao: pontuacao,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/atividade")
  return { error: null }
}
