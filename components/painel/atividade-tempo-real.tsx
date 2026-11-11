"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import { assinarCanalRealtime } from "@/lib/supabase/realtime"

/**
 * Mantém a aba Alunos atualizada enquanto o professor acompanha a turma:
 * nomes que entram (participacoes) e links concluídos (progresso_estudante)
 * chegam pelo Realtime e disparam um refresh do Server Component.
 *
 * Assina apenas INSERT/UPDATE: DELETE exigiria `replica identity full` e as
 * policies de RLS não são aplicadas a eventos de DELETE.
 */
export function AtividadeTempoReal({ atividadeId }: { atividadeId: number }) {
  const router = useRouter()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    function agendarAtualizacao() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => router.refresh(), 250)
    }

    const pararCanal = assinarCanalRealtime(
      supabase,
      `atividade-${atividadeId}`,
      (canal) =>
        canal
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "participacoes" },
            agendarAtualizacao
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "participacoes" },
            agendarAtualizacao
          )
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "progresso_estudante" },
            agendarAtualizacao
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "progresso_estudante" },
            agendarAtualizacao
          )
    )

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      pararCanal()
    }
  }, [atividadeId, router])

  return null
}
