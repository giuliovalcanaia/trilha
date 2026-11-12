import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { UserXIcon, UsersIcon } from "lucide-react"

import { StudentNameForm } from "@/components/aluno/student-name-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getProfessor } from "@/lib/auth/professor"
import { getParticipacaoDoAluno } from "@/lib/auth/estudante"
import { getAlunosParaContinuar } from "@/lib/data/aluno"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Seu nome",
  robots: { index: false, follow: false },
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string; expulso?: string }>
}) {
  const { codigo, expulso } = await searchParams
  const codigoAtividade = codigo?.trim().toUpperCase()

  if (!codigoAtividade) redirect("/")

  const professor = await getProfessor()

  if (professor) redirect("/painel")

  const participacao = await getParticipacaoDoAluno(codigoAtividade)

  // Quem já está conectado não precisa escolher o nome de novo: voltar para o
  // código retoma a atividade direto. A conexão errada é corrigida pelo
  // professor com "Derrubar conexão".
  if (participacao && !participacao.participacao.expulso_em) {
    redirect(`/atividade?codigo=${encodeURIComponent(codigoAtividade)}`)
  }

  const expulsoDaAtividade =
    expulso === "1" || Boolean(participacao?.participacao.expulso_em)

  const supabase = await createClient()
  const alunos = expulsoDaAtividade
    ? null
    : await getAlunosParaContinuar(supabase, codigoAtividade)
  const podeContinuar = (alunos?.length ?? 0) > 0

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-4 p-4 pb-24">
      {expulsoDaAtividade && (
        <Alert variant="destructive" className="w-full max-w-sm">
          <UserXIcon />
          <AlertTitle>Você foi removido desta atividade</AlertTitle>
          <AlertDescription>
            O professor expulsou você desta atividade. Digite seu nome para
            entrar novamente.
          </AlertDescription>
        </Alert>
      )}
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Insira o seu nome:</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentNameForm codigo={codigoAtividade} />
        </CardContent>
      </Card>

      {podeContinuar && (
        <div className="fixed bottom-4 left-4 z-20">
          <Link
            href={`/aluno/continuar?codigo=${encodeURIComponent(
              codigoAtividade
            )}`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "bg-background/95 shadow-md backdrop-blur"
            )}
          >
            <UsersIcon data-icon="inline-start" />
            Continuar atividade
          </Link>
        </div>
      )}
    </div>
  )
}
