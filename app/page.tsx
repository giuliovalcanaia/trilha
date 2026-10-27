import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { JoinCodeForm } from "@/components/aluno/join-code-form"

export default function Page() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center p-4">
      <nav className="absolute top-4 right-4">
        <Link
          href="/login"
          className={buttonVariants({ variant: "secondary" })}
        >
          Fazer login
        </Link>
      </nav>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Insira o código da atividade:</CardTitle>
        </CardHeader>
        <CardContent>
          <JoinCodeForm />
        </CardContent>
      </Card>
    </div>
  )
}
