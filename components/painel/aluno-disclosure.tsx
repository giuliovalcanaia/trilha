"use client"

import { useId, useState, type ReactNode } from "react"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Linha do aluno na aba Alunos.
 *
 * O nome abre e fecha o detalhe com a situação e a nota de cada etapa. As
 * ações da linha (`acoes`, como o Expulsar) ficam no cabeçalho, e a ação rápida
 * (`acao`) logo abaixo dele, sempre visível, para o professor concluir a etapa
 * atual sem expandir nada.
 */
export function AlunoDisclosure({
  nome,
  acoes,
  acao,
  detalhe,
}: {
  nome: string
  acoes?: ReactNode
  acao: ReactNode
  detalhe: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const id = useId()

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAberto((valor) => !valor)}
          aria-expanded={aberto}
          aria-controls={id}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left text-sm"
        >
          <ChevronRightIcon
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              aberto && "rotate-90"
            )}
          />
          <span className="min-w-0 font-medium">{nome}</span>
        </button>

        {acoes && <div className="shrink-0">{acoes}</div>}
      </div>

      {acao}

      <div id={id} className="mt-3 space-y-2" hidden={!aberto}>
        {detalhe}
      </div>
    </>
  )
}
