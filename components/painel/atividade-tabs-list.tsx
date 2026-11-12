import { TabsList, TabsTrigger } from "@/components/ui/tabs"

type AtividadeTabsListProps = {
  modo: "criar" | "editar"
  alunosCount?: number
}

/**
 * Abas compartilhadas: Alunos → Configurações.
 *
 * Alunos vem primeiro porque é a aba mais usada no dia a dia. Na criação,
 * ela fica desabilitada (o código de entrada só existe depois que a
 * atividade é criada) e a aba ativa é Configurações.
 */
export function AtividadeTabsList({
  modo,
  alunosCount = 0,
}: AtividadeTabsListProps) {
  const criando = modo === "criar"

  return (
    <TabsList variant="line">
      <TabsTrigger
        value="alunos"
        disabled={criando}
        title={criando ? "Disponível depois de criar a atividade" : undefined}
        aria-label={
          criando
            ? "Alunos (disponível depois de criar a atividade)"
            : `Alunos (${alunosCount})`
        }
      >
        Alunos{criando ? "" : ` (${alunosCount})`}
      </TabsTrigger>
      <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
    </TabsList>
  )
}
