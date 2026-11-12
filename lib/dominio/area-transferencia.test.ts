import { describe, expect, it } from "vitest"

import {
  destinoBloqueado,
  itensRaiz,
  rotuloTransferencia,
  totalDeItens,
} from "@/lib/dominio/area-transferencia"

const pastas = [
  { id: 1, nome: "Aulas", parent_id: null },
  { id: 2, nome: "2026", parent_id: 1 },
  { id: 3, nome: "2025", parent_id: 1 },
  { id: 4, nome: "Outra", parent_id: null },
]

const atividades = [
  { id: 10, pasta_id: 1 },
  { id: 11, pasta_id: 2 },
  { id: 12, pasta_id: 4 },
  { id: 13, pasta_id: null },
]

describe("itensRaiz", () => {
  it("mantém só a pasta quando os descendentes também estão selecionados", () => {
    expect(
      itensRaiz(
        ["pasta-1", "pasta-2", "atividade-10", "atividade-11"],
        pastas,
        atividades
      )
    ).toEqual({ pastas: [1], atividades: [] })
  })

  it("mantém atividades fora das pastas selecionadas", () => {
    expect(
      itensRaiz(["pasta-1", "atividade-12", "atividade-13"], pastas, atividades)
    ).toEqual({ pastas: [1], atividades: [12, 13] })
  })

  it("mantém itens de ramos diferentes, em ordem", () => {
    expect(
      itensRaiz(
        ["atividade-13", "pasta-2", "pasta-4", "atividade-12"],
        pastas,
        atividades
      )
    ).toEqual({ pastas: [2, 4], atividades: [13] })
  })

  it("ignora chaves de itens que não existem mais", () => {
    expect(
      itensRaiz(["pasta-99", "atividade-99", "pasta-1"], pastas, atividades)
    ).toEqual({ pastas: [1], atividades: [] })
  })

  it("devolve listas vazias para seleção vazia", () => {
    expect(itensRaiz([], pastas, atividades)).toEqual({
      pastas: [],
      atividades: [],
    })
  })
})

describe("destinoBloqueado", () => {
  const itens = { pastas: [1], atividades: [] }

  it("bloqueia mover uma pasta para dentro dela mesma", () => {
    expect(destinoBloqueado(itens, "recortar", 1, pastas)).toBe(
      "Não é possível colar uma pasta dentro dela mesma."
    )
  })

  it("bloqueia mover uma pasta para uma subpasta dela", () => {
    expect(destinoBloqueado(itens, "recortar", 2, pastas)).toBe(
      "Não é possível colar uma pasta dentro dela mesma."
    )
  })

  it("libera copiar a pasta para dentro dela mesma", () => {
    expect(destinoBloqueado(itens, "copiar", 2, pastas)).toBeNull()
  })

  it("libera mover para uma pasta fora da árvore", () => {
    expect(destinoBloqueado(itens, "recortar", 4, pastas)).toBeNull()
  })

  it("libera a raiz", () => {
    expect(destinoBloqueado(itens, "recortar", null, pastas)).toBeNull()
  })
})

describe("rotuloTransferencia", () => {
  it("usa singular e plural", () => {
    expect(rotuloTransferencia("copiar", 1)).toBe("1 item copiado.")
    expect(rotuloTransferencia("copiar", 3)).toBe("3 itens copiados.")
    expect(rotuloTransferencia("recortar", 1)).toBe("1 item recortado.")
    expect(rotuloTransferencia("recortar", 2)).toBe("2 itens recortados.")
  })
})

describe("totalDeItens", () => {
  it("soma pastas e atividades", () => {
    expect(totalDeItens({ pastas: [1, 2], atividades: [3] })).toBe(3)
    expect(totalDeItens({ pastas: [], atividades: [] })).toBe(0)
  })
})
