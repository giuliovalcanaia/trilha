"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

const INTERVALO_BATIMENTO = 30_000

/**
 * Mantém viva a conexão do aluno com a atividade.
 *
 * O nome escolhido na tela de continuar fica bloqueado para os outros
 * enquanto a conexão tem batimento recente (`participacoes.conexao_em`).
 * Sem isso, fechar a aba deixava o nome preso até o professor derrubar. O
 * servidor considera a conexão livre depois de 3 minutos sem batimento.
 *
 * Fechar a aba (ou o navegador) avisa a rota `/api/conexao/sair` por
 * `sendBeacon`, que agenda a liberação para 15s depois; recarregar a página
 * cai nessa carência e o batimento da tela nova cancela o agendamento. Se o
 * beacon se perder, o batimento ainda expira a conexão.
 *
 * A primeira batida acontece na montagem; ao voltar para a aba também batemos
 * na hora, porque o navegador atrasa timers de abas em segundo plano. Se a
 * conexão já não pertence a esta sessão (o professor derrubou ou outro aluno
 * assumiu o nome), o refresh leva a página de volta para a escolha de nome.
 */
export function StudentConnectionHeartbeat({
  aplicacaoId,
  codigo,
}: {
  aplicacaoId: number
  codigo: string
}) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let cancelado = false

    async function bater() {
      if (cancelado) return

      const { data, error } = await supabase.rpc("touch_participation", {
        p_aplicacao_id: aplicacaoId,
      })

      if (error || cancelado) return

      if (data === false) {
        cancelado = true
        router.push(
          `/aluno/continuar?codigo=${encodeURIComponent(codigo)}&desconectado=1`
        )
      }
    }

    function agendarSaida(event: PageTransitionEvent) {
      // bfcache (voltar/avançar) mantém a página viva: não agenda saída.
      if (event.persisted) return

      const corpo = new Blob([JSON.stringify({ aplicacaoId })], {
        type: "application/json",
      })

      navigator.sendBeacon("/api/conexao/sair", corpo)
    }

    function aoTrocarVisibilidade() {
      if (document.visibilityState === "visible") void bater()
    }

    void bater()
    const intervalo = window.setInterval(
      () => void bater(),
      INTERVALO_BATIMENTO
    )

    document.addEventListener("visibilitychange", aoTrocarVisibilidade)
    window.addEventListener("pagehide", agendarSaida)

    return () => {
      cancelado = true
      window.clearInterval(intervalo)
      document.removeEventListener("visibilitychange", aoTrocarVisibilidade)
      window.removeEventListener("pagehide", agendarSaida)
    }
  }, [aplicacaoId, codigo, router])

  return null
}
