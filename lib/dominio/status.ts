export const STATUS_PROGRESSO = [
  "aberta",
  "fazendo",
  "concluida",
  "bloqueada",
] as const

export type StatusProgresso = (typeof STATUS_PROGRESSO)[number]

export const ROTULOS_PROGRESSO: Record<StatusProgresso, string> = {
  aberta: "Aberta",
  fazendo: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
}

/** Normaliza um status vindo do banco; desconhecido vira `bloqueada`. */
export function statusProgresso(value: string): StatusProgresso {
  return STATUS_PROGRESSO.find((status) => status === value) ?? "bloqueada"
}

/** Ciclo de vida da atividade (não confundir com o progresso do aluno). */
export const STATUS_ATIVIDADE = ["rascunho", "publicada", "arquivada"] as const

export type StatusAtividade = (typeof STATUS_ATIVIDADE)[number]

export const ROTULOS_ATIVIDADE: Record<StatusAtividade, string> = {
  rascunho: "Encerrada",
  publicada: "Ativa",
  arquivada: "Arquivada",
}

export function rotuloAtividade(value: string): string {
  return value in ROTULOS_ATIVIDADE
    ? ROTULOS_ATIVIDADE[value as StatusAtividade]
    : value
}
