"use server"

import { revalidatePath } from "next/cache"

import { fail, type ActionResult } from "@/lib/actions/result"
import { falhaDeRpc } from "@/lib/actions/rpc-error"
import { SESSAO_EXPIRADA } from "@/lib/actions/with-professor"
import { getEstudante } from "@/lib/auth/estudante"
import { mensagemDoErro } from "@/lib/dominio/erros"

/**
 * Resposta de `complete_link` quando a senha é recusada.
 *
 * Senha errada e bloqueio por tentativas voltam como payload em vez de exceção,
 * porque o contador de tentativas precisa sobreviver ao erro (uma exceção
 * desfaz a transação do RPC).
 */
type CompleteLinkPayload = {
  ok?: boolean
  error?: string
  tentativas_restantes?: number
}

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

  const { data, error } = await aluno.supabase.rpc("complete_link", {
    p_aplicacao_id: aplicacaoId,
    p_link_id: linkId,
    p_senha: senha,
    p_pontuacao: pontuacao,
  })

  if (error) {
    return falhaDeRpc(error, "Não foi possível concluir o link.")
  }

  const resultado = data as CompleteLinkPayload | null

  if (!resultado?.ok) {
    if (resultado?.error === "password_locked") {
      return fail(
        mensagemDoErro("TRL32") ?? "Aguarde um minuto e tente de novo.",
        "TRL32"
      )
    }

    if (resultado?.error === "invalid_password") {
      const base = mensagemDoErro("TRL16") ?? "Senha incorreta."
      const restantes = resultado.tentativas_restantes

      return fail(
        typeof restantes === "number" && restantes > 0
          ? `${base} Tentativas restantes: ${restantes}.`
          : base,
        "TRL16"
      )
    }

    return fail("Não foi possível concluir o link.", "inesperado")
  }

  revalidatePath("/atividade")
  return { error: null }
}
