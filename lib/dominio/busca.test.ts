import { describe, expect, it } from "vitest"

import { normalizarBusca } from "@/lib/dominio/busca"

describe("normalizarBusca", () => {
  it("remove acentos e baixa a caixa", () => {
    expect(normalizarBusca("Aulas de Inglês")).toBe("aulas de ingles")
    expect(normalizarBusca("AÇÃO")).toBe("acao")
  })

  it("preserva pontuação e espaços", () => {
    expect(normalizarBusca("  Turma 2026? ")).toBe("  turma 2026? ")
  })

  it("devolve string vazia para entrada vazia", () => {
    expect(normalizarBusca("")).toBe("")
  })
})
