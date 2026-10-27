import { describe, expect, it } from "vitest"

import {
  formatarData,
  formatarDataHora,
  formatarDataHoraLonga,
  formatarDataIso,
  hoje,
  TIME_ZONE,
} from "@/lib/format"

describe("formatarData", () => {
  it("formata a coluna `date` no padrão brasileiro", () => {
    expect(formatarData("2026-10-27")).toBe("27/10/2026")
  })

  it("devolve travessão para data ausente", () => {
    expect(formatarData(null)).toBe("—")
  })
})

describe("formatarDataIso", () => {
  it("formata um timestamp curto", () => {
    expect(formatarDataIso("2026-10-27T23:30:00Z")).toBe("27/10/2026")
  })

  it("usa o fuso da escola, não o do servidor", () => {
    // 02:00 UTC de 28/10 ainda é 27/10 em São Paulo.
    expect(formatarDataIso("2026-10-28T02:00:00Z")).toBe("27/10/2026")
  })

  it("devolve travessão para data ausente", () => {
    expect(formatarDataIso(null)).toBe("—")
  })
})

describe("formatarDataHora", () => {
  it("mostra data e hora no fuso da escola", () => {
    expect(formatarDataHora("2026-10-27T23:30:00Z")).toBe("27/10/2026, 20:30")
  })

  it("devolve travessão para data ausente", () => {
    expect(formatarDataHora(null)).toBe("—")
  })
})

describe("formatarDataHoraLonga", () => {
  it("usa o mês por extenso no tooltip do explorador", () => {
    expect(formatarDataHoraLonga("2026-10-27T23:30:00Z")).toBe(
      "27 de outubro de 2026 às 20:30"
    )
  })

  it("devolve travessão para data ausente", () => {
    expect(formatarDataHoraLonga(null)).toBe("—")
  })
})

describe("hoje", () => {
  it("devolve a data de hoje no formato do banco (yyyy-MM-dd)", () => {
    expect(hoje()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("usa o fuso da escola", () => {
    expect(hoje()).toBe(
      new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE })
    )
  })
})
