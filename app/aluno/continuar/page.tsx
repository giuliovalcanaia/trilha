import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { ContinueActivityGrid } from "@/components/aluno/continue-activity-grid"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getParticipacaoDoAluno } from "@/lib/auth/estudante"
import { getProfessor } from "@/lib/auth/professor"
import { getAlunosParaContinuar } from "@/lib/data/aluno"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Continuar atividade",
  robots: { index: false, follow: false },
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>
}) {
  const { codigo } = await searchParams
  const codigoAtividade = codigo?.trim().toUpperCase()

  if (!codigoAtividade) redirect("/")

  const professor = await getProfessor()

  if (professor) redirect("/painel")

  const participacao = await getParticipacaoDoAluno(codigoAtividade)

  if (participacao) {
    if (participacao.participacao.expulso_em) {
      redirect(`/aluno?codigo=${encodeURIComponent(codigoAtividade)}&expulso=1`)
    }

    redirect(`/atividade?codigo=${encodeURIComponent(codigoAtividade)}`)
  }

  const supabase = await createClient()
  const alunos = await getAlunosParaContinuar(supabase, codigoAtividade)

  if (!alunos || alunos.length === 0) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigoAtividade)}`)
  }

  const ordenados = [...alunos].sort(
    (a, b) =>
      a.aluno_nome.localeCompare(b.aluno_nome, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      }) || a.entrou_em.localeCompare(b.entrou_em)
  )

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Continuar atividade</CardTitle>
          <CardDescription>
            Escolha o nome que você usou na aula anterior. Se não encontrar o
            seu nome, volte e digite-o.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContinueActivityGrid codigo={codigoAtividade} alunos={ordenados} />
        </CardContent>
      </Card>

      <Link
        href={`/aluno?codigo=${encodeURIComponent(codigoAtividade)}`}
        className={buttonVariants({ variant: "ghost" })}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Voltar
      </Link>
    </div>
  )
}
