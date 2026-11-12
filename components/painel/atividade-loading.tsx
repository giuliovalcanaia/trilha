import { Bloco } from "@/components/painel/loading-bloco"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

type AtividadeLoadingProps = {
  aba: "alunos" | "configuracoes"
}

/**
 * Esqueleto do editor de atividade.
 *
 * As medidas seguem o editor real (mesmo `space-y-6`, mesmos cards) para o
 * conteúdo não "pular" quando substituir o esqueleto. A aba é escolhida pela
 * rota: a criação abre em Configurações, o editor abre em Alunos.
 */
export function AtividadeLoading({ aba }: AtividadeLoadingProps) {
  return (
    <div
      className="w-full space-y-6"
      role="status"
      aria-label="Carregando atividade"
    >
      <span className="sr-only">Carregando atividade…</span>

      {/* Cabeçalho: voltar, título, subtítulo, meta e ação */}
      <div className="space-y-2" aria-hidden>
        <Bloco className="h-8 w-16 rounded-lg" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Bloco className="h-9 w-64 max-w-full" />
            <Bloco className="h-5 w-52 max-w-full" />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Bloco className="h-4 w-24" />
              <Bloco className="h-4 w-20" />
              <Bloco className="h-4 w-16" />
            </div>
          </div>
          <Bloco className="h-8 w-40" />
        </div>
      </div>

      <div className="space-y-4" aria-hidden>
        {/* Abas Alunos | Configurações */}
        <div className="flex h-9 items-center gap-6 border-b">
          <Bloco className="h-4 w-16" />
          <Bloco className="h-4 w-28" />
        </div>

        {aba === "alunos" ? <AlunosSkeleton /> : <ConfiguracoesSkeleton />}
      </div>
    </div>
  )
}

/** Aba Alunos: card do código de entrada + linhas dos alunos. */
function AlunosSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Bloco className="h-5 w-36" />
              <Bloco className="h-5 w-16 rounded-full" />
              <Bloco className="h-5 w-14 rounded-full" />
            </div>
            <Bloco className="h-4 w-56" />
            <Bloco className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Bloco className="h-8 w-32" />
            <Bloco className="h-8 w-36" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Bloco className="h-10 w-full" />
        <Bloco className="h-10 w-full" />
        <Bloco className="h-10 w-full" />
      </CardContent>
    </Card>
  )
}

/** Aba Configurações: aviso do topo, links, ordem dos links e senha. */
function ConfiguracoesSkeleton() {
  return (
    <>
      {/* Aviso de que título e subtítulo são editáveis no topo */}
      <Bloco className="h-4 w-full max-w-md" />

      {/* Card de links: textarea + Salvar/Pré-visualizar */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="w-full max-w-md space-y-2">
              <Bloco className="h-5 w-16" />
              <Bloco className="h-4 w-full" />
              <Bloco className="h-4 w-2/3" />
            </div>
            <div className="flex gap-2">
              <Bloco className="h-8 w-32" />
              <Bloco className="h-8 w-28" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Bloco className="h-56 w-full" />
        </CardContent>
      </Card>

      {/* Card "Ordem dos links" */}
      <Card>
        <CardHeader>
          <Bloco className="h-5 w-40" />
          <Bloco className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent>
          <Bloco className="h-9 w-full max-w-md" />
        </CardContent>
      </Card>

      {/* Card da senha de liberação */}
      <Card>
        <CardHeader>
          <Bloco className="h-5 w-44" />
          <Bloco className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Bloco className="h-9 w-full max-w-sm" />
          <div className="flex justify-end">
            <Bloco className="h-8 w-28" />
          </div>
        </CardContent>
      </Card>
    </>
  )
}
