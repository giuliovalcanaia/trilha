import { describe, expect, it } from "vitest"

import { CONEXAO_TTL_MS, conexaoAtiva } from "./conexao"

const AGORA = Date.parse("2026-11-12T12:00:00.000Z")
const iso = (deslocamento: number) =>
  new Date(AGORA + deslocamento).toISOString()

const base = {
  conexao_estudante_id: 7,
  conexao_em: iso(0),
  desconexao_agendada_em: null,
}

describe("conexaoAtiva", () => {
  it("vale com batimento recente", () => {
    expect(conexaoAtiva(base, AGORA)).toBe(true)
  })

  it("exige um aluno conectado", () => {
    expect(conexaoAtiva({ ...base, conexao_estudante_id: null }, AGORA)).toBe(
      false
    )
  })

  it("expira quando o batimento passa da janela", () => {
    expect(
      conexaoAtiva({ ...base, conexao_em: iso(-CONEXAO_TTL_MS) }, AGORA)
    ).toBe(false)
    expect(
      conexaoAtiva({ ...base, conexao_em: iso(-CONEXAO_TTL_MS + 1000) }, AGORA)
    ).toBe(true)
  })

  it("recusa batimento ausente ou inválido", () => {
    expect(conexaoAtiva({ ...base, conexao_em: null }, AGORA)).toBe(false)
    expect(conexaoAtiva({ ...base, conexao_em: "ontem" }, AGORA)).toBe(false)
  })

  it("libera depois da saída agendada", () => {
    expect(
      conexaoAtiva({ ...base, desconexao_agendada_em: iso(-1) }, AGORA)
    ).toBe(false)
    expect(
      conexaoAtiva({ ...base, desconexao_agendada_em: iso(1) }, AGORA)
    ).toBe(true)
  })

  it("ignora uma saída agendada inválida", () => {
    expect(conexaoAtiva({ ...base, desconexao_agendada_em: "??" }, AGORA)).toBe(
      true
    )
  })
})
