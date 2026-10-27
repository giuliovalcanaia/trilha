"use server"

import { z } from "zod"

import { optionalId, requiredId } from "@/lib/actions/form-data"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import {
  withProfessorCall,
  withProfessorForm,
} from "@/lib/actions/with-professor"
import { separarChaves } from "@/lib/dominio/selecao"
import { moveAtividadeTo, movePastaTo } from "@/lib/painel/movimentacao"

const nomeSchema = z.string().trim().min(1, "Informe o nome da pasta.")

const createPastaSchema = z.object({
  nome: nomeSchema,
  parent_id: optionalId,
})

const renamePastaSchema = z.object({
  id: requiredId("Pasta inválida."),
  nome: nomeSchema,
})

const movePastaSchema = z.object({
  id: requiredId("Pasta inválida."),
  parent_id: optionalId,
})

const trashPastaSchema = z.object({
  id: requiredId("Pasta inválida."),
})

const trashSelecionadosSchema = z.object({
  itens: z.string().optional().default(""),
})

function parseChaves(raw: string): string[] {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is string => typeof item === "string")
  } catch {
    return []
  }
}

export async function createPasta(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "createPasta",
    createPastaSchema,
    formData,
    async (professor, { nome, parent_id }) => {
      if (parent_id !== null) {
        const { data: parent } = await professor.supabase
          .from("pastas")
          .select("id")
          .eq("id", parent_id)
          .is("deleted_at", null)
          .maybeSingle()

        if (!parent) return fail("Pasta de destino inválida.")
      }

      const { error } = await professor.supabase.from("pastas").insert({
        nome,
        parent_id,
        professor_id: professor.professorId,
      })

      if (error) return fail("Não foi possível criar a pasta.")

      revalidatePainel()
      return ok("Pasta criada.")
    }
  )
}

export async function renamePasta(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "renamePasta",
    renamePastaSchema,
    formData,
    async (professor, { id, nome }) => {
      const { data, error } = await professor.supabase
        .from("pastas")
        .update({ nome })
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle()

      if (error || !data) return fail("Não foi possível renomear a pasta.")

      revalidatePainel()
      return ok("Pasta renomeada.")
    }
  )
}

export async function movePasta(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "movePasta",
    movePastaSchema,
    formData,
    async (professor, { id, parent_id }) =>
      movePastaTo(professor, id, parent_id)
  )
}

export async function trashPasta(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "trashPasta",
    trashPastaSchema,
    formData,
    async (professor, { id }) => {
      const { data, error } = await professor.supabase.rpc("trash_pasta", {
        p_pasta_id: id,
      })

      if (error || !data) {
        if (error?.message.includes("shared_folder_root")) {
          return fail(
            "A pasta compartilhada só pode ser movida para a lixeira pelo dono."
          )
        }
        return fail("Não foi possível mover a pasta para a lixeira.")
      }

      revalidatePainel()
      return ok("Pasta movida para a lixeira.", data)
    }
  )
}

export async function trashSelecionados(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "trashSelecionados",
    trashSelecionadosSchema,
    formData,
    async (professor, { itens }) => {
      const { pastas, atividades } = separarChaves(parseChaves(itens))
      const total = pastas.length + atividades.length

      if (total === 0) return fail("Nenhum item selecionado.")

      const { data, error } = await professor.supabase.rpc("trash_items", {
        p_pastas: pastas,
        p_atividades: atividades,
      })

      if (error || !data) {
        if (error?.message.includes("shared_folder_root")) {
          return fail(
            "A pasta compartilhada só pode ser movida para a lixeira pelo dono."
          )
        }
        return fail("Não foi possível mover os itens para a lixeira.")
      }

      revalidatePainel()
      return ok(
        total === 1
          ? "Item movido para a lixeira."
          : `${total} itens movidos para a lixeira.`,
        data
      )
    }
  )
}

export async function duplicatePasta(pastaId: number): Promise<ActionResult> {
  return withProfessorCall("duplicatePasta", async (professor) => {
    if (!Number.isInteger(pastaId) || pastaId <= 0) {
      return fail("Pasta inválida.")
    }

    const { data, error } = await professor.supabase.rpc("duplicate_pasta", {
      p_pasta_id: pastaId,
    })

    if (error || !data) return fail("Não foi possível duplicar a pasta.")

    revalidatePainel()
    return ok("Pasta duplicada.")
  })
}

export async function moveItem(
  tipo: "pasta" | "atividade",
  id: number,
  pastaDestinoId: number | null
): Promise<ActionResult> {
  return withProfessorCall("moveItem", async (professor) => {
    if (!Number.isInteger(id) || id <= 0) return fail("Item inválido.")

    if (tipo === "pasta") {
      return movePastaTo(professor, id, pastaDestinoId)
    }

    return moveAtividadeTo(professor, id, pastaDestinoId)
  })
}
