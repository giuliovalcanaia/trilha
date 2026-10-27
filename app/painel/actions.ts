"use server"

import { randomInt } from "node:crypto"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { parseLinkList } from "@/lib/dominio/links"
import { parseNota } from "@/lib/dominio/nota"
import { separarChaves } from "@/lib/dominio/selecao"
import { hoje } from "@/lib/format"
import { fallbackLinkTitle, lookupLinkTitles } from "@/lib/link-preview"
import {
  normalizarPastaCompartilhamento,
  type PastaCompartilhamento,
} from "@/lib/painel/compartilhamento"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = {
  error: string | null
  success?: string | null
  trashId?: string | null
}

type Supabase = Awaited<ReturnType<typeof createClient>>

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const STATUSES = ["aberta", "fazendo", "concluida", "bloqueada"] as const

function field(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

/** Como `field`, mas sem aparar as bordas (preserva as linhas do textarea). */
function textField(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

function optionalField(formData: FormData, name: string) {
  const value = field(formData, name)
  return value ? value : null
}

function idField(formData: FormData, name: string) {
  const value = Number(field(formData, name))
  return Number.isInteger(value) && value > 0 ? value : null
}

function fail(error: string): ActionResult {
  return { error }
}

function ok(success: string, trashId?: string): ActionResult {
  return { error: null, success, trashId }
}

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

async function getTeacher() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (!userId) return null

  const { data: professor } = await supabase
    .from("professores")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (!professor) return null

  return { supabase, professorId: professor.id }
}

function revalidatePainel(extra?: string) {
  revalidatePath("/painel", "layout")
  revalidatePath("/painel/lixeira")
  if (extra) revalidatePath(extra)
}

async function generateCode(supabase: Supabase) {
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

// ---------------------------------------------------------
// Pastas
// ---------------------------------------------------------

async function pastaDescendants(supabase: Supabase, rootId: number) {
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
  supabase: Supabase,
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

async function movePastaTo(
  teacher: NonNullable<Awaited<ReturnType<typeof getTeacher>>>,
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

async function moveAtividadeTo(
  teacher: NonNullable<Awaited<ReturnType<typeof getTeacher>>>,
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

export type FolderShareResult = {
  error: string | null
  compartilhamento: PastaCompartilhamento | null
}

/** Carrega dono e acessos da pasta sob demanda (ao abrir o diálogo). */
export async function getFolderShare(
  pastaId: number
): Promise<FolderShareResult> {
  const teacher = await getTeacher()
  if (!teacher) {
    return {
      error: "Sessão expirada. Entre novamente.",
      compartilhamento: null,
    }
  }

  if (!Number.isInteger(pastaId) || pastaId <= 0) {
    return { error: "Pasta inválida.", compartilhamento: null }
  }

  const { data, error } = await teacher.supabase.rpc(
    "get_pasta_compartilhamento",
    { p_pasta_id: pastaId }
  )

  if (error || !data) {
    return {
      error: "Não foi possível carregar o compartilhamento.",
      compartilhamento: null,
    }
  }

  return {
    error: null,
    compartilhamento: normalizarPastaCompartilhamento(data),
  }
}

export async function shareFolder(
  pastaId: number,
  email: string
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  if (!Number.isInteger(pastaId) || pastaId <= 0) return fail("Pasta inválida.")

  const valor = email.trim()
  if (!valor) return fail("Informe o e-mail do professor.")

  const { error } = await teacher.supabase.rpc("share_folder", {
    p_pasta_id: pastaId,
    p_email: valor,
  })

  if (error) {
    if (error.message.includes("professor_not_found")) {
      return fail("Nenhum professor cadastrado com esse e-mail.")
    }
    if (error.message.includes("cannot_share_with_self")) {
      return fail("Você já tem acesso a esta pasta.")
    }
    if (error.message.includes("invalid_email")) {
      return fail("Informe um e-mail válido.")
    }
    if (error.message.includes("folder_not_found")) {
      return fail("Você não pode compartilhar esta pasta.")
    }
    return fail("Não foi possível compartilhar a pasta.")
  }

  revalidatePainel(`/painel/pastas/${pastaId}`)
  return ok("Pasta compartilhada.")
}

export async function unshareFolder(
  pastaId: number,
  professorId: number
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  if (!Number.isInteger(pastaId) || pastaId <= 0) return fail("Pasta inválida.")
  if (!Number.isInteger(professorId) || professorId <= 0) {
    return fail("Professor inválido.")
  }

  const { error } = await teacher.supabase.rpc("unshare_folder", {
    p_pasta_id: pastaId,
    p_professor_id: professorId,
  })

  if (error) return fail("Não foi possível remover o acesso.")

  revalidatePainel(`/painel/pastas/${pastaId}`)
  return ok("Acesso removido.")
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
        `A pasta compartilhada só pode ser movida para a lixeira pelo dono.`
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

// ---------------------------------------------------------
// Atividades
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// Lixeira
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// Entrada da atividade (aplicação com o código do aluno)
// ---------------------------------------------------------

// ---------------------------------------------------------
// Links
// ---------------------------------------------------------

/** Concilia a lista colada no textarea com os links já gravados. */
async function aplicarLinks(
  supabase: Supabase,
  atividadeId: number,
  hrefs: string[]
): Promise<string | null> {
  // Ordem e unicidade dos hrefs já vêm do parse, mas a função pode ser usada
  // por outros fluxos: deduplicar aqui evita dois links iguais na conciliação.
  const lista = [...new Set(hrefs)]

  const { data: atuais, error } = await supabase
    .from("links")
    .select("id, href, ordem")
    .eq("atividade_id", atividadeId)
    .order("ordem")

  if (error) {
    console.error("aplicarLinks:select", error)
    return "Não foi possível carregar os links."
  }

  const idsPorHref = new Map<string, number[]>()
  for (const link of atuais ?? []) {
    const ids = idsPorHref.get(link.href) ?? []
    ids.push(link.id)
    idsPorHref.set(link.href, ids)
  }

  const mantidos: { href: string; id: number }[] = []
  const novos: string[] = []

  for (const href of lista) {
    const id = idsPorHref.get(href)?.shift()
    if (id) mantidos.push({ href, id })
    else novos.push(href)
  }

  const mantidosIds = new Set(mantidos.map((link) => link.id))
  const removidos = (atuais ?? [])
    .filter((link) => !mantidosIds.has(link.id))
    .map((link) => link.id)

  // Busca os títulos antes de mexer no banco: se a rede estiver lenta, a lista
  // atual continua intacta até o momento da gravação.
  const titulos = await lookupLinkTitles(novos)
  const maiorOrdem = (atuais ?? []).reduce(
    (maior, link) => Math.max(maior, link.ordem),
    0
  )

  if (removidos.length > 0) {
    const { error: erroRemover } = await supabase
      .from("links")
      .delete()
      .in("id", removidos)

    if (erroRemover) {
      console.error("aplicarLinks:delete", erroRemover)
      return "Não foi possível remover os links antigos."
    }
  }

  const idsNovos = new Map<string, number>()

  if (novos.length > 0) {
    // Entram no fim, em ordens temporárias; o reorder_links define a posição
    // final de todos de uma vez, sem violar unique (atividade_id, ordem).
    const { data: inseridos, error: erroInserir } = await supabase
      .from("links")
      .insert(
        novos.map((href, index) => ({
          atividade_id: atividadeId,
          href,
          titulo: titulos.get(href) ?? fallbackLinkTitle(href),
          ordem: maiorOrdem + index + 1,
        }))
      )
      .select("id, href")

    if (erroInserir || !inseridos) {
      console.error("aplicarLinks:insert", erroInserir)
      return "Não foi possível adicionar os links."
    }

    for (const link of inseridos) {
      idsNovos.set(link.href, link.id)
    }
  }

  const idsFinais = lista.map((href) => {
    const mantido = mantidos.find((link) => link.href === href)
    return mantido?.id ?? idsNovos.get(href) ?? 0
  })

  if (idsFinais.some((id) => !id)) {
    console.error("aplicarLinks:ids", { atividadeId, idsFinais })
    return "Não foi possível organizar os links."
  }

  if (idsFinais.length > 0) {
    const { error: erroOrdem } = await supabase.rpc("reorder_links", {
      p_atividade_id: atividadeId,
      p_link_ids: idsFinais,
    })

    if (erroOrdem) {
      console.error("aplicarLinks:reorder", erroOrdem)
      return "Não foi possível organizar os links."
    }
  }

  return null
}

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

// ---------------------------------------------------------
// Progresso (professor)
// ---------------------------------------------------------

export async function updateStudentProgress(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const atividadeId = idField(formData, "atividade_id")
  const participacaoId = idField(formData, "participacao_id")
  const linkId = idField(formData, "link_id")
  const status = field(formData, "status")
  const pontuacaoRaw = field(formData, "pontuacao")

  if (!atividadeId || !participacaoId || !linkId) {
    return fail("Progresso inválido.")
  }

  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return fail("Situação inválida.")
  }

  let pontuacao: number | null = null
  if (pontuacaoRaw) {
    const resultado = parseNota(pontuacaoRaw)
    if (!resultado.ok) return fail(resultado.erro)
    pontuacao = resultado.valor
  }

  const { error } = await teacher.supabase.rpc("set_student_progress", {
    p_participacao_id: participacaoId,
    p_link_id: linkId,
    p_status: status,
    p_pontuacao: pontuacao,
  })

  if (error) return fail("Não foi possível salvar o progresso.")

  revalidatePainel(`/painel/atividades/${atividadeId}`)
  return ok("Progresso atualizado.")
}

// ---------------------------------------------------------
// Alunos (professor)
// ---------------------------------------------------------

export async function expelStudent(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const atividadeId = idField(formData, "atividade_id")
  const participacaoId = idField(formData, "participacao_id")

  if (!atividadeId || !participacaoId) {
    return fail("Aluno inválido.")
  }

  const { error } = await teacher.supabase.rpc("expel_student", {
    p_participacao_id: participacaoId,
  })

  if (error) {
    return fail(
      error.message === "participation_not_found"
        ? "Este aluno não está mais nesta atividade."
        : "Não foi possível expulsar o aluno."
    )
  }

  revalidatePainel(`/painel/atividades/${atividadeId}`)
  return ok("Aluno expulso da atividade.")
}
