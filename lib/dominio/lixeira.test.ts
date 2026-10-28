import { describe, expect, it } from "vitest"

import {
  filtrarLixeira,
  ordenarLixeira,
  type ItemLixeira,
} from "@/lib/dominio/lixeira"

function item(overrides: Partial<ItemLixeira> & { trashId: string }) {
  return {
    tipo: "pasta",
    id: 1,
    nome: "Sem nome",
    deletedAt: "2026-10-01T12:00:00.000Z",
    pastaCount: 0,
    atividadeCount: 0,
    origem: "Início",
    ...overrides,
  } satisfies ItemLixeira
}

const itens = [
  item({
    trashId: "a",
    id: 1,
    nome: "Aulas de Inglês",
    deletedAt: "2026-10-01T12:00:00.000Z",
    origem: "Início",
  }),
  item({
    trashId: "b",
    id: 2,
    tipo: "atividade",
    nome: "Daily Routines",
    deletedAt: "2026-10-20T12:00:00.000Z",
    origem: "Aulas de Inglês",
  }),
  item({
    trashId: "c",
    id: 3,
    nome: "Aula 2",
    deletedAt: "2026-09-10T12:00:00.000Z",
    origem: "Turma 2026",
  }),
]

describe("ordenarLixeira", () => {
  it("ordena por data de exclusão, mais recente primeiro, por padrão", () => {
    expect(ordenarLixeira(itens, "movido-desc").map((i) => i.trashId)).toEqual([
      "b",
      "a",
      "c",
    ])
  })

  it("ordena por data de exclusão, mais antigo primeiro", () => {
    expect(ordenarLixeira(itens, "movido-asc").map((i) => i.trashId)).toEqual([
      "c",
      "a",
      "b",
    ])
  })

  it("ordena por nome no locale pt-BR e entende números", () => {
    expect(ordenarLixeira(itens, "nome-asc").map((i) => i.nome)).toEqual([
      "Aula 2",
      "Aulas de Inglês",
      "Daily Routines",
    ])
    expect(ordenarLixeira(itens, "nome-desc").map((i) => i.nome)).toEqual([
      "Daily Routines",
      "Aulas de Inglês",
      "Aula 2",
    ])
  })

  it("não muta a lista recebida", () => {
    const original = [...itens]
    ordenarLixeira(itens, "nome-asc")
    expect(itens).toEqual(original)
  })

  it("trata data inválida como o mais antigo", () => {
    const comDataRuim = [
      ...itens,
      item({ trashId: "d", nome: "Quebrada", deletedAt: "nem data" }),
    ]
    expect(ordenarLixeira(comDataRuim, "movido-asc")[0].trashId).toBe("d")
    expect(ordenarLixeira(comDataRuim, "movido-desc").at(-1)?.trashId).toBe("d")
  })
})

describe("filtrarLixeira", () => {
  it("devolve tudo quando o termo está vazio", () => {
    expect(filtrarLixeira(itens, "")).toHaveLength(3)
    expect(filtrarLixeira(itens, "   ")).toHaveLength(3)
  })

  it("busca pelo nome sem acento e sem caixa", () => {
    expect(filtrarLixeira(itens, "daily").map((i) => i.trashId)).toEqual(["b"])
    expect(filtrarLixeira(itens, "AULA 2").map((i) => i.trashId)).toEqual(["c"])
  })

  it("busca também pela pasta de origem", () => {
    // "Aulas de Inglês" casa pelo nome e "Daily Routines" pela origem.
    expect(filtrarLixeira(itens, "ingles").map((i) => i.trashId)).toEqual([
      "a",
      "b",
    ])
    expect(filtrarLixeira(itens, "turma 2026").map((i) => i.trashId)).toEqual([
      "c",
    ])
  })

  it("devolve lista vazia quando nada casa", () => {
    expect(filtrarLixeira(itens, "matemática")).toEqual([])
  })
})
