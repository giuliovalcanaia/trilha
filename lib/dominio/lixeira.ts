import { normalizarBusca } from "@/lib/dominio/busca"

/**
 * Item da lixeira: a raiz de um grupo de exclusão (a pasta que foi para a
 * lixeira ou a atividade excluída sozinha).
 *
 * Vive no domínio, e não em `lib/data/lixeira.ts`, porque a busca e a ordenação
 * são regras puras — do mesmo jeito que `PastaRow` mora em
 * `lib/dominio/pastas.ts`.
 */
export type ItemLixeira = {
  trashId: string
  tipo: "pasta" | "atividade"
  id: number
  nome: string
  deletedAt: string
  pastaCount: number
  atividadeCount: number
  origem: string
}

export const ORDENS_LIXEIRA = [
  "movido-desc",
  "movido-asc",
  "nome-asc",
  "nome-desc",
] as const

export type OrdemLixeira = (typeof ORDENS_LIXEIRA)[number]

function compararNome(a: ItemLixeira, b: ItemLixeira) {
  return a.nome.localeCompare(b.nome, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  })
}

/** `deletedAt` inválido cai em 1970, como o fallback de `loadTrash`. */
function movidoEm(item: ItemLixeira) {
  const tempo = Date.parse(item.deletedAt)
  return Number.isNaN(tempo) ? 0 : tempo
}

export function ordenarLixeira(
  itens: ItemLixeira[],
  ordem: OrdemLixeira
): ItemLixeira[] {
  const ordenados = [...itens]

  switch (ordem) {
    case "nome-asc":
      return ordenados.sort(compararNome)
    case "nome-desc":
      return ordenados.sort((a, b) => compararNome(b, a))
    case "movido-asc":
      return ordenados.sort((a, b) => movidoEm(a) - movidoEm(b))
    default:
      return ordenados.sort((a, b) => movidoEm(b) - movidoEm(a))
  }
}

/**
 * Busca pelo nome do item **e** pela pasta de origem, sem acento. Assim
 * “aulas” encontra tanto a pasta “Aulas de 2026” quanto o que estava dentro
 * dela.
 */
export function filtrarLixeira(
  itens: ItemLixeira[],
  termo: string
): ItemLixeira[] {
  const busca = normalizarBusca(termo.trim())
  if (!busca) return itens

  return itens.filter((item) =>
    normalizarBusca(`${item.nome} ${item.origem}`).includes(busca)
  )
}
