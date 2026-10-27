import { describe, expect, it } from "vitest"

import {
  flattenPastas,
  flattenPastasVisiveis,
  pastaBreadcrumb,
  pastaDescendantIds,
  pastasComRaizesVisiveis,
  type PastaRow,
} from "@/lib/dominio/pastas"

const pastas: PastaRow[] = [
  { id: 1, nome: "Raiz", parent_id: null },
  { id: 2, nome: "Filho B", parent_id: 1 },
  { id: 3, nome: "Filho A", parent_id: 1 },
  { id: 4, nome: "Neto", parent_id: 2 },
  { id: 5, nome: "Outra raiz", parent_id: null },
]

describe("flattenPastas", () => {
  it("lista a árvore em ordem alfabética com a profundidade de cada pasta", () => {
    expect(flattenPastas(pastas)).toEqual([
      { id: 5, nome: "Outra raiz", depth: 0 },
      { id: 1, nome: "Raiz", depth: 0 },
      { id: 3, nome: "Filho A", depth: 1 },
      { id: 2, nome: "Filho B", depth: 1 },
      { id: 4, nome: "Neto", depth: 2 },
    ])
  })

  it("ignora linhas repetidas da mesma pasta", () => {
    const comDuplicata = [...pastas, { id: 2, nome: "Filho B", parent_id: 1 }]

    expect(flattenPastas(comDuplicata).map((pasta) => pasta.id)).toEqual([
      5, 1, 3, 2, 4,
    ])
  })

  it("devolve lista vazia quando não há pastas", () => {
    expect(flattenPastas([])).toEqual([])
  })
})

describe("flattenPastasVisiveis", () => {
  it("mostra só as raízes quando nenhuma pasta está expandida", () => {
    expect(flattenPastasVisiveis(pastas, new Set()).map((p) => p.id)).toEqual([
      5, 1,
    ])
  })

  it("mostra os filhos diretos das pastas expandidas", () => {
    expect(
      flattenPastasVisiveis(pastas, new Set([1])).map((p) => p.id)
    ).toEqual([5, 1, 3, 2])
  })

  it("desce mais um nível quando o filho também está expandido", () => {
    expect(
      flattenPastasVisiveis(pastas, new Set([1, 2])).map((p) => p.id)
    ).toEqual([5, 1, 3, 2, 4])
  })
})

describe("pastaBreadcrumb", () => {
  it("devolve vazio para a raiz do explorador", () => {
    expect(pastaBreadcrumb(pastas, null)).toEqual([])
  })

  it("devolve o caminho da raiz até a pasta", () => {
    expect(pastaBreadcrumb(pastas, 4).map((pasta) => pasta.id)).toEqual([
      1, 2, 4,
    ])
  })

  it("devolve vazio para pasta desconhecida", () => {
    expect(pastaBreadcrumb(pastas, 99)).toEqual([])
  })

  it("para em um ciclo em vez de girar para sempre", () => {
    const emCiclo: PastaRow[] = [
      { id: 1, nome: "A", parent_id: 2 },
      { id: 2, nome: "B", parent_id: 1 },
    ]

    expect(pastaBreadcrumb(emCiclo, 1).map((pasta) => pasta.id)).toEqual([2, 1])
  })
})

describe("pastaDescendantIds", () => {
  it("inclui a própria pasta e todas as subpastas", () => {
    expect([...pastaDescendantIds(pastas, 1)].sort()).toEqual([1, 2, 3, 4])
  })

  it("devolve só a pasta quando ela não tem subpastas", () => {
    expect([...pastaDescendantIds(pastas, 5)]).toEqual([5])
  })

  it("devolve só o id informado quando a pasta não está na lista", () => {
    expect([...pastaDescendantIds(pastas, 99)]).toEqual([99])
  })
})

describe("pastasComRaizesVisiveis", () => {
  it("trata como raiz a pasta cujo pai não está visível", () => {
    const compartilhada: PastaRow[] = [
      { id: 2, nome: "Subpasta compartilhada", parent_id: 1 },
    ]

    expect(pastasComRaizesVisiveis(compartilhada)).toEqual([
      { id: 2, nome: "Subpasta compartilhada", parent_id: null },
    ])
  })

  it("mantém o pai quando ele está na lista", () => {
    expect(pastasComRaizesVisiveis(pastas)).toEqual(pastas)
  })

  it("não altera o array recebido", () => {
    const original: PastaRow[] = [{ id: 2, nome: "Subpasta", parent_id: 1 }]

    pastasComRaizesVisiveis(original)

    expect(original[0].parent_id).toBe(1)
  })
})
