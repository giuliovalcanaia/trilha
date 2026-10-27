"use server"

import { z } from "zod"

import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import {
  withProfessorCall,
  withProfessorForm,
} from "@/lib/actions/with-professor"

const trashIdSchema = z.object({
  trash_id: z.string().trim().min(1, "Item da lixeira inválido."),
})

const vazioSchema = z.object({})

export async function restoreTrash(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "restoreTrash",
    trashIdSchema,
    formData,
    async (professor, { trash_id }) => {
      const { error } = await professor.supabase.rpc("restore_trash", {
        p_trash_id: trash_id,
      })

      if (error) return fail("Não foi possível restaurar o item.")

      revalidatePainel()
      return ok("Item restaurado.")
    }
  )
}

export async function undoTrash(trashId: string): Promise<ActionResult> {
  return withProfessorCall("undoTrash", async (professor) => {
    if (!trashId) return fail("Item da lixeira inválido.")

    const { error } = await professor.supabase.rpc("restore_trash", {
      p_trash_id: trashId,
    })

    if (error) return fail("Não foi possível restaurar o item.")

    revalidatePainel()
    return ok("Item restaurado.")
  })
}

export async function purgeTrash(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "purgeTrash",
    trashIdSchema,
    formData,
    async (professor, { trash_id }) => {
      const { error } = await professor.supabase.rpc("purge_trash", {
        p_trash_id: trash_id,
      })

      if (error) {
        if (error.message.includes("shared_folder_root")) {
          return fail("A pasta compartilhada só pode ser excluída pelo dono.")
        }
        return fail("Não foi possível excluir o item definitivamente.")
      }

      revalidatePainel()
      return ok("Item excluído definitivamente.")
    }
  )
}

export async function emptyTrash(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "emptyTrash",
    vazioSchema,
    formData,
    async (professor) => {
      const { error } = await professor.supabase.rpc("empty_trash")

      if (error) return fail("Não foi possível esvaziar a lixeira.")

      revalidatePainel()
      return ok("Itens de sua propriedade removidos da lixeira.")
    }
  )
}
