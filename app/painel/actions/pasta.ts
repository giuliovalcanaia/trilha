"use server"

import { field, idField } from "@/lib/actions/form-data"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { getTeacher } from "@/lib/actions/teacher"
import { separarChaves } from "@/lib/dominio/selecao"
import { moveAtividadeTo, movePastaTo } from "@/lib/painel/movimentacao"

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
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const nome = field(formData, "nome")
  const parentId = idField(formData, "parent_id")

  if (!nome) return fail("Informe o nome da pasta.")

  if (parentId !== null) {
    const { data: parent } = await teacher.supabase
      .from("pastas")
      .select("id")
      .eq("id", parentId)
      .is("deleted_at", null)
      .maybeSingle()

    if (!parent) return fail("Pasta de destino inválida.")
  }

  const { error } = await teacher.supabase.from("pastas").insert({
    nome,
    parent_id: parentId,
    professor_id: teacher.professorId,
  })

  if (error) return fail("Não foi possível criar a pasta.")

  revalidatePainel()
  return ok("Pasta criada.")
}

export async function renamePasta(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const id = idField(formData, "id")
  const nome = field(formData, "nome")

  if (!id) return fail("Pasta inválida.")
  if (!nome) return fail("Informe o nome da pasta.")

  const { data, error } = await teacher.supabase
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

export async function movePasta(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const id = idField(formData, "id")
  const parentId = idField(formData, "parent_id")

  if (!id) return fail("Pasta inválida.")

  return movePastaTo(teacher, id, parentId)
}

export async function trashPasta(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const id = idField(formData, "id")
  if (!id) return fail("Pasta inválida.")

  const { data, error } = await teacher.supabase.rpc("trash_pasta", {
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

export async function trashSelecionados(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const { pastas, atividades } = separarChaves(
    parseChaves(field(formData, "itens"))
  )
  const total = pastas.length + atividades.length

  if (total === 0) return fail("Nenhum item selecionado.")

  const { data, error } = await teacher.supabase.rpc("trash_items", {
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

export async function duplicatePasta(pastaId: number): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  if (!Number.isInteger(pastaId) || pastaId <= 0) return fail("Pasta inválida.")

  const { data, error } = await teacher.supabase.rpc("duplicate_pasta", {
    p_pasta_id: pastaId,
  })

  if (error || !data) return fail("Não foi possível duplicar a pasta.")

  revalidatePainel()
  return ok("Pasta duplicada.")
}

export async function moveItem(
  tipo: "pasta" | "atividade",
  id: number,
  pastaDestinoId: number | null
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  if (!Number.isInteger(id) || id <= 0) return fail("Item inválido.")

  if (tipo === "pasta") {
    return movePastaTo(teacher, id, pastaDestinoId)
  }

  return moveAtividadeTo(teacher, id, pastaDestinoId)
}
