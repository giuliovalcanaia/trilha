"use server"

import { z } from "zod"

import { requiredId } from "@/lib/dominio/campos"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { withProfessorForm } from "@/lib/actions/with-professor"
import { linksTexto } from "@/lib/dominio/link"
import { parseLinkList } from "@/lib/dominio/links"
import { aplicarLinks } from "@/lib/painel/aplicar-links"

const updateLinksSchema = z.object({
  atividade_id: requiredId("Atividade inválida."),
  links_texto: linksTexto,
})

export async function updateLinks(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "updateLinks",
    updateLinksSchema,
    formData,
    async (professor, { atividade_id, links_texto }) => {
      const { data: atividade } = await professor.supabase
        .from("atividades")
        .select("id")
        .eq("id", atividade_id)
        .is("deleted_at", null)
        .maybeSingle()

      if (!atividade) return fail("Atividade não encontrada.")

      const lista = parseLinkList(links_texto)
      if (!lista.ok) return fail(lista.error)

      const erro = await aplicarLinks(
        professor.supabase,
        atividade_id,
        lista.links
      )
      if (erro) return fail(erro)

      revalidatePainel(`/painel/atividades/${atividade_id}`)
      return ok("Links atualizados.")
    }
  )
}
