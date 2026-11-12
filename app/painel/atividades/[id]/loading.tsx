import { AtividadeLoading } from "@/components/painel/atividade-loading"

/**
 * Esqueleto do editor (`/painel/atividades/[id]`), que abre na aba Alunos.
 *
 * Precisa existir neste segmento dinâmico: sem um `loading.tsx` próprio a
 * rota não é prefetchada e o clique parecia não responder. A criação
 * (`/painel/atividades/nova`) continua usando o esqueleto de Configurações do
 * `loading.tsx` de `atividades/`.
 */
export default function Loading() {
  return <AtividadeLoading aba="alunos" />
}
