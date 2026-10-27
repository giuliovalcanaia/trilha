import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { revalidatePainel } from "@/lib/actions/revalidate"
import type { Teacher } from "@/lib/actions/teacher"
import type { SupabaseClient } from "@/lib/supabase/server"

async function pastaDescendants(supabase: SupabaseClient, rootId: number) {
  const { data } = await supabase
    .from("pastas")
    .select("id, parent_id")
    .is("deleted_at", null)
  const children = new Map<number, number[]>()

  for (const pasta of data ?? []) {
    if (pasta.parent_id === null) continue
    const list = children.get(pasta.parent_id) ?? []
    list.push(pasta.id)
    children.set(pasta.parent_id, list)
  }

  const result = new Set<number>([rootId])
  const queue = [rootId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const child of children.get(current) ?? []) {
      if (result.has(child)) continue
      result.add(child)
      queue.push(child)
    }
  }

  return result
}

async function validarDestinoPasta(
  supabase: SupabaseClient,
  pastaId: number,
  parentId: number | null
): Promise<string | null> {
  if (parentId === null) return null

  if (parentId === pastaId) {
    return "Uma pasta não pode ficar dentro dela mesma."
  }

  const descendants = await pastaDescendants(supabase, pastaId)
  if (descendants.has(parentId)) {
    return "Uma pasta não pode ficar dentro de uma subpasta dela."
  }

  const { data: parent } = await supabase
    .from("pastas")
    .select("id")
    .eq("id", parentId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!parent) return "Pasta de destino inválida."

  return null
}

export async function movePastaTo(
  teacher: Teacher,
  id: number,
  parentId: number | null
): Promise<ActionResult> {
  const erroDestino = await validarDestinoPasta(teacher.supabase, id, parentId)
  if (erroDestino) return fail(erroDestino)

  const { data, error } = await teacher.supabase
    .from("pastas")
    .update({ parent_id: parentId })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) {
    if (error?.message.includes("shared_folder_root")) {
      return fail("A pasta compartilhada só pode ser movida pelo dono.")
    }
    return fail("Pasta não encontrada.")
  }

  revalidatePainel()
  return ok("Pasta movida.")
}

export async function moveAtividadeTo(
  teacher: Teacher,
  id: number,
  pastaId: number | null
): Promise<ActionResult> {
  if (pastaId !== null) {
    const { data: pasta } = await teacher.supabase
      .from("pastas")
      .select("id")
      .eq("id", pastaId)
      .is("deleted_at", null)
      .maybeSingle()

    if (!pasta) return fail("Pasta de destino inválida.")
  }

  const { data, error } = await teacher.supabase
    .from("atividades")
    .update({ pasta_id: pastaId })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) return fail("Atividade não encontrada.")

  revalidatePainel()
  return ok("Atividade movida.")
}
