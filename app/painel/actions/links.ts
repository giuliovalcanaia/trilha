"use server"

import { idField, textField } from "@/lib/actions/form-data"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { getTeacher } from "@/lib/actions/teacher"
import { parseLinkList } from "@/lib/dominio/links"
import { aplicarLinks } from "@/lib/painel/aplicar-links"

export async function updateLinks(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const atividadeId = idField(formData, "atividade_id")
  if (!atividadeId) return fail("Atividade inválida.")

  const { data: atividade } = await teacher.supabase
    .from("atividades")
    .select("id")
    .eq("id", atividadeId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!atividade) return fail("Atividade não encontrada.")

  const lista = parseLinkList(textField(formData, "links_texto"))
  if (!lista.ok) return fail(lista.error)

  const erro = await aplicarLinks(teacher.supabase, atividadeId, lista.links)
  if (erro) return fail(erro)

  revalidatePainel(`/painel/atividades/${atividadeId}`)
  return ok("Links atualizados.")
}
