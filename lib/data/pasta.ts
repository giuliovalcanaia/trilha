import { cache } from "react"

import { pastasComRaizesVisiveis } from "@/lib/dominio/pastas"
import type { SupabaseClient } from "@/lib/supabase/server"

export const PASTA_RESUMO = "id, nome, parent_id" as const
export const PASTA_EXPLORER = "id, nome, parent_id, created_at" as const

/**
 * Pastas ativas visíveis (próprias + compartilhadas), já normalizadas para
 * raiz. Fica em cache por requisição para o layout e o explorador dividirem a
 * mesma consulta.
 */
export const getPastasAtivas = cache(async (supabase: SupabaseClient) => {
  const { data, error } = await supabase
    .from("pastas")
    .select(PASTA_EXPLORER)
    .is("deleted_at", null)
    .order("nome")

  if (error) throw new Error("pastas_lookup_failed")

  return pastasComRaizesVisiveis(data ?? [])
})

export async function getPasta(
  supabase: SupabaseClient,
  pastaId: number | null
) {
  if (pastaId === null) return null

  const { data, error } = await supabase
    .from("pastas")
    .select(PASTA_RESUMO)
    .eq("id", pastaId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error("pasta_lookup_failed")

  return data
}

/** Pastas, vínculos de atividades e contagem da lixeira para a sidebar. */
export async function getSidebarData(supabase: SupabaseClient) {
  const [
    pastas,
    { count: pastasNaLixeira, error: pastasErro },
    { count: atividadesNaLixeira, error: atividadesErro },
    { data: atividadePastas, error: vinculosErro },
  ] = await Promise.all([
    getPastasAtivas(supabase),
    supabase
      .from("pastas")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    supabase
      .from("atividades")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    supabase
      .from("atividades")
      .select("id, pasta_id")
      .is("deleted_at", null)
      .not("pasta_id", "is", null),
  ])

  if (pastasErro || atividadesErro || vinculosErro) {
    throw new Error("sidebar_lookup_failed")
  }

  return {
    pastas,
    atividadePastas: atividadePastas ?? [],
    trashCount: (pastasNaLixeira ?? 0) + (atividadesNaLixeira ?? 0),
  }
}
