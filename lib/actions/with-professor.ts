import { unstable_rethrow } from "next/navigation"
import { z, type ZodType } from "zod"

import { formDataToObject } from "@/lib/actions/form-data"
import { fail, type ActionResult } from "@/lib/actions/result"
import { getProfessor } from "@/lib/auth/professor"
import { AppError } from "@/lib/dominio/erros"
import type { SupabaseClient } from "@/lib/supabase/server"

export type ProfessorCtx = {
  supabase: SupabaseClient
  professorId: number
}

export const SESSAO_EXPIRADA = "Sessão expirada. Entre novamente."

const ERRO_INESPERADO = "Não foi possível concluir a ação. Tente novamente."

async function getProfessorCtx(): Promise<ProfessorCtx | null> {
  const sessao = await getProfessor()

  if (!sessao) return null

  return { supabase: sessao.supabase, professorId: sessao.professor.id }
}

/** Loga só o contexto seguro: nunca o FormData (senha, nota, nomes). */
function logActionError(name: string, professorId: number, codigo: string) {
  console.error(`[action:${name}]`, { professorId, codigo })
}

async function executar(
  name: string,
  professor: ProfessorCtx,
  handler: () => Promise<ActionResult>
): Promise<ActionResult> {
  try {
    return await handler()
  } catch (error) {
    // `redirect()`/`notFound()` usam exceções internas do Next: precisam
    // continuar subindo em vez de virarem "erro inesperado".
    unstable_rethrow(error)

    if (error instanceof AppError) {
      return fail(error.message, error.codigo)
    }

    logActionError(name, professor.professorId, "inesperado")
    return fail(ERRO_INESPERADO, "inesperado")
  }
}

/**
 * Wrapper para actions de formulário (`useActionState`): autentica o professor,
 * valida o FormData com zod e converte exceções inesperadas em `ActionResult`.
 */
export async function withProfessorForm<Schema extends ZodType>(
  name: string,
  schema: Schema,
  formData: FormData,
  handler: (
    professor: ProfessorCtx,
    input: z.infer<Schema>
  ) => Promise<ActionResult>
): Promise<ActionResult> {
  const professor = await getProfessorCtx()

  if (!professor) return fail(SESSAO_EXPIRADA, "sessao")

  const parsed = schema.safeParse(formDataToObject(formData))

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
      "validacao"
    )
  }

  return executar(name, professor, () => handler(professor, parsed.data))
}

/**
 * Wrapper para actions chamadas diretamente (sem `FormData`): mesma autenticação
 * e mesmo tratamento de erros.
 */
export async function withProfessorCall(
  name: string,
  handler: (professor: ProfessorCtx) => Promise<ActionResult>
): Promise<ActionResult> {
  const professor = await getProfessorCtx()

  if (!professor) return fail(SESSAO_EXPIRADA, "sessao")

  return executar(name, professor, () => handler(professor))
}
