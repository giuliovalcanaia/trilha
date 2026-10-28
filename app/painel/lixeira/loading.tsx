import { Bloco } from "@/components/painel/loading-bloco"

/**
 * Esqueleto da lixeira.
 *
 * Existe porque `app/painel/loading.tsx` cobre todo o segmento: sem este
 * arquivo, `/painel/lixeira` mostraria o esqueleto do explorador (busca,
 * pastas, atividades), que não tem nada a ver com a tela.
 *
 * Imita a visão de lista, que é o default de `lixeira:view`, e repete as
 * medidas do `app/painel/loading.tsx` para o conteúdo não pular quando chega.
 */
export default function Loading() {
  return (
    <div
      className="flex w-full flex-col gap-4"
      role="status"
      aria-label="Carregando lixeira"
    >
      <span className="sr-only">Carregando lixeira…</span>

      {/* Caminho: Início › Lixeira (a linha tem a altura da navegação real) */}
      <div className="flex h-7 items-center gap-2" aria-hidden>
        <Bloco className="h-4 w-14" />
        <Bloco className="h-3 w-3" />
        <Bloco className="h-4 w-16" />
      </div>

      {/* Barra de ferramentas: busca, visão, ordem e "Esvaziar meus itens" */}
      <div className="flex flex-wrap items-center gap-2" aria-hidden>
        <Bloco className="h-9 w-full max-w-xs rounded-lg" />
        <Bloco className="h-9 w-20 rounded-lg" />
        <Bloco className="h-9 w-44 rounded-lg" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Bloco className="h-9 w-44 rounded-lg" />
        </div>
      </div>

      {/* Itens da lixeira */}
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
