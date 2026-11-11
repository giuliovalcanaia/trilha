import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

/**
 * Cria um canal do Realtime já autenticado.
 *
 * `channel(...).subscribe()` envia o `phx_join` na hora, com o token que o
 * socket tem naquele instante. Quem chega por link direto ou recarrega a
 * página ainda está restaurando a sessão do cookie nesse momento, então o
 * join sairia como `anon`: o Realtime recusa assinaturas com filtro
 * (`invalid column for filter`) e a RLS esconde todas as linhas das que não
 * têm filtro — o canal "conecta" e nunca entrega nada. `setAuth()` resolve a
 * sessão (via callback do `supabase-js`) e grava o token antes do join.
 *
 * Um canal que cai (rede, aba suspensa no celular) não volta sozinho:
 * `CHANNEL_ERROR`/`TIMED_OUT` agendam uma nova assinatura com backoff.
 *
 * Devolve a função de limpeza para o `useEffect`.
 */
export function assinarCanalRealtime(
  supabase: SupabaseClient<Database>,
  nome: string,
  montar: (canal: RealtimeChannel) => RealtimeChannel
) {
  let cancelado = false
  let canal: RealtimeChannel | null = null
  let reagendamento: ReturnType<typeof setTimeout> | null = null
  let tentativas = 0

  function agendarReconexao() {
    if (reagendamento) clearTimeout(reagendamento)

    const espera = Math.min(2000 * 2 ** tentativas, 30_000)
    tentativas += 1

    reagendamento = setTimeout(() => {
      reagendamento = null

      if (cancelado) return

      if (canal) {
        void supabase.removeChannel(canal)
        canal = null
      }

      void conectar()
    }, espera)
  }

  async function conectar() {
    await supabase.realtime.setAuth()

    if (cancelado) return

    canal = montar(supabase.channel(nome)).subscribe((status) => {
      if (cancelado) return

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        agendarReconexao()
      }
    })
  }

  void conectar()

  return () => {
    cancelado = true

    if (reagendamento) clearTimeout(reagendamento)
    if (canal) void supabase.removeChannel(canal)
  }
}
