import { redirect } from "next/navigation"
import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type SessaoProfessor = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  professor: { id: number; nome: string }
  email?: string
}

/**
 * Lê a sessão atual e, quando ela pertence a um professor, carrega o registro.
 * Fica em cache por requisição: layout, page e server actions reaproveitam as
 * mesmas consultas em vez de repetir `getClaims` + `professores`.
 */
const getSessao = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email : undefined

  if (!userId) {
    return { supabase, userId: null, professor: null, email }
  }

  const { data: professor, error } = await supabase
    .from("professores")
    .select("id, nome")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error("professor_lookup_failed")

  return { supabase, userId, professor, email }
})

/** Sessão de professor, ou `null` para aluno anônimo e usuário sem registro. */
export const getProfessor = cache(async (): Promise<SessaoProfessor | null> => {
  const sessao = await getSessao()

  if (!sessao.userId || !sessao.professor) return null

  return {
    supabase: sessao.supabase,
    userId: sessao.userId,
    professor: sessao.professor,
    email: sessao.email,
  }
})

/**
 * Garante uma sessão de professor. Sem sessão vai para `/login`; sessão que
 * não é de professor (aluno anônimo) volta para a entrada.
 */
export async function requireProfessor(): Promise<SessaoProfessor> {
  const sessao = await getSessao()

  if (!sessao.userId) redirect("/login")
  if (!sessao.professor) redirect("/")

  return {
    supabase: sessao.supabase,
    userId: sessao.userId,
    professor: sessao.professor,
    email: sessao.email,
  }
}
