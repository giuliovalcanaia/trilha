export type PastaRow = {
  id: number
  nome: string
  parent_id: number | null
}

/** Vínculo mínimo de uma atividade com a pasta que a contém. */
export type AtividadePastaRow = {
  id: number
  pasta_id: number | null
}

export type PastaNode = {
  id: number
  nome: string
  depth: number
}

export function flattenPastas(
  pastas: PastaRow[],
  parentId: number | null = null,
  depth = 0,
  visitados = new Set<number>()
): PastaNode[] {
  return pastas
    .filter((pasta) => pasta.parent_id === parentId)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .flatMap((pasta) => {
      if (visitados.has(pasta.id)) return []
      visitados.add(pasta.id)
      return [
        { id: pasta.id, nome: pasta.nome, depth },
        ...flattenPastas(pastas, pasta.id, depth + 1, visitados),
      ]
    })
}

/** Caminho da raiz até a pasta informada. */
export function pastaBreadcrumb(
  pastas: PastaRow[],
  pastaId: number | null
): PastaRow[] {
  if (pastaId === null) return []

  const byId = new Map(pastas.map((pasta) => [pasta.id, pasta]))
  const caminho: PastaRow[] = []
  const visitados = new Set<number>()
  let atual = byId.get(pastaId)

  while (atual && !visitados.has(atual.id)) {
    caminho.unshift(atual)
    visitados.add(atual.id)
    atual = atual.parent_id === null ? undefined : byId.get(atual.parent_id)
  }

  return caminho
}

/** Como `flattenPastas`, mas só desce nas pastas expandidas. */
export function flattenPastasVisiveis(
  pastas: PastaRow[],
  expandidas: ReadonlySet<number>,
  parentId: number | null = null,
  depth = 0,
  visitados = new Set<number>()
): PastaNode[] {
  return pastas
    .filter((pasta) => pasta.parent_id === parentId)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .flatMap((pasta) => {
      if (visitados.has(pasta.id)) return []
      visitados.add(pasta.id)

      const no: PastaNode = { id: pasta.id, nome: pasta.nome, depth }

      if (!expandidas.has(pasta.id)) return [no]

      return [
        no,
        ...flattenPastasVisiveis(
          pastas,
          expandidas,
          pasta.id,
          depth + 1,
          visitados
        ),
      ]
    })
}

/** Inclui a própria pasta e todas as subpastas. */
export function pastaDescendantIds(
  pastas: PastaRow[],
  pastaId: number
): Set<number> {
  const children = new Map<number, number[]>()

  for (const pasta of pastas) {
    if (pasta.parent_id === null) continue
    const lista = children.get(pasta.parent_id) ?? []
    lista.push(pasta.id)
    children.set(pasta.parent_id, lista)
  }

  const resultado = new Set<number>([pastaId])
  const fila = [pastaId]

  while (fila.length > 0) {
    const atual = fila.shift()!
    for (const filho of children.get(atual) ?? []) {
      if (resultado.has(filho)) continue
      resultado.add(filho)
      fila.push(filho)
    }
  }

  return resultado
}

/**
 * Uma pasta compartilhada pode ter um pai que não está visível para quem
 * recebeu o acesso. Nesse caso ela é exibida como raiz, sem quebrar a árvore.
 */
export function pastasComRaizesVisiveis<T extends PastaRow>(pastas: T[]): T[] {
  const visiveis = new Set(pastas.map((pasta) => pasta.id))

  return pastas.map((pasta) =>
    pasta.parent_id !== null && !visiveis.has(pasta.parent_id)
      ? { ...pasta, parent_id: null }
      : pasta
  )
}
