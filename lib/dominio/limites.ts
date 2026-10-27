/** Limites compartilhados por schemas (servidor) e campos (cliente). */
export const TITULO_ATIVIDADE_MAX = 120
export const SUBTITULO_ATIVIDADE_MAX = 200
export const NOME_PASTA_MAX = 120
/** O bcrypt trunca em 72 bytes; acima disso a senha efetiva seria outra. */
export const SENHA_MIN = 4
export const SENHA_MAX = 72
/** Limite bruto do textarea de links antes do parse (20 KB). */
export const LINKS_TEXTO_MAX = 20 * 1024
