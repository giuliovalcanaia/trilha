import { normalizeHttpUrl } from "./dominio/links"

/**
 * Lê título e descrição de uma página para preencher o link automaticamente.
 *
 * Roda só no servidor (as páginas dos exercícios não liberam CORS). Usa o
 * `<title>`/`og:title` e a `description`/`og:description`. Tem limite de tempo,
 * tamanho e redirecionamentos, e recusa endereços internos/privados.
 */

const TIMEOUT_MS = 6000
const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 4
const TITLE_MAX_LENGTH = 140
const DESCRIPTION_MAX_LENGTH = 300

export type LinkPreviewError =
  "invalid_url" | "fetch_failed" | "not_html" | "no_preview"

export type LinkPreviewResult = {
  title: string | null
  description: string | null
  error: LinkPreviewError | null
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
}

function decodeEntities(value: string) {
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (original, entidade: string) => {
      if (entidade.startsWith("#")) {
        const hex = entidade[1]?.toLowerCase() === "x"
        const codigo = Number.parseInt(
          entidade.slice(hex ? 2 : 1),
          hex ? 16 : 10
        )

        if (!Number.isFinite(codigo) || codigo < 1 || codigo > 0x10ffff) {
          return original
        }

        try {
          return String.fromCodePoint(codigo)
        } catch {
          return original
        }
      }

      return ENTIDADES[entidade.toLowerCase()] ?? original
    }
  )
}

function limparTexto(value: string | null | undefined, limite: number) {
  const limpo = decodeEntities(value ?? "")
    .replace(/\s+/g, " ")
    .trim()

  return limpo ? limpo.slice(0, limite) : null
}

function metaContent(html: string, chave: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const nome = tag.match(/(?:property|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
    const conteudo = tag.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i)

    const chaveTag = (nome?.[1] ?? nome?.[2] ?? "").toLowerCase()
    if (chaveTag !== chave.toLowerCase()) continue

    return conteudo?.[1] ?? conteudo?.[2] ?? null
  }

  return null
}

function extractPreview(html: string) {
  const semComentarios = html.replace(/<!--[\s\S]*?-->/g, " ")

  const titleTag = semComentarios.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]

  const title =
    limparTexto(titleTag, TITLE_MAX_LENGTH) ??
    limparTexto(metaContent(semComentarios, "og:title"), TITLE_MAX_LENGTH)

  const description =
    limparTexto(
      metaContent(semComentarios, "og:description"),
      DESCRIPTION_MAX_LENGTH
    ) ??
    limparTexto(
      metaContent(semComentarios, "description"),
      DESCRIPTION_MAX_LENGTH
    )

  return { title, description }
}

export function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "")

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true
  }

  // Qualquer IPv6 literal ("[::1]", "[fe80::1]", ...).
  if (host.startsWith("[")) return true

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false

  const a = Number(ipv4[1])
  const b = Number(ipv4[2])

  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true

  return false
}

async function readLimited(response: Response, maxBytes: number) {
  if (!response.body) return ""

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let html = ""
  let bytes = 0

  try {
    while (bytes < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break

      bytes += value.byteLength
      html += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }

  return html + decoder.decode()
}

export async function lookupLinkPreview(
  rawUrl: string
): Promise<LinkPreviewResult> {
  const href = normalizeHttpUrl(rawUrl)
  if (!href) return { title: null, description: null, error: "invalid_url" }

  let current = new URL(href)

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      if (isPrivateHostname(current.hostname)) {
        return { title: null, description: null, error: "invalid_url" }
      }

      const response = await fetch(current, {
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
          "user-agent":
            "Mozilla/5.0 (compatible; TrilhaLinkPreview/1.0; +https://example.com)",
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        await response.body?.cancel().catch(() => {})

        if (!location) {
          return { title: null, description: null, error: "fetch_failed" }
        }

        current = new URL(location, current)

        if (current.protocol !== "http:" && current.protocol !== "https:") {
          return { title: null, description: null, error: "invalid_url" }
        }

        continue
      }

      if (!response.ok) {
        return { title: null, description: null, error: "fetch_failed" }
      }

      const contentType = response.headers.get("content-type") ?? ""
      if (!/html/i.test(contentType)) {
        return { title: null, description: null, error: "not_html" }
      }

      const declarado = Number(response.headers.get("content-length") ?? "0")
      if (declarado > MAX_BYTES) {
        return { title: null, description: null, error: "fetch_failed" }
      }

      const html = await readLimited(response, MAX_BYTES)
      const { title, description } = extractPreview(html)

      if (!title && !description) {
        return { title: null, description: null, error: "no_preview" }
      }

      return { title, description, error: null }
    }

    return { title: null, description: null, error: "fetch_failed" }
  } catch {
    return { title: null, description: null, error: "fetch_failed" }
  }
}

const TITLE_CONCURRENCY = 4
const TITLE_BUDGET_MS = 6000

/** Título de reserva quando a página não tem um `<title>` legível. */
export function fallbackLinkTitle(rawUrl: string) {
  const href = normalizeHttpUrl(rawUrl)
  if (!href) return rawUrl

  try {
    return new URL(href).hostname.replace(/^www\./, "")
  } catch {
    return href
  }
}

/**
 * Busca os títulos das páginas em paralelo, limitando as requisições
 * simultâneas e o tempo total. Usado ao salvar a lista de links, então nunca
 * lança: quando a página não responde, devolve o host como título.
 */
export async function lookupLinkTitles(rawUrls: string[]) {
  const titulos = new Map<string, string>()
  const todos = [...new Set(rawUrls)]
  const fila = [...todos]

  if (fila.length === 0) return titulos

  let encerrado = false

  const trabalhadores = Array.from(
    { length: Math.min(TITLE_CONCURRENCY, fila.length) },
    async () => {
      for (;;) {
        if (encerrado) return

        const href = fila.shift()
        if (!href) return

        const { title } = await lookupLinkPreview(href)
        if (encerrado) return

        titulos.set(href, title ?? fallbackLinkTitle(href))
      }
    }
  )

  let prazo: ReturnType<typeof setTimeout> | undefined
  const tempoEsgotado = new Promise<void>((resolve) => {
    prazo = setTimeout(resolve, TITLE_BUDGET_MS)
  })

  await Promise.race([Promise.all(trabalhadores), tempoEsgotado])
  encerrado = true
  if (prazo) clearTimeout(prazo)

  // Quem não respondeu a tempo recebe o host, para a lista nunca ficar sem
  // título.
  for (const href of todos) {
    if (!titulos.has(href)) titulos.set(href, fallbackLinkTitle(href))
  }

  return titulos
}
