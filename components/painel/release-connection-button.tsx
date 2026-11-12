"use client"

import { UnplugIcon } from "lucide-react"

import { releaseStudentConnection } from "@/app/painel/actions/aluno"
import { ConfirmAction } from "@/components/painel/confirm-action"
import { Button } from "@/components/ui/button"
import {
  avisarContinuar,
  avisarConexaoEncerrada,
} from "@/lib/supabase/broadcast"
import { createClient } from "@/lib/supabase/client"

/**
 * Derruba a conexão de um aluno sem apagar o progresso.
 *
 * Diferente de Expulsar: a participação, as notas e o andamento continuam
 * salvas. O aluno volta para a tela de nomes e pode se reconectar ao nome
 * correto.
 */
export function ReleaseConnectionButton({
  atividadeId,
  participacaoId,
  nome,
  codigo,
  conectado,
}: {
  atividadeId: number
  participacaoId: number
  nome: string
  codigo: string
  conectado: boolean
}) {
  return (
    <ConfirmAction
      action={releaseStudentConnection}
      fields={{
        atividade_id: atividadeId,
        participacao_id: participacaoId,
      }}
      title={`Derrubar a conexão de ${nome}?`}
      description="O progresso continua salvo. O aluno volta para a tela de nomes e pode escolher o nome correto para continuar. Para remover o aluno e apagar o progresso, use Expulsar."
      confirmLabel="Derrubar"
      confirmVariant="default"
      onSuccess={() => {
        // A tela do aluno perde a linha pela RLS assim que a conexão é
        // limpa, então o postgres_changes dela não chega: o aviso direto
        // derruba a conexão mesmo com a atividade aberta.
        const supabase = createClient()
        void avisarConexaoEncerrada(supabase, participacaoId)
        void avisarContinuar(supabase, codigo)
      }}
      triggerLabel={`Derrubar a conexão de ${nome}`}
      trigger={
        <Button variant="outline" size="sm" type="button" disabled={!conectado}>
          <UnplugIcon data-icon="inline-start" />
          Derrubar
        </Button>
      }
    />
  )
}
