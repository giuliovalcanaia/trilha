import { describe, expect, it } from "vitest"

import { ordenarLinksDoAluno } from "@/lib/dominio/ordem-links"

const links = [{ id: 1 }, { id: 2 }, { id: 3 }]

describe("ordenarLinksDoAluno", () => {
  it("mantém a ordem canônica quando ninguém foi embaralhado", () => {
    const progresso = [
      { link_id: 1, ordem_embaralhada: null },
      { link_id: 2, ordem_embaralhada: null },
      { link_id: 3, ordem_embaralhada: null },
    ]

    expect(ordenarLinksDoAluno(links, progresso)).toEqual(links)
  })

  it("mantém a ordem canônica quando não há progresso", () => {
    expect(ordenarLinksDoAluno(links, [])).toEqual(links)
  })

  it("usa a posição sorteada de cada link", () => {
    const progresso = [
      { link_id: 1, ordem_embaralhada: 3 },
      { link_id: 2, ordem_embaralhada: 1 },
      { link_id: 3, ordem_embaralhada: 2 },
    ]

    expect(ordenarLinksDoAluno(links, progresso)).toEqual([
      { id: 2 },
      { id: 3 },
      { id: 1 },
    ])
  })

  it("joga para o fim os links sem posição sorteada", () => {
    const progresso = [
      { link_id: 1, ordem_embaralhada: 2 },
      { link_id: 2, ordem_embaralhada: null },
      { link_id: 3, ordem_embaralhada: 1 },
    ]

    expect(ordenarLinksDoAluno(links, progresso)).toEqual([
      { id: 3 },
      { id: 1 },
      { id: 2 },
    ])
  })

  it("considera apenas as linhas do progresso recebido", () => {
    // A participação só tem progresso do link 3: os outros continuam na ordem
    // canônica depois dele.
    const progresso = [{ link_id: 3, ordem_embaralhada: 1 }]

    expect(ordenarLinksDoAluno(links, progresso)).toEqual([
      { id: 3 },
      { id: 1 },
      { id: 2 },
    ])
  })

  it("não altera o array original", () => {
    const original = [{ id: 1 }, { id: 2 }]
    const progresso = [
      { link_id: 1, ordem_embaralhada: 2 },
      { link_id: 2, ordem_embaralhada: 1 },
    ]

    ordenarLinksDoAluno(original, progresso)

    expect(original).toEqual([{ id: 1 }, { id: 2 }])
  })
})
