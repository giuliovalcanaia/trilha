import { createClient } from "@/lib/supabase/server"
import {
  pastaBreadcrumb,
  pastasComRaizesVisiveis,
  type PastaRow,
} from "@/lib/dominio/pastas"

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

export type ExplorerPastaBase = PastaRow & {
  created_at: string
}

export type ExplorerPasta = ExplorerPastaBase & {
  pastaCount: number
  atividadeCount: number
}

export type ExplorerData = {
  pastas: ExplorerPastaBase[]
  pastasAtuais: ExplorerPasta[]
  /** Todas as atividades do professor, para a busca global. */
  todasAtividades: ExplorerAtividade[]
  atividadesAtuais: ExplorerAtividade[]
  breadcrumb: PastaRow[]
  pastaAtual: PastaRow | null
}

/**
 * Carrega as pastas/atividades ativas do professor e monta apenas o
 * conteúdo da pasta atual. As consultas são protegidas por RLS.
 */
export async function loadExplorerData(
  pastaId: number | null
): Promise<ExplorerData | null> {
  const supabase = await createClient()

  const [
    { data: pastas },
    { data: atividades },
    { data: links },
    { data: aplicacoes },
  ] = await Promise.all([
    supabase
      .from("pastas")
      .select("id, nome, parent_id, created_at")
      .is("deleted_at", null)
      .order("nome"),
    supabase
      .from("atividades")
      .select("id, titulo, subtitulo, pasta_id, status, created_at, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase.from("links").select("atividade_id"),
    supabase.from("aplicacoes").select("atividade_id, codigo"),
  ])

  const pastasVisiveis = pastasComRaizesVisiveis(pastas ?? [])
  const pastaAtual =
    pastaId === null
      ? null
      : (pastasVisiveis.find((pasta) => pasta.id === pastaId) ?? null)

  if (pastaId !== null && !pastaAtual) return null

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
  for (const atividade of atividades ?? []) {
    atividadesPorPasta.set(
      atividade.pasta_id,
      (atividadesPorPasta.get(atividade.pasta_id) ?? 0) + 1
    )
  }

  const pastasAtuais: ExplorerPasta[] = pastasVisiveis
    .filter((pasta) => pasta.parent_id === pastaId)
    .map((pasta) => ({
      ...pasta,
      pastaCount: pastasPorPai.get(pasta.id) ?? 0,
      atividadeCount: atividadesPorPasta.get(pasta.id) ?? 0,
    }))

  const todasAtividades: ExplorerAtividade[] = (atividades ?? []).map(
    (atividade) => ({
      ...atividade,
      links: linksPorAtividade.get(atividade.id) ?? 0,
      aplicacoes: aplicacoesPorAtividade.get(atividade.id) ?? [],
    })
  )

  const atividadesAtuais = todasAtividades.filter(
    (atividade) => atividade.pasta_id === pastaId
  )

  return {
    pastas: pastasVisiveis,
    pastasAtuais,
    todasAtividades,
    atividadesAtuais,
    breadcrumb: pastaBreadcrumb(pastasVisiveis, pastaId),
    pastaAtual,
  }
}
