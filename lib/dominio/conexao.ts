/**
 * Regras de exibição da conexão do aluno. O banco continua sendo a
 * autoridade (é ele quem recusa `continue_activity`); estes valores existem
 * só para o painel mostrar "Conectado"/"Sem conexão" coerente com a lista.
 */

/**
 * Janela do batimento da tela do aluno. Espelha `private.conexao_ativa` na
 * migration `20261112103426_conexao_expira.sql`.
 */
export const CONEXAO_TTL_MS = 3 * 60 * 1000

export type ConexaoParticipacao = {
  conexao_estudante_id: number | null
  conexao_em: string | null
  desconexao_agendada_em: string | null
}

/** A conexão ainda vale? Mesma regra do banco, aplicada no fuso do navegador. */
export function conexaoAtiva(
  conexao: ConexaoParticipacao,
  agora = Date.now()
): boolean {
  if (conexao.conexao_estudante_id === null) return false
  if (!conexao.conexao_em) return false

  const batimento = Date.parse(conexao.conexao_em)

  if (Number.isNaN(batimento)) return false
  if (agora - batimento >= CONEXAO_TTL_MS) return false

  if (conexao.desconexao_agendada_em) {
    const saida = Date.parse(conexao.desconexao_agendada_em)

    if (!Number.isNaN(saida) && saida <= agora) return false
  }

  return true
}
