"use server"

import { randomInt } from "node:crypto"

import { redirect } from "next/navigation"

import {
  field,
  idField,
  optionalField,
  textField,
} from "@/lib/actions/form-data"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { getTeacher } from "@/lib/actions/teacher"
import { parseLinkList } from "@/lib/dominio/links"
import { hoje } from "@/lib/format"
import { aplicarLinks } from "@/lib/painel/aplicar-links"
import { moveAtividadeTo } from "@/lib/painel/movimentacao"
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
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const titulo = field(formData, "titulo")
  const pastaId = idField(formData, "pasta_id")
  const senha = field(formData, "senha")
  const embaralharLinks = field(formData, "embaralhar_links") === "true"
  const lista = parseLinkList(textField(formData, "links_texto"))

  if (!titulo) return fail("Informe o título da atividade.")
  if (senha.length < 4)
    return fail("A senha precisa ter pelo menos 4 caracteres.")
  if (!lista.ok) return fail(lista.error)

  if (pastaId !== null) {
    const { data: pasta } = await teacher.supabase
      .from("pastas")
      .select("id")
      .eq("id", pastaId)
      .is("deleted_at", null)
      .maybeSingle()

    if (!pasta) return fail("Pasta de destino inválida.")
  }

  const { data: atividade, error } = await teacher.supabase
    .from("atividades")
    .insert({
      titulo,
      subtitulo: optionalField(formData, "subtitulo"),
      pasta_id: pastaId,
      professor_id: teacher.professorId,
      embaralhar_links: embaralharLinks,
    })
    .select("id")
    .single()

  if (error || !atividade) {
    return fail("Não foi possível criar a atividade.")
  }

  const { error: senhaError } = await teacher.supabase.rpc(
    "set_activity_password",
    { p_atividade_id: atividade.id, p_senha: senha }
  )

  if (senhaError) {
    await teacher.supabase.from("atividades").delete().eq("id", atividade.id)
    return fail("Não foi possível definir a senha da atividade.")
  }

  if (lista.links.length > 0) {
    const erroLinks = await aplicarLinks(
      teacher.supabase,
      atividade.id,
      lista.links
    )

    if (erroLinks) {
      console.error("createAtividade:links", erroLinks)
      await teacher.supabase.from("atividades").delete().eq("id", atividade.id)
      return fail(erroLinks)
    }
  }

  const codigo = await generateCode(teacher.supabase)

  if (!codigo) {
    await teacher.supabase.from("atividades").delete().eq("id", atividade.id)
    return fail("Não foi possível gerar o código de entrada.")
  }

  const { error: entradaError } = await teacher.supabase
    .from("aplicacoes")
    .insert({
      atividade_id: atividade.id,
      turma_id: null,
      codigo,
      data: hoje(),
    })

  if (entradaError) {
    await teacher.supabase.from("atividades").delete().eq("id", atividade.id)
    return fail("Não foi possível criar o código de entrada.")
  }

  // A atividade já nasce ativa: publicada e com a entrada aberta.
  const { error: publicacaoError } = await teacher.supabase
    .from("atividades")
    .update({ status: "publicada", publicada_em: new Date().toISOString() })
    .eq("id", atividade.id)

  if (publicacaoError) {
    await teacher.supabase.from("atividades").delete().eq("id", atividade.id)
    return fail("Não foi possível publicar a atividade.")
  }

  revalidatePainel()
  redirect(`/painel/atividades/${atividade.id}`)
}

export async function updateAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const id = idField(formData, "id")
  if (!id) return fail("Atividade inválida.")

  // O cabeçalho salva título e subtítulo de forma independente: só os campos
  // enviados são atualizados, para um não sobrescrever o outro.
  const dados: { titulo?: string; subtitulo?: string | null } = {}

  if (formData.has("titulo")) {
    const titulo = field(formData, "titulo")
    if (!titulo) return fail("Informe o título da atividade.")
    dados.titulo = titulo
  }

  if (formData.has("subtitulo")) {
    dados.subtitulo = optionalField(formData, "subtitulo")
  }

  if (dados.titulo === undefined && dados.subtitulo === undefined) {
    return fail("Nada para salvar.")
  }

  const { data, error } = await teacher.supabase
    .from("atividades")
    .update(dados)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) return fail("Não foi possível salvar a atividade.")

  revalidatePainel(`/painel/atividades/${id}`)
  return { error: null }
}

export async function updateActivityShuffle(
  atividadeId: number,
  embaralhar: boolean
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const { data, error } = await teacher.supabase
    .from("atividades")
    .update({ embaralhar_links: embaralhar })
    .eq("id", atividadeId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) return fail("Não foi possível salvar a opção.")

  revalidatePainel(`/painel/atividades/${atividadeId}`)
  return { error: null }
}

export async function renameAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const id = idField(formData, "id")
  const titulo = field(formData, "titulo")

  if (!id) return fail("Atividade inválida.")
  if (!titulo) return fail("Informe o título da atividade.")

  const { data, error } = await teacher.supabase
    .from("atividades")
    .update({ titulo })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) return fail("Não foi possível renomear a atividade.")

  revalidatePainel(`/painel/atividades/${id}`)
  return ok("Atividade renomeada.")
}

export async function moveAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const id = idField(formData, "id")
  const pastaId = idField(formData, "pasta_id")

  if (!id) return fail("Atividade inválida.")

  return moveAtividadeTo(teacher, id, pastaId)
}

export async function updateActivityPassword(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const id = idField(formData, "atividade_id")
  const senha = field(formData, "senha")

  if (!id) return fail("Atividade inválida.")
  if (senha.length < 4)
    return fail("A senha precisa ter pelo menos 4 caracteres.")

  const { error } = await teacher.supabase.rpc("set_activity_password", {
    p_atividade_id: id,
    p_senha: senha,
  })

  if (error) return fail("Não foi possível atualizar a senha.")

  revalidatePainel(`/painel/atividades/${id}`)
  return ok("Senha atualizada.")
}

export async function alternarAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = idField(formData, "id")
  if (!id) return fail("Atividade inválida.")

  return setAtividadeAtiva(id, field(formData, "ativa") === "1")
}

export async function setAtividadeAtiva(
  atividadeId: number,
  ativa: boolean
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  if (!Number.isInteger(atividadeId) || atividadeId <= 0) {
    return fail("Atividade inválida.")
  }

  const { error } = await teacher.supabase.rpc("set_atividade_ativa", {
    p_atividade_id: atividadeId,
    p_ativa: ativa,
  })

  if (error) {
    return fail(
      ativa
        ? "Não foi possível reabrir a atividade."
        : "Não foi possível encerrar a atividade."
    )
  }

  revalidatePainel(`/painel/atividades/${atividadeId}`)
  return ok(ativa ? "Atividade reaberta." : "Atividade encerrada.")
}

export async function trashAtividade(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const id = idField(formData, "id")
  if (!id) return fail("Atividade inválida.")

  const { data, error } = await teacher.supabase.rpc("trash_atividade", {
    p_atividade_id: id,
  })

  if (error || !data) {
    return fail("Não foi possível mover a atividade para a lixeira.")
  }

  revalidatePainel(`/painel/atividades/${id}`)
  return ok("Atividade movida para a lixeira.", data)
}

export async function duplicateAtividade(
  atividadeId: number
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  if (!Number.isInteger(atividadeId) || atividadeId <= 0) {
    return fail("Atividade inválida.")
  }

  const { data, error } = await teacher.supabase.rpc("duplicate_atividade", {
    p_atividade_id: atividadeId,
  })

  if (error || !data) return fail("Não foi possível duplicar a atividade.")

  revalidatePainel()
  return ok("Atividade duplicada.")
}
