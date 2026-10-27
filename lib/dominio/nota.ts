export type NotaParse =
  { ok: true; valor: number | null } | { ok: false; erro: string }

const NOTA_INVALIDA = "Nota inválida. Use vírgula para os decimais (ex.: 8,5)."

/**
 * Converte o texto digitado em nota. Aceita vírgula (padrão brasileiro) ou
 * ponto como separador decimal, com até duas casas. Campo vazio vira `null`.
 */
export function parseNota(texto: string): NotaParse {
  const normalizado = texto.trim()

  if (!normalizado) return { ok: true, valor: null }

  if (!/^\d+([.,]\d{0,2})?$/.test(normalizado)) {
    return { ok: false, erro: NOTA_INVALIDA }
  }

  const valor = Number(normalizado.replace(",", "."))

  if (!Number.isFinite(valor)) {
    return { ok: false, erro: NOTA_INVALIDA }
  }

  return { ok: true, valor }
}

/** Formata a nota vinda do banco com vírgula (8.5 → "8,5"). */
export function formatarNota(valor: number | null): string {
  return valor === null ? "" : String(valor).replace(".", ",")
}
