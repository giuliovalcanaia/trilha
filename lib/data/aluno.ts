import type { SupabaseClient } from "@/lib/supabase/server"

/** Links e progresso do aluno na atividade, na ordem canônica dos links. */
export async function getLinksComProgresso(
  supabase: SupabaseClient,
  atividadeId: number,
  participacaoId: number
) {
  const [
    { data: links, error: linksError },
    { data: progresso, error: progressoError },
  ] = await Promise.all([
    supabase
      .from("links")
      .select("id, titulo, href, ordem")
      .eq("atividade_id", atividadeId)
      .order("ordem", { ascending: true }),
    supabase
      .from("progresso_estudante")
      .select("link_id, status, ordem_embaralhada")
      .eq("participacao_id", participacaoId),
  ])

  if (linksError || progressoError) {
    throw new Error("aluno_progresso_lookup_failed")
  }

  return { links: links ?? [], progresso: progresso ?? [] }
}
