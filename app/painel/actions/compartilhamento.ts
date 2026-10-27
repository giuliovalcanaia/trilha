"use server"

import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { falhaDeRpc } from "@/lib/actions/rpc-error"
import {
  SESSAO_EXPIRADA,
  withProfessorCall,
} from "@/lib/actions/with-professor"
import { getProfessor } from "@/lib/auth/professor"
import { AppError, mensagemDoErro } from "@/lib/dominio/erros"
import {
  normalizarPastaCompartilhamento,
  type PastaCompartilhamento,
} from "@/lib/painel/compartilhamento"

export type FolderShareResult = {
  error: string | null
  compartilhamento: PastaCompartilhamento | null
}

/** Carrega dono e acessos da pasta sob demanda (ao abrir o diálogo). */
export async function getFolderShare(
  pastaId: number
): Promise<FolderShareResult> {
  const sessao = await getProfessor()

  if (!sessao) {
    return { error: SESSAO_EXPIRADA, compartilhamento: null }
  }

  if (!Number.isInteger(pastaId) || pastaId <= 0) {
    return { error: "Pasta inválida.", compartilhamento: null }
  }

  const { data, error } = await sessao.supabase.rpc(
    "get_pasta_compartilhamento",
    { p_pasta_id: pastaId }
  )

  if (error || !data) {
    return {
      error:
        mensagemDoErro(error?.code) ??
        "Não foi possível carregar o compartilhamento.",
      compartilhamento: null,
    }
  }

  return {
    error: null,
    compartilhamento: normalizarPastaCompartilhamento(data),
  }
}

export async function shareFolder(
  pastaId: number,
  email: string
): Promise<ActionResult> {
  return withProfessorCall("shareFolder", async (professor) => {
    if (!Number.isInteger(pastaId) || pastaId <= 0) {
      return fail("Pasta inválida.", "validacao")
    }

    const valor = email.trim()
    if (!valor) throw new AppError("TRL26")

    const { error } = await professor.supabase.rpc("share_folder", {
      p_pasta_id: pastaId,
      p_email: valor,
    })

    if (error) {
      return falhaDeRpc(error, "Não foi possível compartilhar a pasta.", {
        TRL19: "Você não pode compartilhar esta pasta.",
      })
    }

    revalidatePainel(`/painel/pastas/${pastaId}`)
    return ok("Pasta compartilhada.")
  })
}

export async function unshareFolder(
  pastaId: number,
  professorId: number
): Promise<ActionResult> {
  return withProfessorCall("unshareFolder", async (professor) => {
    if (!Number.isInteger(pastaId) || pastaId <= 0) {
      return fail("Pasta inválida.", "validacao")
    }
    if (!Number.isInteger(professorId) || professorId <= 0) {
      return fail("Professor inválido.", "validacao")
    }

    const { error } = await professor.supabase.rpc("unshare_folder", {
      p_pasta_id: pastaId,
      p_professor_id: professorId,
    })

    if (error) {
      return falhaDeRpc(error, "Não foi possível remover o acesso.")
    }

    revalidatePainel(`/painel/pastas/${pastaId}`)
    return ok("Acesso removido.")
  })
}
