"use server"

import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { falhaDeRpc } from "@/lib/actions/rpc-error"
import {
  withProfessorCall,
  withProfessorForm,
  type ProfessorCtx,
} from "@/lib/actions/with-professor"
import {
  alternarAtividadeSchema,
  moveAtividadeSchema,
  renameAtividadeSchema,
  trashAtividadeSchema,
  updateActivityPasswordSchema,
  updateAtividadeSchema,
} from "@/lib/dominio/atividade"
import { AppError } from "@/lib/dominio/erros"
import { moveAtividadeTo } from "@/lib/painel/movimentacao"

async function aplicarAtividadeAtiva(
  professor: ProfessorCtx,
  atividadeId: number,
  ativa: boolean
): Promise<ActionResult> {
  if (!Number.isInteger(atividadeId) || atividadeId <= 0) {
    throw new AppError("TRL20", "Atividade inválida.")
  }

  const { error } = await professor.supabase.rpc("set_atividade_ativa", {
    p_atividade_id: atividadeId,
    p_ativa: ativa,
  })

  if (error) {
    return falhaDeRpc(
      error,
      ativa
        ? "Não foi possível reabrir a atividade."
        : "Não foi possível encerrar a atividade."
    )
  }

  revalidatePainel(`/painel/atividades/${atividadeId}`)
  return ok(ativa ? "Atividade reaberta." : "Atividade encerrada.")
}

export async function updateAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "updateAtividade",
    updateAtividadeSchema,
    formData,
    async (professor, { id, titulo, subtitulo }) => {
      // O cabeçalho salva título e subtítulo de forma independente: só os
      // campos enviados são atualizados, para um não sobrescrever o outro.
      const dados: { titulo?: string; subtitulo?: string | null } = {}

      if (titulo !== undefined) dados.titulo = titulo
      if (subtitulo !== undefined) dados.subtitulo = subtitulo.trim() || null

      if (dados.titulo === undefined && dados.subtitulo === undefined) {
        return fail("Nada para salvar.", "validacao")
      }

      const { data, error } = await professor.supabase
        .from("atividades")
        .update(dados)
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle()

      if (error || !data) {
        return falhaDeRpc(error, "Não foi possível salvar a atividade.")
      }

      revalidatePainel(`/painel/atividades/${id}`)
      return { error: null }
    }
  )
}

export async function updateActivityShuffle(
  atividadeId: number,
  embaralhar: boolean
): Promise<ActionResult> {
  return withProfessorCall("updateActivityShuffle", async (professor) => {
    const { data, error } = await professor.supabase
      .from("atividades")
      .update({ embaralhar_links: embaralhar })
      .eq("id", atividadeId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle()

    if (error || !data) {
      return falhaDeRpc(error, "Não foi possível salvar a opção.")
    }

    revalidatePainel(`/painel/atividades/${atividadeId}`)
    return { error: null }
  })
}

export async function renameAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "renameAtividade",
    renameAtividadeSchema,
    formData,
    async (professor, { id, titulo }) => {
      const { data, error } = await professor.supabase
        .from("atividades")
        .update({ titulo })
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle()

      if (error || !data) {
        return falhaDeRpc(error, "Não foi possível renomear a atividade.")
      }

      revalidatePainel(`/painel/atividades/${id}`)
      return ok("Atividade renomeada.")
    }
  )
}

export async function moveAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "moveAtividade",
    moveAtividadeSchema,
    formData,
    async (professor, { id, pasta_id }) =>
      moveAtividadeTo(professor, id, pasta_id)
  )
}

export async function updateActivityPassword(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "updateActivityPassword",
    updateActivityPasswordSchema,
    formData,
    async (professor, { atividade_id, senha }) => {
      const { error } = await professor.supabase.rpc("set_activity_password", {
        p_atividade_id: atividade_id,
        p_senha: senha,
      })

      if (error) {
        return falhaDeRpc(error, "Não foi possível atualizar a senha.")
      }

      revalidatePainel(`/painel/atividades/${atividade_id}`)
      return ok("Senha atualizada.")
    }
  )
}

export async function alternarAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "alternarAtividade",
    alternarAtividadeSchema,
    formData,
    async (professor, { id, ativa }) =>
      aplicarAtividadeAtiva(professor, id, ativa)
  )
}

export async function setAtividadeAtiva(
  atividadeId: number,
  ativa: boolean
): Promise<ActionResult> {
  return withProfessorCall("setAtividadeAtiva", (professor) =>
    aplicarAtividadeAtiva(professor, atividadeId, ativa)
  )
}

export async function trashAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "trashAtividade",
    trashAtividadeSchema,
    formData,
    async (professor, { id }) => {
      const { data, error } = await professor.supabase.rpc("trash_atividade", {
        p_atividade_id: id,
      })

      if (error || !data) {
        return falhaDeRpc(
          error,
          "Não foi possível mover a atividade para a lixeira."
        )
      }

      revalidatePainel(`/painel/atividades/${id}`)
      return ok("Atividade movida para a lixeira.", data)
    }
  )
}

export async function duplicateAtividade(
  atividadeId: number
): Promise<ActionResult> {
  return withProfessorCall("duplicateAtividade", async (professor) => {
    if (!Number.isInteger(atividadeId) || atividadeId <= 0) {
      throw new AppError("TRL20", "Atividade inválida.")
    }

    const { data, error } = await professor.supabase.rpc(
      "duplicate_atividade",
      { p_atividade_id: atividadeId }
    )

    if (error || !data) {
      return falhaDeRpc(error, "Não foi possível duplicar a atividade.")
    }

    revalidatePainel()
    return ok("Atividade duplicada.")
  })
}
