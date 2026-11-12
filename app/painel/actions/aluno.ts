"use server"

import { z } from "zod"

import { requiredId } from "@/lib/dominio/campos"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { falhaDeRpc } from "@/lib/actions/rpc-error"
import { withProfessorForm } from "@/lib/actions/with-professor"
import { NOME_ALUNO_MAX } from "@/lib/dominio/limites"
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

const releaseConnectionSchema = z.object({
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

      if (error) {
        return falhaDeRpc(error, "Não foi possível salvar o progresso.")
      }

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
        return falhaDeRpc(error, "Não foi possível expulsar o aluno.", {
          TRL27: "Este aluno não está mais nesta atividade.",
        })
      }

      revalidatePainel(`/painel/atividades/${atividade_id}`)
      return ok("Aluno expulso da atividade.")
    }
  )
}

export async function releaseStudentConnection(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "releaseStudentConnection",
    releaseConnectionSchema,
    formData,
    async (professor, { atividade_id, participacao_id }) => {
      const { error } = await professor.supabase.rpc("release_participation", {
        p_participacao_id: participacao_id,
      })

      if (error) {
        return falhaDeRpc(error, "Não foi possível derrubar a conexão.", {
          TRL27: "Este aluno não está mais nesta atividade.",
        })
      }

      revalidatePainel(`/painel/atividades/${atividade_id}`)
      return ok("Conexão encerrada. O progresso foi mantido.")
    }
  )
}

const renameStudentSchema = z.object({
  atividade_id: requiredId("Aluno inválido."),
  participacao_id: requiredId("Aluno inválido."),
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do aluno.")
    .max(
      NOME_ALUNO_MAX,
      `O nome pode ter no máximo ${NOME_ALUNO_MAX} caracteres.`
    ),
})

export async function renameStudent(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return withProfessorForm(
    "renameStudent",
    renameStudentSchema,
    formData,
    async (professor, { atividade_id, participacao_id, nome }) => {
      const { error } = await professor.supabase.rpc("set_student_name", {
        p_participacao_id: participacao_id,
        p_nome: nome,
      })

      if (error) {
        return falhaDeRpc(error, "Não foi possível renomear o aluno.")
      }

      revalidatePainel(`/painel/atividades/${atividade_id}`)
      return ok("Nome atualizado.")
    }
  )
}
