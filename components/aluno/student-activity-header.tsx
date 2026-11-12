import type { ReactNode } from "react"

import { Card, CardHeader } from "@/components/ui/card"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"

type StudentActivityHeaderProps = {
  titulo: string
  subtitulo: string | null
  meta?: ReactNode
  concluidas: number
  total: number
}

/**
 * Cabeçalho da atividade do aluno, compartilhado com a pré-visualização.
 *
 * Fica fixo no topo (`sticky`): com muitos links, o aluno rola a lista e
 * continua vendo título, data e progresso sem precisar voltar ao topo. O
 * fundo semitransparente com blur cobre os cartões que passam por baixo.
 */
export function StudentActivityHeader({
  titulo,
  subtitulo,
  meta,
  concluidas,
  total,
}: StudentActivityHeaderProps) {
  const progressoPercentual =
    total > 0 ? Math.round((concluidas / total) * 100) : 0

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-[calc(0.75rem_+_env(safe-area-inset-top))] pr-[calc(1rem_+_env(safe-area-inset-right))] pb-3 pl-[calc(1rem_+_env(safe-area-inset-left))] backdrop-blur">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {titulo}
      </h1>
      {subtitulo && (
        <p className="text-sm text-muted-foreground sm:text-base">
          {subtitulo}
        </p>
      )}
      {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
      <Card size="sm" className="mt-3">
        <CardHeader>
          <Progress value={progressoPercentual} className="w-full">
            <ProgressLabel>Progresso da Atividade</ProgressLabel>
            <ProgressValue />
          </Progress>
        </CardHeader>
      </Card>
    </header>
  )
}
