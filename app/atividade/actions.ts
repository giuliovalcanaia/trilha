"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { fail, type ActionResult } from "@/lib/actions/result"
import { falhaDeRpc } from "@/lib/actions/rpc-error"
import { SESSAO_EXPIRADA } from "@/lib/actions/with-professor"
import { getEstudante } from "@/lib/auth/estudante"
import { mensagemDoErro } from "@/lib/dominio/erros"
import { NOME_ALUNO_MAX } from "@/lib/dominio/limites"

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

/**
 * "Sair" da atividade: libera a conexão na hora (sem esperar o beacon de 15s)
 * e volta para a grade de nomes, para o aluno escolher outro nome. O
 * progresso do nome anterior fica salvo — sair não apaga nada.
 */
export async function sairDaAtividade(
  aplicacaoId: number,
  codigo: string
): Promise<ActionResult> {
  const aluno = await getEstudante()

  if (!aluno) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigo)}`)
  }

  const { error } = await aluno.supabase.rpc("leave_activity", {
    p_aplicacao_id: aplicacaoId,
  })

  if (error) {
    return falhaDeRpc(error, "Não foi possível sair da atividade.")
  }

  revalidatePath("/atividade")
  redirect(`/aluno/continuar?codigo=${encodeURIComponent(codigo)}`)
}

/**
 * Renomeia a participação conectada (o nome que aparece no título). Mantém a
 * conexão e o progresso: muda só o rótulo do aluno na lista.
 */
export async function renomearAluno(
  aplicacaoId: number,
  nome: string
): Promise<ActionResult> {
  const aluno = await getEstudante()

  if (!aluno) return fail(SESSAO_EXPIRADA, "sessao")

  const limpo = nome.trim()

  if (!limpo) {
    return fail(mensagemDoErro("TRL04") ?? "Informe o seu nome.", "TRL04")
  }

  if (limpo.length > NOME_ALUNO_MAX) {
    return fail(mensagemDoErro("TRL34") ?? "Nome muito longo.", "TRL34")
  }

  const { error } = await aluno.supabase.rpc("rename_my_participation", {
    p_aplicacao_id: aplicacaoId,
    p_nome: limpo,
  })

  if (error) {
    return falhaDeRpc(error, "Não foi possível salvar o nome.")
  }

  revalidatePath("/atividade")
  return { error: null }
}
