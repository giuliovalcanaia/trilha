"use server"

import { z } from "zod"

import { requiredId } from "@/lib/dominio/campos"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { withProfessorForm } from "@/lib/actions/with-professor"
import { parseNota } from "@/lib/dominio/nota"
import { STATUS_PROGRESSO } from "@/lib/dominio/status"

const updateStudentProgressSchema = z.object({
  atividade_id: requiredId("Progresso inválido."),
  participacao_id: requiredId("Progresso inválido."),
  link_id: requiredId("Progresso inválido."),
  status: z.enum(STATUS_PROGRESSO, { message: "Situação inválida." }),
  pontuacao: z.string().optional().default(""),
})

const expelStudentSchema = z.object({
  atividade_id: requiredId("Aluno inválido."),
  participacao_id: requiredId("Aluno inválido."),
})

export async function updateStudentProgress(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "updateStudentProgress",
    updateStudentProgressSchema,
    formData,
    async (
      professor,
      { atividade_id, participacao_id, link_id, status, pontuacao: raw }
    ) => {
      let pontuacao: number | null = null
      if (raw) {
        const resultado = parseNota(raw)
        if (!resultado.ok) return fail(resultado.erro)
        pontuacao = resultado.valor
      }

      const { error } = await professor.supabase.rpc("set_student_progress", {
        p_participacao_id: participacao_id,
        p_link_id: link_id,
        p_status: status,
        p_pontuacao: pontuacao,
      })

      if (error) return fail("Não foi possível salvar o progresso.")

      revalidatePainel(`/painel/atividades/${atividade_id}`)
      return ok("Progresso atualizado.")
    }
  )
}

export async function expelStudent(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "expelStudent",
    expelStudentSchema,
    formData,
    async (professor, { atividade_id, participacao_id }) => {
      const { error } = await professor.supabase.rpc("expel_student", {
        p_participacao_id: participacao_id,
      })

      if (error) {
        return fail(
          error.message === "participation_not_found"
            ? "Este aluno não está mais nesta atividade."
            : "Não foi possível expulsar o aluno."
        )
      }

      revalidatePainel(`/painel/atividades/${atividade_id}`)
      return ok("Aluno expulso da atividade.")
    }
  )
}
