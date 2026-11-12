import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeftIcon, UnplugIcon } from "lucide-react"

import { ContinueActivityGrid } from "@/components/aluno/continue-activity-grid"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Continuar atividade",
  robots: { index: false, follow: false },
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string; desconectado?: string }>
}) {
  const { codigo, desconectado } = await searchParams
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
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 p-4 pt-16">
      <div className="fixed top-[calc(1rem_+_env(safe-area-inset-top))] left-[calc(1rem_+_env(safe-area-inset-left))] z-20">
        <Link
          href={`/aluno?codigo=${encodeURIComponent(codigoAtividade)}`}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "min-h-11 bg-background/95 backdrop-blur sm:min-h-0"
          )}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Voltar
        </Link>
      </div>

      {desconectado === "1" && (
        <Alert className="w-full max-w-3xl">
          <UnplugIcon />
          <AlertTitle>Conexão encerrada</AlertTitle>
          <AlertDescription>
            O professor liberou a sua conexão. Escolha o seu nome para continuar
            de onde parou.
          </AlertDescription>
        </Alert>
      )}

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
    </div>
  )
}
