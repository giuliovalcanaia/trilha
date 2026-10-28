import { Bloco } from "@/components/painel/loading-bloco"

/**
 * Esqueleto do explorador de pastas e atividades.
 *
 * Cobre `/painel` e `/painel/pastas/[id]`, que são as rotas para onde o
 * professor volta ao sair de uma atividade. Sem este arquivo a rota dinâmica
 * não é prefetchada e o "Voltar" fica sem resposta visível até o servidor
 * devolver o explorador inteiro (pastas + atividades + contadores).
 *
 * Imita a visão de lista, que é o default de `painel:view`. Quem usa grade vê
 * o layout se ajustar uma vez, quando o conteúdo real entra.
 *
 * A sidebar não aparece aqui: ela é do layout do painel e continua montada.
 */
export default function Loading() {
  return (
    <div
      className="flex w-full flex-col gap-4"
      role="status"
      aria-label="Carregando painel"
    >
      <span className="sr-only">Carregando painel…</span>

      {/* Breadcrumb da pasta atual */}
      <div className="flex items-center gap-2" aria-hidden>
        <Bloco className="h-4 w-14" />
        <Bloco className="h-3 w-3" />
        <Bloco className="h-4 w-24" />
      </div>

      {/* Barra de ferramentas: busca, visão, ordem e ações */}
      <div className="flex flex-wrap items-center gap-2" aria-hidden>
        <Bloco className="h-9 w-full max-w-xs rounded-lg" />
        <Bloco className="h-9 w-20 rounded-lg" />
        <Bloco className="h-9 w-36 rounded-lg" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Bloco className="h-9 w-28 rounded-lg" />
          <Bloco className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Itens da pasta */}
      <div className="flex flex-col gap-2" aria-hidden>
        {Array.from({ length: 5 }, (_, indice) => (
          <div
            key={indice}
            className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5"
          >
            <Bloco className="size-4 rounded" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Bloco className="h-4 w-40 max-w-full" />
              <Bloco className="h-3 w-56 max-w-full" />
            </div>
            <Bloco className="hidden h-5 w-16 rounded-full sm:block" />
            <Bloco className="hidden h-3 w-24 md:block" />
            <Bloco className="size-7 rounded-md" />
          </div>
        ))}
      </div>

      <Bloco className="h-3 w-24" />
    </div>
  )
}
