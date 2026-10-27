"use server"

import { field, idField } from "@/lib/actions/form-data"
import { revalidatePainel } from "@/lib/actions/revalidate"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { getTeacher } from "@/lib/actions/teacher"
import { parseNota } from "@/lib/dominio/nota"

const STATUSES = ["aberta", "fazendo", "concluida", "bloqueada"] as const

export async function updateStudentProgress(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const atividadeId = idField(formData, "atividade_id")
  const participacaoId = idField(formData, "participacao_id")
  const linkId = idField(formData, "link_id")
  const status = field(formData, "status")
  const pontuacaoRaw = field(formData, "pontuacao")

  if (!atividadeId || !participacaoId || !linkId) {
    return fail("Progresso inválido.")
  }

  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return fail("Situação inválida.")
  }

  let pontuacao: number | null = null
  if (pontuacaoRaw) {
    const resultado = parseNota(pontuacaoRaw)
    if (!resultado.ok) return fail(resultado.erro)
    pontuacao = resultado.valor
  }

  const { error } = await teacher.supabase.rpc("set_student_progress", {
    p_participacao_id: participacaoId,
    p_link_id: linkId,
    p_status: status,
    p_pontuacao: pontuacao,
  })

  if (error) return fail("Não foi possível salvar o progresso.")

  revalidatePainel(`/painel/atividades/${atividadeId}`)
  return ok("Progresso atualizado.")
}

export async function expelStudent(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await getTeacher()
  if (!teacher) return fail("Sessão expirada. Entre novamente.")

  const atividadeId = idField(formData, "atividade_id")
  const participacaoId = idField(formData, "participacao_id")

  if (!atividadeId || !participacaoId) {
    return fail("Aluno inválido.")
  }

  const { error } = await teacher.supabase.rpc("expel_student", {
    p_participacao_id: participacaoId,
  })

  if (error) {
    return fail(
      error.message === "participation_not_found"
        ? "Este aluno não está mais nesta atividade."
        : "Não foi possível expulsar o aluno."
    )
  }

  revalidatePainel(`/painel/atividades/${atividadeId}`)
  return ok("Aluno expulso da atividade.")
}
