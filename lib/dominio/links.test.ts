import { describe, expect, it } from "vitest"

import {
  MAX_LINKS_POR_ATIVIDADE,
  normalizeHttpUrl,
  parseLinkList,
} from "@/lib/dominio/links"

describe("normalizeHttpUrl", () => {
  it("assume https quando o professor digita só o domínio", () => {
    expect(normalizeHttpUrl("google.com")).toBe("https://google.com/")
    expect(normalizeHttpUrl("www.google.com/exercicio")).toBe(
      "https://www.google.com/exercicio"
    )
  })

  it("preserva caminho, query e hash de uma URL completa", () => {
    expect(normalizeHttpUrl("https://google.com/a?b=1#c")).toBe(
      "https://google.com/a?b=1#c"
    )
  })

  it("apara espaços e normaliza host em maiúsculas", () => {
    expect(normalizeHttpUrl("  Google.COM  ")).toBe("https://google.com/")
  })

  it("normaliza o esquema já informado sem trocar por https", () => {
    expect(normalizeHttpUrl("HTTP://Example.com")).toBe("http://example.com/")
  })

  it("mantém porta sem esquema como endereço, não como protocolo", () => {
    expect(normalizeHttpUrl("localhost:3000")).toBe("https://localhost:3000/")
    expect(normalizeHttpUrl("exemplo.com:8080/caminho")).toBe(
      "https://exemplo.com:8080/caminho"
    )
  })

  it("devolve null para entrada vazia", () => {
    expect(normalizeHttpUrl("")).toBeNull()
    expect(normalizeHttpUrl("   ")).toBeNull()
  })

  it("devolve null para esquemas que não são http(s)", () => {
    expect(normalizeHttpUrl("ftp://x.com")).toBeNull()
    expect(normalizeHttpUrl("mailto:a@b.com")).toBeNull()
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeHttpUrl("file:///etc/passwd")).toBeNull()
  })

  it("devolve null quando não dá para montar a URL", () => {
    expect(normalizeHttpUrl("https://")).toBeNull()
  })
})

describe("parseLinkList", () => {
  it("devolve lista vazia para texto vazio", () => {
    expect(parseLinkList("")).toEqual({ ok: true, links: [] })
    expect(parseLinkList("  \n\n  ")).toEqual({ ok: true, links: [] })
  })

  it("ignora linhas em branco e marcadores de lista na ordem do texto", () => {
    const resultado = parseLinkList(
      [
        "google.com",
        "",
        "- www.uol.com.br",
        "* https://g1.globo.com",
        "• exemplo.org",
        "1. a.com",
        "2) b.com",
      ].join("\n")
    )

    expect(resultado).toEqual({
      ok: true,
      links: [
        "https://google.com/",
        "https://www.uol.com.br/",
        "https://g1.globo.com/",
        "https://exemplo.org/",
        "https://a.com/",
        "https://b.com/",
      ],
    })
  })

  it("aceita quebras de linha do Windows e remove duplicados", () => {
    const resultado = parseLinkList(
      "google.com\r\ngoogle.com/\r\nGOOGLE.com\r\n"
    )

    expect(resultado).toEqual({ ok: true, links: ["https://google.com/"] })
  })

  it("aponta a linha inválida no erro", () => {
    const resultado = parseLinkList("google.com\nnao-e-url\nexemplo.org")

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.error).toContain("Linha 2")
    expect(resultado.error).toContain("nao-e-url")
  })

  it("aceita localhost e IPv4 com porta", () => {
    expect(parseLinkList("localhost:3000\nhttp://127.0.0.1:3000")).toEqual({
      ok: true,
      links: ["https://localhost:3000/", "http://127.0.0.1:3000/"],
    })
  })

  it(`recusa mais de ${MAX_LINKS_POR_ATIVIDADE} links`, () => {
    const muitos = Array.from(
      { length: MAX_LINKS_POR_ATIVIDADE + 1 },
      (_, indice) => `site${indice}.com`
    ).join("\n")

    const resultado = parseLinkList(muitos)

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.error).toContain(String(MAX_LINKS_POR_ATIVIDADE))
  })

  it("aceita exatamente o limite de links", () => {
    const limite = Array.from(
      { length: MAX_LINKS_POR_ATIVIDADE },
      (_, indice) => `site${indice}.com`
    ).join("\n")

    const resultado = parseLinkList(limite)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.links).toHaveLength(MAX_LINKS_POR_ATIVIDADE)
  })
})
