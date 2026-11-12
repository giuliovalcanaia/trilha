"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { canalAluno } from "@/lib/supabase/broadcast"
import { createClient } from "@/lib/supabase/client"
import { assinarCanalRealtime } from "@/lib/supabase/realtime"

/**
 * Mantém a tela do aluno sincronizada com o painel do professor:
 * status/nota dos links (progresso_estudante), encerramento/reabertura da
 * entrada (aplicacoes) e expulsão da participação (participacoes.expulso_em)
 * chegam pelo Realtime e disparam um refresh do Server Component.
 *
 * Ao voltar para a aba, um refresh garante o mesmo efeito caso o canal tenha
 * caído enquanto o aluno estava no link. Assina apenas INSERT/UPDATE: DELETE
 * exigiria `replica identity full` e as policies de RLS não são aplicadas a
 * eventos de DELETE.
 *
 * O `Derrubar` do professor limpa a conexão e a linha some da RLS, então o
 * UPDATE de `participacoes` não chega. Por isso o painel também manda um
 * broadcast em `canalAluno`; a tela confere no banco e sai na hora.
 */
export function StudentActivityRealtime({
  participacaoId,
  aplicacaoId,
  codigo,
}: {
  participacaoId: number
  aplicacaoId: number
  codigo: string
}) {
  const router = useRouter()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    function agendarAtualizacao() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => router.refresh(), 250)
    }

    function atualizarSeVisivel() {
      if (document.visibilityState === "visible") agendarAtualizacao()
    }

    // O aviso de conexão encerrada é público, então não dá para confiar nele:
    // o batimento confirma no banco se a participação ainda é desta sessão.
    async function conferirConexao() {
      const { data } = await supabase.rpc("touch_participation", {
        p_aplicacao_id: aplicacaoId,
      })

      if (data === false) {
        router.push(
          `/aluno/continuar?codigo=${encodeURIComponent(codigo)}&desconectado=1`
        )
      }
    }

    document.addEventListener("visibilitychange", atualizarSeVisivel)

    const pararCanal = assinarCanalRealtime(
      supabase,
      canalAluno(participacaoId),
      (canal) =>
        canal
          .on("broadcast", { event: "conexao-encerrada" }, () => {
            void conferirConexao()
          })
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "progresso_estudante",
              filter: `participacao_id=eq.${participacaoId}`,
            },
            agendarAtualizacao
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "progresso_estudante",
              filter: `participacao_id=eq.${participacaoId}`,
            },
            agendarAtualizacao
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "aplicacoes",
              filter: `id=eq.${aplicacaoId}`,
            },
            agendarAtualizacao
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "participacoes",
              filter: `id=eq.${participacaoId}`,
            },
            agendarAtualizacao
          )
    )

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      document.removeEventListener("visibilitychange", atualizarSeVisivel)
      pararCanal()
    }
  }, [participacaoId, aplicacaoId, codigo, router])

  return null
}
