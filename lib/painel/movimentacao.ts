import type { ProfessorCtx } from "@/lib/actions/with-professor"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { falhaDeRpc } from "@/lib/actions/rpc-error"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { pastaDescendantIds } from "@/lib/dominio/pastas"
import type { SupabaseClient } from "@/lib/supabase/server"

async function validarDestinoPasta(
  supabase: SupabaseClient,
  pastaId: number,
  parentId: number | null
): Promise<string | null> {
  if (parentId === null) return null

  if (parentId === pastaId) {
    return "Uma pasta não pode ficar dentro dela mesma."
  }

  const { data: pastas, error: pastasError } = await supabase
    .from("pastas")
    .select("id, nome, parent_id")
    .is("deleted_at", null)

  if (pastasError) throw new Error("pasta_descendentes_lookup_failed")

  if (pastaDescendantIds(pastas ?? [], pastaId).has(parentId)) {
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
  professor: ProfessorCtx,
  id: number,
  parentId: number | null
): Promise<ActionResult> {
  const erroDestino = await validarDestinoPasta(
    professor.supabase,
    id,
    parentId
  )
  if (erroDestino) return fail(erroDestino)

  const { data, error } = await professor.supabase
    .from("pastas")
    .update({ parent_id: parentId })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) {
    return falhaDeRpc(error, "Pasta não encontrada.", {
      TRL22: "A pasta compartilhada só pode ser movida pelo dono.",
    })
  }

  revalidatePainel()
  return ok("Pasta movida.")
}

export async function moveAtividadeTo(
  professor: ProfessorCtx,
  id: number,
  pastaId: number | null
): Promise<ActionResult> {
  if (pastaId !== null) {
    const { data: pasta } = await professor.supabase
      .from("pastas")
      .select("id")
      .eq("id", pastaId)
      .is("deleted_at", null)
      .maybeSingle()

    if (!pasta) return fail("Pasta de destino inválida.", "validacao")
  }

  const { data, error } = await professor.supabase
    .from("atividades")
    .update({ pasta_id: pastaId })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) {
    return falhaDeRpc(error, "Atividade não encontrada.", {
      TRL19: "Pasta de destino inválida.",
    })
  }

  revalidatePainel()
  return ok("Atividade movida.")
}
