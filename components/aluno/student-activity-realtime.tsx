"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

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
 */
export function StudentActivityRealtime({
  participacaoId,
  aplicacaoId,
}: {
  participacaoId: number
  aplicacaoId: number
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

    document.addEventListener("visibilitychange", atualizarSeVisivel)

    const pararCanal = assinarCanalRealtime(
      supabase,
      `aluno-participacao-${participacaoId}`,
      (canal) =>
        canal
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
  }, [participacaoId, aplicacaoId, router])

  return null
}
