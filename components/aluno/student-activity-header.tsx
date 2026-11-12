import type { ReactNode } from "react"

import { Card, CardHeader } from "@/components/ui/card"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"

type StudentActivityHeaderProps = {
  titulo: string
  /** Nome do aluno no título; na tela do aluno é editável. */
  nome?: ReactNode
  subtitulo: string | null
  meta?: ReactNode
  concluidas: number
  total: number
  /**
   * Ação exibida no canto superior direito, ao lado do título. A prévia do
   * professor não passa nada; a tela do aluno passa o botão "Sair".
   */
  acao?: ReactNode
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
  nome,
  subtitulo,
  meta,
  concluidas,
  total,
  acao,
}: StudentActivityHeaderProps) {
  const progressoPercentual =
    total > 0 ? Math.round((concluidas / total) * 100) : 0

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-[calc(0.75rem_+_env(safe-area-inset-top))] pr-[calc(1rem_+_env(safe-area-inset-right))] pb-3 pl-[calc(1rem_+_env(safe-area-inset-left))] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {titulo}
            {nome && (
              <>
                {/*
                  NBSP depois do hífen: com um espaço comum, o navegador
                  colapsa o espaço no fim da linha quando o nome está vazio e
                  o cursor fica colado no "-"; ao digitar, o espaço reaparece
                  e o texto "pula".
                */}
                {" -\u00A0"}
                {nome}
              </>
            )}
          </h1>
          {nome && (
            <span id="dica-editar-nome" className="sr-only">
              Clique no nome para editar.
            </span>
          )}
          {subtitulo && (
            <p className="text-sm text-muted-foreground sm:text-base">
              {subtitulo}
            </p>
          )}
          {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
        </div>
        {acao}
      </div>
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
