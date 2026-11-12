import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

const TIMEOUT_AVISO = 1500

/** Canal público da lista de nomes de uma atividade. */
export function canalContinuar(codigo: string) {
  return `continuar-${codigo.trim().toUpperCase()}`
}

/**
 * Avisa as outras telas de "Continuar atividade" que a lista mudou.
 *
 * É um canal de broadcast público e sem payload: quem escuta apenas refaz a
 * leitura de `list_activity_students`. Não usamos `postgres_changes` aqui
 * porque a página é aberta antes do login anônimo e a RLS de `participacoes`
 * não libera a tabela para `anon`.
 *
 * Devolve uma Promise que resolve quando o aviso foi enviado (ou depois de
 * 1,5s, se o canal demorar). Quem vai navegar logo em seguida — o aluno que
 * acabou de assumir o nome — deve esperar por ela; os demais podem ignorar,
 * porque a tela relê a lista a cada 10s como reserva.
 */
export function avisarContinuar(
  supabase: SupabaseClient<Database>,
  codigo: string
) {
  return new Promise<void>((resolve) => {
    const canal = supabase.channel(canalContinuar(codigo))
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
          .send({
            type: "broadcast",
            event: "atualizar",
            payload: {},
          })
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
