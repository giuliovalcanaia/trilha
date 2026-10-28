import type { ReactNode } from "react"

import type { ActionResult } from "@/lib/actions/result"
import { AtividadeDadosInline } from "@/components/painel/atividade-dados-inline"
import { VoltarLink } from "@/components/painel/voltar-link"

type AtividadeDados =
  | {
      modo: "criar"
      titulo?: string
      subtitulo?: string | null
    }
  | {
      modo: "editar"
      titulo: string
      subtitulo?: string | null
      atividadeId: number
      action: (state: ActionResult, formData: FormData) => Promise<ActionResult>
    }

type AtividadeCabecalhoProps = {
  voltarHref: string
  dados: AtividadeDados
  meta: ReactNode
  acoes?: ReactNode
}

/** Cabeçalho compartilhado pela criação e pela edição de atividades. */
export function AtividadeCabecalho({
  voltarHref,
  dados,
  meta,
  acoes,
}: AtividadeCabecalhoProps) {
  return (
    <div className="space-y-2">
      <VoltarLink href={voltarHref} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <AtividadeDadosInline {...dados} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {meta}
          </div>
        </div>

        {acoes && (
          <div className="flex flex-wrap items-center gap-2">{acoes}</div>
        )}
      </div>
    </div>
  )
}
