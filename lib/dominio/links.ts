/**
 * Normaliza um endereço digitado pelo professor.
 *
 * Aceita tanto a URL completa (`https://google.com/exercicio`) quanto o
 * endereço sem esquema (`google.com`, `www.google.com`), assumindo `https://`.
 * Devolve o endereço absoluto normalizado ou `null` quando não é http(s).
 */
export function normalizeHttpUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // Só http(s): evita transformar `ftp://x`, `mailto:x` ou `javascript:x` em
  // `https://...`. `localhost:3000` continua valendo (o ":" é porta, não esquema).
  const hasOutroEsquema =
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)

  if (hasOutroEsquema && !/^[a-z][a-z0-9+.-]*:\d+(?:[/?#]|$)/i.test(trimmed))
    return null

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(candidate)

    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (!url.hostname) return null

    return url.href
  } catch {
    return null
  }
}

export const MAX_LINKS_POR_ATIVIDADE = 50

function pareceEnderecoWeb(href: string) {
  try {
    const { hostname } = new URL(href)

    // `nao-e-url` vira `https://nao-e-url/` no parser, mas não é um site.
    // Domínios/IPs têm ponto; localhost e IPv6 são exceções conhecidas.
    return (
      hostname === "localhost" ||
      hostname.includes(".") ||
      hostname.includes(":")
    )
  } catch {
    return false
  }
}

export type LinkListResult =
  { ok: true; links: string[] } | { ok: false; error: string }

/**
 * Lê a lista colada no textarea: um link por linha, na ordem em que aparece.
 *
 * Linhas em branco são ignoradas (o professor pode separar os links com mais de
 * uma quebra de linha), assim como marcadores comuns de lista (`-`, `*`, `•`,
 * `1.`, `1)`). Quebras de linha do Windows/macOS são normalizadas.
 */
export function parseLinkList(raw: string): LinkListResult {
  const linhas = raw.replace(/\r\n?/g, "\n").split("\n")
  const links: string[] = []
  const vistos = new Set<string>()

  for (let indice = 0; indice < linhas.length; indice++) {
    const limpa = linhas[indice]
      .trim()
      .replace(/^(?:[-*•–—]|\d+[.)])\s+/, "")
      .trim()

    if (!limpa) continue

    const href = normalizeHttpUrl(limpa)

    if (!href || !pareceEnderecoWeb(href)) {
      return {
        ok: false,
        error: `Linha ${indice + 1}: “${limpa}” não parece um endereço válido. Use google.com ou https://google.com.`,
      }
    }

    if (vistos.has(href)) continue

    vistos.add(href)
    links.push(href)
  }

  if (links.length > MAX_LINKS_POR_ATIVIDADE) {
    return {
      ok: false,
      error: `São no máximo ${MAX_LINKS_POR_ATIVIDADE} links por atividade.`,
    }
  }

  return { ok: true, links }
}
