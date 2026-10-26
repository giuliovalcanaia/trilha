"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

export async function markLinkAsStarted(aplicacaoId: number, linkId: number) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) {
    return { error: "not_authenticated" as const }
  }

  const { error } = await supabase.rpc("update_my_progress", {
    p_aplicacao_id: aplicacaoId,
    p_link_id: linkId,
    p_status: "fazendo",
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/atividade")
  return { error: null }
}

export async function completeLink(
  aplicacaoId: number,
  linkId: number,
  senha: string,
  pontuacao: number | null
) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) {
    return { error: "not_authenticated" as const }
  }

  const { error } = await supabase.rpc("complete_link", {
    p_aplicacao_id: aplicacaoId,
    p_link_id: linkId,
    p_senha: senha,
    p_pontuacao: pontuacao,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/atividade")
  return { error: null }
}
