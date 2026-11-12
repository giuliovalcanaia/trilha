import { z } from "zod"

import {
  pastaDescendantIds,
  type AtividadePastaRow,
  type PastaRow,
} from "@/lib/dominio/pastas"
import { separarChaves } from "@/lib/dominio/selecao"

export const MODOS_TRANSFERENCIA = ["copiar", "recortar"] as const

export type ModoTransferencia = (typeof MODOS_TRANSFERENCIA)[number]

export type ItensTransferencia = {
  pastas: number[]
  atividades: number[]
}

export const colarSchema = z.object({
  modo: z.enum(MODOS_TRANSFERENCIA),
  pastas: z.array(z.number().int().positive()).max(500),
  atividades: z.array(z.number().int().positive()).max(500),
  destino: z.number().int().positive().nullable(),
})

export type ColarInput = z.infer<typeof colarSchema>

export function totalDeItens(itens: ItensTransferencia) {
  return itens.pastas.length + itens.atividades.length
}

/**
 * Reduz a seleção às raízes.
 *
 * Selecionar uma pasta já inclui as subpastas dela em `selecionados`; copiar
 * ou mover a pasta e os filhos separadamente duplicaria a árvore. O mesmo vale
 * para uma atividade cuja pasta também está selecionada.
 */
export function itensRaiz(
  keys: Iterable<string>,
  pastas: PastaRow[],
  atividades: AtividadePastaRow[]
): ItensTransferencia {
  const { pastas: idsPastas, atividades: idsAtividades } = separarChaves(keys)

  const pastasPorId = new Map(pastas.map((pasta) => [pasta.id, pasta]))
  const pastaDaAtividade = new Map(
    atividades.map((atividade) => [atividade.id, atividade.pasta_id])
  )

  const selecionadas = new Set(idsPastas)

  function temAncestralSelecionado(pastaId: number | null) {
    const visitadas = new Set<number>()
    let atual = pastaId

    while (atual !== null && !visitadas.has(atual)) {
      if (selecionadas.has(atual)) return true

      visitadas.add(atual)
      atual = pastasPorId.get(atual)?.parent_id ?? null
    }

    return false
  }

  return {
    pastas: idsPastas
      .filter((id) => pastasPorId.has(id))
      .filter((id) => !temAncestralSelecionado(pastasPorId.get(id)!.parent_id))
      .sort((a, b) => a - b),
    atividades: idsAtividades
      .filter((id) => pastaDaAtividade.has(id))
      .filter(
        (id) => !temAncestralSelecionado(pastaDaAtividade.get(id) ?? null)
      )
      .sort((a, b) => a - b),
  }
}

/**
 * Motivo pelo qual o destino não aceita a colagem, ou `null` quando pode.
 *
 * Só o recorte tem restrição: mover uma pasta para dentro dela mesma (ou de
 * uma subpasta) criaria um ciclo. Copiar para dentro da própria pasta é
 * válido, porque a cópia é uma árvore nova.
 */
export function destinoBloqueado(
  itens: ItensTransferencia,
  modo: ModoTransferencia,
  destino: number | null,
  pastas: PastaRow[]
): string | null {
  if (modo !== "recortar" || destino === null) return null

  for (const pastaId of itens.pastas) {
    if (pastaDescendantIds(pastas, pastaId).has(destino)) {
      return "Não é possível colar uma pasta dentro dela mesma."
    }
  }

  return null
}

export function rotuloTransferencia(
  modo: ModoTransferencia,
  total: number
): string {
  const acao = modo === "copiar" ? "copiado" : "recortado"

  return total === 1 ? `1 item ${acao}.` : `${total} itens ${acao}s.`
}
