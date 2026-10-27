"use server"

import { field } from "@/lib/actions/form-data"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { getTeacher } from "@/lib/actions/teacher"

export async function restoreTrash(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const trashId = field(formData, "trash_id")
  if (!trashId) return fail("Item da lixeira inválido.")

  const { error } = await teacher.supabase.rpc("restore_trash", {
    p_trash_id: trashId,
  })

  if (error) return fail("Não foi possível restaurar o item.")

  revalidatePainel()
  return ok("Item restaurado.")
}

export async function undoTrash(trashId: string): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  if (!trashId) return fail("Item da lixeira inválido.")

  const { error } = await teacher.supabase.rpc("restore_trash", {
    p_trash_id: trashId,
  })

  if (error) return fail("Não foi possível restaurar o item.")

  revalidatePainel()
  return ok("Item restaurado.")
}

export async function purgeTrash(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const trashId = field(formData, "trash_id")
  if (!trashId) return fail("Item da lixeira inválido.")

  const { error } = await teacher.supabase.rpc("purge_trash", {
    p_trash_id: trashId,
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

export async function emptyTrash(
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const { error } = await teacher.supabase.rpc("empty_trash")

  if (error) return fail("Não foi possível esvaziar a lixeira.")

  revalidatePainel()
  return ok("Itens de sua propriedade removidos da lixeira.")
}
