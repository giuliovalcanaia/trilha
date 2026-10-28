/**
 * Códigos estáveis dos erros de negócio (SQLSTATE `TRLxx`, ver a migration
 * `20261027120000_erros_tipados.sql`) e o texto pt-BR exibido ao usuário.
 *
 * O código é o contrato entre SQL, server actions e client components; a
 * mensagem pode ser sobrescrita por contexto com `falhaDeRpc`.
 */
export const ERROS = {
  TRL01: "Sessão expirada. Entre novamente.",
  TRL02: "Sessão expirada. Entre novamente.",
  TRL03: "Sessão expirada. Entre novamente.",
  TRL04: "Informe o seu nome.",
  TRL05: "Esta conta é de professor. Saia e entre com uma conta de aluno.",
  TRL06: "Código da atividade inválido. Confira com o professor.",
  TRL07: "Esta atividade ainda não está disponível. Confira com o professor.",
  TRL08: "A atividade foi encerrada. Fale com o professor.",
  TRL10: "Digite a senha.",
  TRL11: "Atividade não encontrada.",
  TRL12: "Você não está nesta atividade. Entre novamente.",
  TRL13: "Link não encontrado.",
  TRL14: "Este link não está disponível para conclusão.",
  TRL15: "O professor ainda não definiu a senha desta atividade.",
  TRL16: "Senha incorreta. Confira com o professor.",
  TRL17: "A nota precisa ser maior ou igual a 0.",
  TRL18: "Situação inválida.",
  TRL19: "Pasta não encontrada.",
  TRL20: "Atividade não encontrada.",
  TRL21: "Item da lixeira não encontrado.",
  TRL22: "A pasta compartilhada só pode ser alterada pelo dono.",
  TRL23: "Não é possível alterar o dono do item.",
  TRL24: "Nenhum professor cadastrado com esse e-mail.",
  TRL25: "Você já tem acesso a esta pasta.",
  TRL26: "Informe um e-mail válido.",
  TRL27: "Este aluno não está mais nesta atividade.",
  TRL28: "Progresso não encontrado.",
  TRL29: "Não foi possível organizar os links.",
  TRL30: "Direção inválida.",
  TRL31: "Não foi possível gerar o código de entrada.",
  TRL32: "Muitas tentativas de senha. Aguarde um minuto e tente de novo.",
} as const

export type CodigoErro = keyof typeof ERROS

/** Texto padrão de um código, ou `null` quando não é um TRLxx conhecido. */
export function mensagemDoErro(codigo: string | null | undefined) {
  if (!codigo || !(codigo in ERROS)) return null

  return ERROS[codigo as CodigoErro]
}

/** Erro de negócio/validação que já carrega um código estável. */
export class AppError extends Error {
  readonly codigo: CodigoErro

  constructor(codigo: CodigoErro, mensagem?: string) {
    super(mensagem ?? ERROS[codigo])
    this.name = "AppError"
    this.codigo = codigo
  }
}
