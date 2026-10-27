import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fallbackLinkTitle,
  isPrivateHostname,
  lookupLinkPreview,
  lookupLinkTitles,
} from "@/lib/link-preview"

function respostaHtml(html: string) {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

function stubFetch(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
) {
  const spy = vi.fn(impl)
  vi.stubGlobal("fetch", spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("isPrivateHostname", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "localhost.",
    "app.localhost",
    "impressora.local",
    "servico.internal",
    "[::1]",
    "0.0.0.0",
    "10.1.2.3",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.1",
    "100.64.0.1",
    "198.18.0.1",
  ])("bloqueia %s", (host) => {
    expect(isPrivateHostname(host)).toBe(true)
  })

  it.each(["google.com", "8.8.8.8", "172.32.0.1", "192.169.0.1"])(
    "libera %s",
    (host) => {
      expect(isPrivateHostname(host)).toBe(false)
    }
  )
})

describe("lookupLinkPreview", () => {
  it("não busca páginas em hosts privados", async () => {
    const fetchSpy = stubFetch(async () => respostaHtml("<title>nunca</title>"))

    const resultado = await lookupLinkPreview("http://127.0.0.1:3000/admin")

    expect(resultado).toEqual({
      title: null,
      description: null,
      error: "invalid_url",
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("recusa URL inválida sem chamar fetch", async () => {
    const fetchSpy = stubFetch(async () => respostaHtml("<title>nunca</title>"))

    const resultado = await lookupLinkPreview("javascript:alert(1)")

    expect(resultado.error).toBe("invalid_url")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("lê title e description, limpando espaços e entidades", async () => {
    stubFetch(async () =>
      respostaHtml(`
        <html>
          <head>
            <title>  Aula  de   Inglês &amp; Cia  </title>
            <meta name="description" content="Texto   com   espaços">
          </head>
        </html>
      `)
    )

    await expect(lookupLinkPreview("https://example.com")).resolves.toEqual({
      title: "Aula de Inglês & Cia",
      description: "Texto com espaços",
      error: null,
    })
  })

  it("cai para og:title e og:description quando necessário", async () => {
    stubFetch(async () =>
      respostaHtml(`
        <meta property="og:title" content="Open Graph">
        <meta property="og:description" content="Descrição OG">
        <meta name="description" content="Descrição comum">
      `)
    )

    await expect(lookupLinkPreview("https://example.com")).resolves.toEqual({
      title: "Open Graph",
      description: "Descrição OG",
      error: null,
    })
  })

  it("decodifica entidades numéricas e mantém as desconhecidas", async () => {
    stubFetch(async () =>
      respostaHtml("<title>&#x27;Oi&#39; &foo; &nbsp;tudo bem</title>")
    )

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.title).toBe("'Oi' &foo; tudo bem")
  })

  it("ignora comentários HTML", async () => {
    stubFetch(async () =>
      respostaHtml("<!-- <title>Comentado</title> --><title>De verdade</title>")
    )

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.title).toBe("De verdade")
  })

  it("limita o tamanho do título e da descrição", async () => {
    stubFetch(async () =>
      respostaHtml(`
        <title>${"t".repeat(200)}</title>
        <meta name="description" content="${"d".repeat(400)}">
      `)
    )

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.title).toHaveLength(140)
    expect(resultado.description).toHaveLength(300)
  })

  it("recusa conteúdo que não é HTML", async () => {
    stubFetch(
      async () =>
        new Response("%PDF-1.4", {
          status: 200,
          headers: { "content-type": "application/pdf" },
        })
    )

    await expect(lookupLinkPreview("https://example.com")).resolves.toEqual({
      title: null,
      description: null,
      error: "not_html",
    })
  })

  it("devolve no_preview quando a página não tem título nem descrição", async () => {
    stubFetch(async () => respostaHtml("<html><body>vazio</body></html>"))

    await expect(lookupLinkPreview("https://example.com")).resolves.toEqual({
      title: null,
      description: null,
      error: "no_preview",
    })
  })

  it("devolve fetch_failed para resposta de erro", async () => {
    stubFetch(async () => new Response("erro", { status: 500 }))

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.error).toBe("fetch_failed")
  })

  it("recusa página que declara mais bytes do que o limite", async () => {
    stubFetch(
      async () =>
        new Response("<title>Grande</title>", {
          status: 200,
          headers: {
            "content-type": "text/html",
            "content-length": String(1024 * 1024),
          },
        })
    )

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.error).toBe("fetch_failed")
  })

  it("segue redirecionamento para outro host público", async () => {
    const fetchSpy = stubFetch(async (input) => {
      const url = String(input)

      if (url === "https://example.com/") {
        return new Response(null, {
          status: 302,
          headers: { location: "https://www.example.com/final" },
        })
      }

      return respostaHtml("<title>Depois do redirect</title>")
    })

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.title).toBe("Depois do redirect")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("bloqueia redirecionamento para host privado", async () => {
    const fetchSpy = stubFetch(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data" },
        })
    )

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.error).toBe("invalid_url")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("recusa redirecionamento para esquema que não é http(s)", async () => {
    stubFetch(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "file:///etc/passwd" },
        })
    )

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.error).toBe("invalid_url")
  })

  it("desiste depois de muitos redirecionamentos", async () => {
    const fetchSpy = stubFetch(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/loop" },
        })
    )

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.error).toBe("fetch_failed")
    expect(fetchSpy).toHaveBeenCalledTimes(5)
  })

  it("devolve fetch_failed quando o fetch lança", async () => {
    stubFetch(async () => {
      throw new Error("sem rede")
    })

    const resultado = await lookupLinkPreview("https://example.com")

    expect(resultado.error).toBe("fetch_failed")
  })
})

describe("fallbackLinkTitle", () => {
  it("usa o host sem www", () => {
    expect(fallbackLinkTitle("https://www.google.com/busca")).toBe("google.com")
    expect(fallbackLinkTitle("google.com")).toBe("google.com")
  })

  it("devolve a entrada original quando não é http(s)", () => {
    expect(fallbackLinkTitle("ftp://example.com")).toBe("ftp://example.com")
  })
})

describe("lookupLinkTitles", () => {
  it("devolve mapa vazio sem chamar fetch", async () => {
    const fetchSpy = stubFetch(async () => respostaHtml("<title>x</title>"))

    const titulos = await lookupLinkTitles([])

    expect(titulos.size).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("usa o título da página e cai para o host quando falha", async () => {
    stubFetch(async (input) => {
      const url = String(input)

      if (url === "https://ok.example.com/") {
        return respostaHtml("<title>Título da página</title>")
      }

      return new Response("erro", { status: 500 })
    })

    const titulos = await lookupLinkTitles([
      "https://ok.example.com",
      "https://falha.example.com",
    ])

    expect(Object.fromEntries(titulos)).toEqual({
      "https://ok.example.com": "Título da página",
      "https://falha.example.com": "falha.example.com",
    })
  })

  it("não repete a busca para a mesma URL", async () => {
    const fetchSpy = stubFetch(async () =>
      respostaHtml("<title>Título</title>")
    )

    const titulos = await lookupLinkTitles([
      "https://example.com",
      "https://example.com",
    ])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(titulos.size).toBe(1)
  })
})
