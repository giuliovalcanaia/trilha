import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { UserXIcon } from "lucide-react"

import { StudentNameForm } from "@/components/aluno/student-name-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getProfessor } from "@/lib/auth/professor"

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

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-4 p-4">
      {expulso === "1" && (
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
    </div>
  )
}
