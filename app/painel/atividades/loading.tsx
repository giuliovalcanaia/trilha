import { AtividadeLoading } from "@/components/painel/atividade-loading"

/**
 * Esqueleto de `/painel/atividades/nova`.
 *
 * Fica em `atividades/`, então cobre a criação. O editor (`[id]`) tem o
 * próprio esqueleto, na aba Alunos. A rota é dinâmica: sem este arquivo o
 * Next pula o prefetch e o conteúdo anterior congela até o servidor responder
 * (era o que dava a impressão de clique perdido). Com ele, a rota passa a ser
 * parcialmente prefetchada e o esqueleto entra na hora, enquanto o conteúdo
 * real chega por streaming.
 */
export default function Loading() {
  return <AtividadeLoading aba="configuracoes" />
}
