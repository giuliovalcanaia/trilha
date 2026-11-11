/** Linha de progresso que guarda a posição sorteada do link para o aluno. */
export type ProgressoComOrdem = {
  link_id: number
  ordem_embaralhada: number | null
}

/**
 * Ordena os links na sequência que o aluno vê na tela.
 *
 * Quem entrou depois de o professor ligar o embaralhamento tem uma posição em
 * `progresso_estudante.ordem_embaralhada`; quem entrou antes (ou está numa
 * atividade sem embaralhamento) não tem posição e continua na ordem canônica
 * recebida. Links sem posição vão para o fim, preservando a ordem de entrada.
 */
export function ordenarLinksDoAluno<Link extends { id: number }>(
  links: readonly Link[],
  progresso: readonly ProgressoComOrdem[]
): Link[] {
  const embaralhada = progresso.some((row) => row.ordem_embaralhada !== null)

  if (!embaralhada) return [...links]

  const ordemPorLink = new Map(
    progresso.map((row) => [row.link_id, row.ordem_embaralhada])
  )

  return [...links].sort(
    (a, b) =>
      (ordemPorLink.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (ordemPorLink.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  )
}
