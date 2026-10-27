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

/** Cabeçalho da atividade do aluno, compartilhado com a pré-visualização. */
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
    <div className="m-4 mt-4">
      <h1 className="scroll-m-24 text-2xl font-semibold tracking-tight sm:text-3xl">
        {titulo}
      </h1>
      {subtitulo && (
        <p className="text-muted-foreground sm:text-base">{subtitulo}</p>
      )}
      {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
      <Card className="mt-4">
        <CardHeader>
          <Progress value={progressoPercentual} className="w-full">
            <ProgressLabel>Progresso da Atividade</ProgressLabel>
            <ProgressValue />
          </Progress>
        </CardHeader>
      </Card>
    </div>
  )
}
