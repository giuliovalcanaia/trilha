import { getPasta } from "@/lib/data/pasta"
import type { SupabaseClient } from "@/lib/supabase/server"

export const ATIVIDADE_RESUMO =
  "id, titulo, subtitulo, pasta_id, status, embaralhar_links" as const
export const ATIVIDADE_PUBLICA = "id, titulo, subtitulo, status" as const
export const ATIVIDADE_EXPLORER =
  "id, titulo, subtitulo, pasta_id, status, created_at, updated_at" as const
export const LINK_ATIVIDADE = "id, titulo, href, ordem" as const
export const APLICACAO_ATIVIDADE = "id, codigo, data, status" as const
export const PARTICIPACAO_ATIVIDADE =
  "id, aplicacao_id, nome, iniciado_em, concluido_em" as const
export const PROGRESSO_ATIVIDADE =
  "participacao_id, link_id, status, pontuacao" as const

/** Atividade completa para o editor (inclui pasta e embaralhamento). */
export async function getAtividade(supabase: SupabaseClient, id: number) {
  const { data, error } = await supabase
    .from("atividades")
    .select(ATIVIDADE_RESUMO)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error("atividade_lookup_failed")

  return data
}

/** Campos que o aluno pode ver; sem pasta/embaralhamento. */
export async function getAtividadePublica(
  supabase: SupabaseClient,
  id: number
) {
  const { data, error } = await supabase
    .from("atividades")
    .select(ATIVIDADE_PUBLICA)
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error("atividade_publica_lookup_failed")

  return data
}

export async function getAtividadesExplorador(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("atividades")
    .select(ATIVIDADE_EXPLORER)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })

  if (error) throw new Error("atividades_explorer_lookup_failed")

  return data ?? []
}

export async function getLinksDaAtividade(
  supabase: SupabaseClient,
  atividadeId: number
) {
  const { data, error } = await supabase
    .from("links")
    .select(LINK_ATIVIDADE)
    .eq("atividade_id", atividadeId)
    .order("ordem")

  if (error) throw new Error("links_lookup_failed")

  return data ?? []
}

export async function getAplicacoesDaAtividade(
  supabase: SupabaseClient,
  atividadeId: number
) {
  const { data, error } = await supabase
    .from("aplicacoes")
    .select(APLICACAO_ATIVIDADE)
    .eq("atividade_id", atividadeId)
    .order("created_at")

  if (error) throw new Error("aplicacoes_lookup_failed")

  return data ?? []
}

/** Data da primeira entrada, usada como "data da aula" na prévia. */
export async function getDataDaPrimeiraAplicacao(
  supabase: SupabaseClient,
  atividadeId: number
) {
  const { data, error } = await supabase
    .from("aplicacoes")
    .select("data")
    .eq("atividade_id", atividadeId)
    .order("created_at")
    .limit(1)
    .maybeSingle()

  if (error) throw new Error("aplicacao_data_lookup_failed")

  return data
}

/**
 * Senha de liberação em texto. Se a coluna `senha_texto` ainda não existir
 * (rollout antigo), devolve `senha_texto: null` para a página avisar o
 * professor em vez de derrubar o editor.
 */
export async function getSenhaDaAtividade(
  supabase: SupabaseClient,
  atividadeId: number
) {
  const { data, error } = await supabase
    .from("atividade_senhas")
    .select("atividade_id, senha_texto")
    .eq("atividade_id", atividadeId)
    .maybeSingle()

  if (!error) return data

  const { data: semTexto, error: fallbackError } = await supabase
    .from("atividade_senhas")
    .select("atividade_id")
    .eq("atividade_id", atividadeId)
    .maybeSingle()

  if (fallbackError) throw new Error("senha_lookup_failed")

  return semTexto
    ? { atividade_id: semTexto.atividade_id, senha_texto: null }
    : null
}

export async function getParticipacoesDaAtividade(
  supabase: SupabaseClient,
  aplicacaoIds: number[]
) {
  const { data, error } = await supabase
    .from("participacoes")
    .select(PARTICIPACAO_ATIVIDADE)
    .in("aplicacao_id", aplicacaoIds.length > 0 ? aplicacaoIds : [-1])
    .is("expulso_em", null)
    .order("nome")

  if (error) throw new Error("participacoes_lookup_failed")

  return data ?? []
}

export async function getProgressoDaAtividade(
  supabase: SupabaseClient,
  participacaoIds: number[],
  linkIds: number[]
) {
  const { data, error } = await supabase
    .from("progresso_estudante")
    .select(PROGRESSO_ATIVIDADE)
    .in("participacao_id", participacaoIds.length > 0 ? participacaoIds : [-1])
    .in("link_id", linkIds.length > 0 ? linkIds : [-1])

  if (error) throw new Error("progresso_lookup_failed")

  return data ?? []
}

/**
 * Tudo que a tela de edição da atividade precisa, em uma chamada. A página
 * continua derivando os mapas de exibição (participações por entrada etc.).
 */
export async function getAtividadeEditor(
  supabase: SupabaseClient,
  atividadeId: number
) {
  const atividade = await getAtividade(supabase, atividadeId)
  if (!atividade) return null

  const [pasta, senha, links, aplicacoes] = await Promise.all([
    getPasta(supabase, atividade.pasta_id),
    getSenhaDaAtividade(supabase, atividadeId),
    getLinksDaAtividade(supabase, atividadeId),
    getAplicacoesDaAtividade(supabase, atividadeId),
  ])

  const participacoes = await getParticipacoesDaAtividade(
    supabase,
    aplicacoes.map((aplicacao) => aplicacao.id)
  )

  const progresso = await getProgressoDaAtividade(
    supabase,
    participacoes.map((participacao) => participacao.id),
    links.map((link) => link.id)
  )

  return {
    atividade,
    pasta,
    senha,
    links,
    aplicacoes,
    participacoes,
    progresso,
  }
}
