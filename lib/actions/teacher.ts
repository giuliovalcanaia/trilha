import { getProfessor } from "@/lib/auth/professor"
import type { SupabaseClient } from "@/lib/supabase/server"

export type Teacher = {
  supabase: SupabaseClient
  professorId: number
}

/** Contexto de uma server action do painel; `null` quando não é professor. */
export async function getTeacher(): Promise<Teacher | null> {
  const sessao = await getProfessor()

  if (!sessao) return null

  return { supabase: sessao.supabase, professorId: sessao.professor.id }
}
