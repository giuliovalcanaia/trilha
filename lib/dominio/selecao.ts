export type ItemSelecionavel = {
  tipo: "pasta" | "atividade"
  id: number
}

export function itemKey(item: ItemSelecionavel) {
  return `${item.tipo}-${item.id}`
}

/** Itens entre `de` e `ate`, respeitando a ordem da lista informada. */
export function intervalo(keys: string[], de: string, ate: string): string[] {
  const inicio = keys.indexOf(de)
  const fim = keys.indexOf(ate)

  if (inicio === -1 || fim === -1) return [ate]

  const primeiro = Math.min(inicio, fim)
  const ultimo = Math.max(inicio, fim)

  return keys.slice(primeiro, ultimo + 1)
}

/** Separa as chaves de seleção nos ids de pastas e de atividades. */
export function separarChaves(keys: Iterable<string>) {
  const pastas: number[] = []
  const atividades: number[] = []

  for (const key of keys) {
    const [tipo, id] = key.split("-")
    const numero = Number(id)

    if (!Number.isInteger(numero) || numero <= 0) continue
    if (tipo === "pasta") pastas.push(numero)
    else if (tipo === "atividade") atividades.push(numero)
  }

  return { pastas, atividades }
}
