import { getAtividadesExplorador } from "@/lib/data/atividade"
import { getPastasAtivas } from "@/lib/data/pasta"
import { type PastaRow } from "@/lib/dominio/pastas"
import { createClient } from "@/lib/supabase/server"

export type AplicacaoInfo = {
  codigo: string
}

export type ExplorerAtividade = {
  id: number
  titulo: string
  subtitulo: string | null
  pasta_id: number | null
  status: string
  created_at: string
  updated_at: string
  links: number
  aplicacoes: AplicacaoInfo[]
}

export type ExplorerPasta = PastaRow & {
  created_at: string
  pastaCount: number
  atividadeCount: number
}

export type ExplorerData = {
  /** Todas as pastas visíveis, com contadores para a listagem e a busca. */
  pastas: ExplorerPasta[]
  /** Todas as atividades visíveis, para a listagem e a busca global. */
  todasAtividades: ExplorerAtividade[]
}

/**
 * Carrega uma única vez todo o conteúdo do explorador. A troca de pastas é
 * feita no cliente (History API), então este payload não depende da pasta
 * atual; `pastaId` serve apenas para validar o acesso direto pela URL.
 *
 * As consultas são protegidas por RLS.
 */
export async function loadExplorerData(
  pastaId: number | null
): Promise<ExplorerData | null> {
  const supabase = await createClient()

  const [
    pastasVisiveis,
    atividades,
    { data: links, error: linksError },
    { data: aplicacoes, error: aplicacoesError },
  ] = await Promise.all([
    getPastasAtivas(supabase),
    getAtividadesExplorador(supabase),
    supabase.from("links").select("atividade_id"),
    supabase.from("aplicacoes").select("atividade_id, codigo"),
  ])

  if (linksError || aplicacoesError) {
    throw new Error("explorer_lookup_failed")
  }

  if (
    pastaId !== null &&
    !pastasVisiveis.some((pasta) => pasta.id === pastaId)
  ) {
    return null
  }

  const linksPorAtividade = new Map<number, number>()
  for (const link of links ?? []) {
    linksPorAtividade.set(
      link.atividade_id,
      (linksPorAtividade.get(link.atividade_id) ?? 0) + 1
    )
  }

  const aplicacoesPorAtividade = new Map<number, AplicacaoInfo[]>()
  for (const aplicacao of aplicacoes ?? []) {
    const lista = aplicacoesPorAtividade.get(aplicacao.atividade_id) ?? []
    lista.push({ codigo: aplicacao.codigo })
    aplicacoesPorAtividade.set(aplicacao.atividade_id, lista)
  }

  const pastasPorPai = new Map<number | null, number>()
  for (const pasta of pastasVisiveis) {
    pastasPorPai.set(
      pasta.parent_id,
      (pastasPorPai.get(pasta.parent_id) ?? 0) + 1
    )
  }

  const atividadesPorPasta = new Map<number | null, number>()
  for (const atividade of atividades) {
    atividadesPorPasta.set(
      atividade.pasta_id,
      (atividadesPorPasta.get(atividade.pasta_id) ?? 0) + 1
    )
  }

  const pastasComContadores: ExplorerPasta[] = pastasVisiveis.map((pasta) => ({
    ...pasta,
    pastaCount: pastasPorPai.get(pasta.id) ?? 0,
    atividadeCount: atividadesPorPasta.get(pasta.id) ?? 0,
  }))

  const todasAtividades: ExplorerAtividade[] = atividades.map((atividade) => ({
    ...atividade,
    links: linksPorAtividade.get(atividade.id) ?? 0,
    aplicacoes: aplicacoesPorAtividade.get(atividade.id) ?? [],
  }))

  return {
    pastas: pastasComContadores,
    todasAtividades,
  }
}
