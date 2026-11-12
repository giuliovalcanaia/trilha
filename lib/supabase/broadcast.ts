import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

const TIMEOUT_AVISO = 1500

/** Canal público da lista de nomes de uma atividade. */
export function canalContinuar(codigo: string) {
  return `continuar-${codigo.trim().toUpperCase()}`
}

/** Canal público da tela de um aluno (Realtime + avisos da conexão). */
export function canalAluno(participacaoId: number) {
  return `aluno-participacao-${participacaoId}`
}

/**
 * Envia um broadcast sem payload e fecha o canal.
 *
 * Devolve uma Promise que resolve quando o aviso saiu (ou depois de 1,5s, se o
 * canal demorar). Quem vai navegar logo em seguida — o aluno que acabou de
 * assumir o nome — deve esperar por ela; os demais podem ignorar, porque as
 * telas também releem o estado periodicamente.
 */
function avisar(
  supabase: SupabaseClient<Database>,
  topico: string,
  evento: string
) {
  return new Promise<void>((resolve) => {
    const canal = supabase.channel(topico)
    let encerrado = false

    function encerrar() {
      if (encerrado) return
      encerrado = true
      clearTimeout(timeout)
      void supabase.removeChannel(canal)
      resolve()
    }

    const timeout = setTimeout(encerrar, TIMEOUT_AVISO)

    canal.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void canal
          .send({ type: "broadcast", event: evento, payload: {} })
          .then(encerrar, encerrar)
        return
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        encerrar()
      }
    })
  })
}

/**
 * Avisa as outras telas de "Continuar atividade" que a lista mudou.
 *
 * É um canal de broadcast público e sem payload: quem escuta apenas refaz a
 * leitura de `list_activity_students`. Não usamos `postgres_changes` aqui
 * porque a página é aberta antes do login anônimo e a RLS de `participacoes`
 * não libera a tabela para `anon`.
 */
export function avisarContinuar(
  supabase: SupabaseClient<Database>,
  codigo: string
) {
  return avisar(supabase, canalContinuar(codigo), "atualizar")
}

/**
 * Avisa a tela do aluno que o professor derrubou a conexão, para ela sair na
 * hora — a RLS esconde a linha de `participacoes` assim que a conexão é
 * limpa, então o `postgres_changes` da própria tela não entrega o UPDATE.
 *
 * O canal é público, então qualquer pessoa poderia enviar este evento; por
 * isso ele não carrega confiança: a tela confere com `touch_participation`
 * antes de sair. Quem decide a conexão continua sendo o banco.
 */
export function avisarConexaoEncerrada(
  supabase: SupabaseClient<Database>,
  participacaoId: number
) {
  return avisar(supabase, canalAluno(participacaoId), "conexao-encerrada")
}
