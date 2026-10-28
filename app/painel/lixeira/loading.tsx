import { Bloco } from "@/components/painel/loading-bloco"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/**
 * Esqueleto da lixeira.
 *
 * Existe porque `app/painel/loading.tsx` cobre todo o segmento: sem este
 * arquivo, `/painel/lixeira` mostraria o esqueleto do explorador (busca,
 * pastas, atividades), que não tem nada a ver com a tela.
 */
export default function Loading() {
  return (
    <div
      className="flex w-full max-w-4xl flex-col gap-4"
      role="status"
      aria-label="Carregando lixeira"
    >
      <span className="sr-only">Carregando lixeira…</span>

      {/* Cabeçalho: título, descrição e "Esvaziar meus itens" */}
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        aria-hidden
      >
        <div className="space-y-2">
          <Bloco className="h-9 w-32" />
          <Bloco className="h-4 w-96 max-w-full" />
        </div>
        <Bloco className="h-9 w-44 rounded-lg" />
      </div>

      <div className="flex flex-col gap-3" aria-hidden>
        {Array.from({ length: 2 }, (_, indice) => (
          <Card key={indice}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Bloco className="size-9 rounded-lg" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bloco className="h-5 w-40 max-w-full" />
                      <Bloco className="h-5 w-20 rounded-full" />
                    </div>
                    <Bloco className="h-4 w-72 max-w-full" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Bloco className="h-8 w-28 rounded-lg" />
                  <Bloco className="h-8 w-20 rounded-lg" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Bloco className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
