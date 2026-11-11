"use client"

import { useId, useState, type ReactNode } from "react"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Linha do aluno na aba Alunos.
 *
 * O nome abre e fecha o detalhe com a situação e a nota de cada etapa. A ação
 * rápida (`acao`) fica sempre visível, logo abaixo do nome, para o professor
 * concluir a etapa atual sem expandir nada.
 */
export function AlunoDisclosure({
  nome,
  acao,
  detalhe,
}: {
  nome: string
  acao: ReactNode
  detalhe: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const id = useId()

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-controls={id}
        className="flex w-full cursor-pointer items-start gap-1 pr-24 text-left text-sm"
      >
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-90"
          )}
        />
        <span className="min-w-0 font-medium">{nome}</span>
      </button>

      {acao}

      <div id={id} className="mt-3 space-y-2" hidden={!aberto}>
        {detalhe}
      </div>
    </>
  )
}
