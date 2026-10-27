import { describe, expect, it } from "vitest"

import { intervalo, itemKey, separarChaves } from "@/lib/dominio/selecao"

describe("itemKey", () => {
  it("prefixa a chave com o tipo do item", () => {
    expect(itemKey({ tipo: "pasta", id: 1 })).toBe("pasta-1")
    expect(itemKey({ tipo: "atividade", id: 42 })).toBe("atividade-42")
  })
})

describe("intervalo", () => {
  const chaves = ["pasta-1", "pasta-2", "atividade-3", "pasta-4"]

  it("devolve os itens entre as duas chaves, inclusive", () => {
    expect(intervalo(chaves, "pasta-2", "pasta-4")).toEqual([
      "pasta-2",
      "atividade-3",
      "pasta-4",
    ])
  })

  it("funciona com Shift para cima (fim antes do início)", () => {
    expect(intervalo(chaves, "pasta-4", "pasta-2")).toEqual([
      "pasta-2",
      "atividade-3",
      "pasta-4",
    ])
  })

  it("devolve só o item final quando uma das chaves não existe", () => {
    expect(intervalo(chaves, "pasta-9", "pasta-2")).toEqual(["pasta-2"])
  })

  it("devolve uma chave quando é o mesmo item", () => {
    expect(intervalo(chaves, "pasta-2", "pasta-2")).toEqual(["pasta-2"])
  })
})

describe("separarChaves", () => {
  it("separa ids de pastas e de atividades", () => {
    expect(
      separarChaves(["pasta-1", "atividade-2", "pasta-10", "atividade-20"])
    ).toEqual({ pastas: [1, 10], atividades: [2, 20] })
  })

  it("aceita qualquer iterável de chaves", () => {
    expect(separarChaves(new Set(["pasta-3"]))).toEqual({
      pastas: [3],
      atividades: [],
    })
  })

  it("ignora chaves inválidas ou com id não positivo", () => {
    expect(
      separarChaves([
        "pasta-abc",
        "pasta-0",
        "pasta--1",
        "desconhecido-5",
        "atividade-",
        "atividade-7",
      ])
    ).toEqual({ pastas: [], atividades: [7] })
  })

  it("devolve listas vazias para seleção vazia", () => {
    expect(separarChaves([])).toEqual({ pastas: [], atividades: [] })
  })
})
