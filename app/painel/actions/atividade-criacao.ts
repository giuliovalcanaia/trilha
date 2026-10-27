"use server"

import { randomInt } from "node:crypto"

import { redirect } from "next/navigation"

import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, type ActionResult } from "@/lib/actions/result"
import { falhaDeRpc } from "@/lib/actions/rpc-error"
import { withProfessorForm } from "@/lib/actions/with-professor"
import { createAtividadeSchema } from "@/lib/dominio/atividade"
import { parseLinkList } from "@/lib/dominio/links"
import { hoje } from "@/lib/format"
import { aplicarLinks } from "@/lib/painel/aplicar-links"
import type { SupabaseClient } from "@/lib/supabase/server"

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

async function generateCode(supabase: SupabaseClient) {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ""
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
    }

    const { data } = await supabase
      .from("aplicacoes")
      .select("id")
      .eq("codigo", code)
      .maybeSingle()

    if (!data) return code
  }

  return null
}

export async function createAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "createAtividade",
    createAtividadeSchema,
    formData,
    async (
      professor,
      { titulo, subtitulo, pasta_id, senha, embaralhar_links, links_texto }
    ) => {
      const lista = parseLinkList(links_texto)

      if (!lista.ok) return fail(lista.error, "validacao")

      if (pasta_id !== null) {
        const { data: pasta } = await professor.supabase
          .from("pastas")
          .select("id")
          .eq("id", pasta_id)
          .is("deleted_at", null)
          .maybeSingle()

        if (!pasta) return fail("Pasta de destino inválida.", "validacao")
      }

      const { data: atividade, error } = await professor.supabase
        .from("atividades")
        .insert({
          titulo,
          subtitulo,
          pasta_id,
          professor_id: professor.professorId,
          embaralhar_links,
        })
        .select("id")
        .single()

      if (error || !atividade) {
        return falhaDeRpc(error, "Não foi possível criar a atividade.")
      }

      const { error: senhaError } = await professor.supabase.rpc(
        "set_activity_password",
        { p_atividade_id: atividade.id, p_senha: senha }
      )

      if (senhaError) {
        await professor.supabase
          .from("atividades")
          .delete()
          .eq("id", atividade.id)
        return falhaDeRpc(
          senhaError,
          "Não foi possível definir a senha da atividade."
        )
      }

      if (lista.links.length > 0) {
        const erroLinks = await aplicarLinks(
          professor.supabase,
          atividade.id,
          lista.links
        )

        if (erroLinks) {
          console.error("createAtividade:links", erroLinks)
          await professor.supabase
            .from("atividades")
            .delete()
            .eq("id", atividade.id)
          return fail(erroLinks, "inesperado")
        }
      }

      const codigo = await generateCode(professor.supabase)

      if (!codigo) {
        await professor.supabase
          .from("atividades")
          .delete()
          .eq("id", atividade.id)
        return fail("Não foi possível gerar o código de entrada.", "inesperado")
      }

      const { error: entradaError } = await professor.supabase
        .from("aplicacoes")
        .insert({
          atividade_id: atividade.id,
          turma_id: null,
          codigo,
          data: hoje(),
        })

      if (entradaError) {
        await professor.supabase
          .from("atividades")
          .delete()
          .eq("id", atividade.id)
        return falhaDeRpc(
          entradaError,
          "Não foi possível criar o código de entrada."
        )
      }

      // A atividade já nasce ativa: publicada e com a entrada aberta.
      const { error: publicacaoError } = await professor.supabase
        .from("atividades")
        .update({ status: "publicada", publicada_em: new Date().toISOString() })
        .eq("id", atividade.id)

      if (publicacaoError) {
        await professor.supabase
          .from("atividades")
          .delete()
          .eq("id", atividade.id)
        return falhaDeRpc(
          publicacaoError,
          "Não foi possível publicar a atividade."
        )
      }

      revalidatePainel()
      redirect(`/painel/atividades/${atividade.id}`)
    }
  )
}
