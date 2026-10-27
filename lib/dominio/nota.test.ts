import { describe, expect, it } from "vitest"

import { formatarNota, parseNota } from "@/lib/dominio/nota"

const ERRO = "Nota inválida. Use vírgula para os decimais (ex.: 8,5)."

describe("parseNota", () => {
  it("trata campo vazio como nota ausente", () => {
    expect(parseNota("")).toEqual({ ok: true, valor: null })
    expect(parseNota("   ")).toEqual({ ok: true, valor: null })
  })

  it("aceita vírgula como separador decimal", () => {
    expect(parseNota("8,5")).toEqual({ ok: true, valor: 8.5 })
    expect(parseNota("8,55")).toEqual({ ok: true, valor: 8.55 })
  })

  it("aceita ponto como separador decimal", () => {
    expect(parseNota("8.5")).toEqual({ ok: true, valor: 8.5 })
  })

  it("aceita inteiros, inclusive zero", () => {
    expect(parseNota("10")).toEqual({ ok: true, valor: 10 })
    expect(parseNota("0")).toEqual({ ok: true, valor: 0 })
  })

  it("apara espaços em volta", () => {
    expect(parseNota(" 7 ")).toEqual({ ok: true, valor: 7 })
  })

  it("aceita vírgula sem casas decimais", () => {
    expect(parseNota("8,")).toEqual({ ok: true, valor: 8 })
  })

  it("recusa mais de duas casas decimais", () => {
    expect(parseNota("8,555")).toEqual({ ok: false, erro: ERRO })
  })

  it("recusa separador sem a parte inteira", () => {
    expect(parseNota(",5")).toEqual({ ok: false, erro: ERRO })
    expect(parseNota(".5")).toEqual({ ok: false, erro: ERRO })
  })

  it("recusa número negativo, texto e separador de milhar", () => {
    expect(parseNota("-1")).toEqual({ ok: false, erro: ERRO })
    expect(parseNota("abc")).toEqual({ ok: false, erro: ERRO })
    expect(parseNota("1.234,56")).toEqual({ ok: false, erro: ERRO })
    expect(parseNota("1e3")).toEqual({ ok: false, erro: ERRO })
  })
})

describe("formatarNota", () => {
  it("devolve string vazia para nota ausente", () => {
    expect(formatarNota(null)).toBe("")
  })

  it("usa vírgula para exibir a nota do banco", () => {
    expect(formatarNota(8.5)).toBe("8,5")
    expect(formatarNota(8.25)).toBe("8,25")
  })

  it("não acrescenta casas decimais em notas inteiras", () => {
    expect(formatarNota(10)).toBe("10")
    expect(formatarNota(0)).toBe("0")
  })
})
