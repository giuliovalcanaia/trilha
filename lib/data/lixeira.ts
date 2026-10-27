import type { SupabaseClient } from "@/lib/supabase/server"

export type TrashGroup = {
  trashId: string
  tipo: "pasta" | "atividade"
  id: number
  nome: string
  deletedAt: string
  pastaCount: number
  atividadeCount: number
  origem: string
}

type PastaTrashRow = {
  id: number
  nome: string
  parent_id: number | null
  deleted_at: string | null
  trash_id: string | null
}

type AtividadeTrashRow = {
  id: number
  titulo: string
  pasta_id: number | null
  deleted_at: string | null
  trash_id: string | null
}

/**
 * Agrupa a lixeira pelo trash_id. Cada grupo mostra apenas o item raiz
 * (a pasta excluída ou a atividade excluída sozinha).
 */
export async function loadTrash(
  supabase: SupabaseClient
): Promise<TrashGroup[]> {
  const [
    { data: pastas, error: pastasError },
    { data: atividades, error: atividadesError },
  ] = await Promise.all([
    supabase.from("pastas").select("id, nome, parent_id, deleted_at, trash_id"),
    supabase
      .from("atividades")
      .select("id, titulo, pasta_id, deleted_at, trash_id"),
  ])

  if (pastasError || atividadesError) {
    throw new Error("trash_lookup_failed")
  }

  const todasPastas = (pastas ?? []) as PastaTrashRow[]
  const todasAtividades = (atividades ?? []) as AtividadeTrashRow[]
  const pastaPorId = new Map(todasPastas.map((pasta) => [pasta.id, pasta]))

  const pastasPorTrash = new Map<string, PastaTrashRow[]>()
  const atividadesPorTrash = new Map<string, AtividadeTrashRow[]>()

  for (const pasta of todasPastas) {
    if (!pasta.trash_id) continue
    const lista = pastasPorTrash.get(pasta.trash_id) ?? []
    lista.push(pasta)
    pastasPorTrash.set(pasta.trash_id, lista)
  }

  for (const atividade of todasAtividades) {
    if (!atividade.trash_id) continue
    const lista = atividadesPorTrash.get(atividade.trash_id) ?? []
    lista.push(atividade)
    atividadesPorTrash.set(atividade.trash_id, lista)
  }

  const trashIds = new Set([
    ...pastasPorTrash.keys(),
    ...atividadesPorTrash.keys(),
  ])
  const grupos: TrashGroup[] = []

  for (const trashId of trashIds) {
    const pastasDoGrupo = pastasPorTrash.get(trashId) ?? []
    const atividadesDoGrupo = atividadesPorTrash.get(trashId) ?? []

    const pastaRaiz =
      pastasDoGrupo.find((pasta) => {
        if (pasta.parent_id === null) return true
        const pai = pastaPorId.get(pasta.parent_id)
        return !pai || pai.trash_id !== trashId
      }) ?? null

    const atividadeRaiz =
      atividadesDoGrupo.find((atividade) => {
        if (atividade.pasta_id === null) return true
        const pasta = pastaPorId.get(atividade.pasta_id)
        return !pasta || pasta.trash_id !== trashId
      }) ?? null

    if (!pastaRaiz && !atividadeRaiz) continue

    if (pastaRaiz) {
      const pai = pastaRaiz.parent_id
        ? pastaPorId.get(pastaRaiz.parent_id)
        : null

      grupos.push({
        trashId,
        tipo: "pasta",
        id: pastaRaiz.id,
        nome: pastaRaiz.nome,
        deletedAt: pastaRaiz.deleted_at ?? new Date(0).toISOString(),
        pastaCount: Math.max(pastasDoGrupo.length - 1, 0),
        atividadeCount: atividadesDoGrupo.length,
        origem: pai?.nome ?? "Início",
      })
      continue
    }

    if (atividadeRaiz) {
      const pasta = atividadeRaiz.pasta_id
        ? pastaPorId.get(atividadeRaiz.pasta_id)
        : null

      grupos.push({
        trashId,
        tipo: "atividade",
        id: atividadeRaiz.id,
        nome: atividadeRaiz.titulo,
        deletedAt: atividadeRaiz.deleted_at ?? new Date(0).toISOString(),
        pastaCount: 0,
        atividadeCount: 1,
        origem: pasta?.nome ?? "Início",
      })
    }
  }

  return grupos.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  )
}
