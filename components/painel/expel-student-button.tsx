"use client"

import { UserXIcon } from "lucide-react"

import { expelStudent } from "@/app/painel/actions/aluno"
import { ConfirmAction } from "@/components/painel/confirm-action"
import { Button } from "@/components/ui/button"

/**
 * Expulsão de um aluno da atividade. O servidor marca a participação como
 * expulsa, apaga o progresso e a tela do aluno volta para o nome.
 */
export function ExpelStudentButton({
  atividadeId,
  participacaoId,
  nome,
}: {
  atividadeId: number
  participacaoId: number
  nome: string
}) {
  return (
    <ConfirmAction
      action={expelStudent}
      fields={{
        atividade_id: atividadeId,
        participacao_id: participacaoId,
      }}
      title={`Expulsar ${nome}?`}
      description="O progresso deste aluno nesta atividade será apagado. Ele será avisado e voltará para a tela de nome, onde pode entrar novamente."
      confirmLabel="Expulsar"
      triggerLabel={`Expulsar ${nome}`}
      trigger={
        <Button variant="destructive" size="sm" type="button">
          <UserXIcon data-icon="inline-start" />
          Expulsar
        </Button>
      }
    />
  )
}
