"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // O digest permite correlacionar com os logs do servidor sem expor detalhes
    // técnicos para o aluno ou o professor.
    console.error("Erro não tratado:", {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-5" />
          </div>
          <CardTitle>Algo deu errado</CardTitle>
          <CardDescription>
            Não foi possível carregar esta página. Tente novamente; se o
            problema continuar, fale com o suporte.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={reset}>Tentar novamente</Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Ir para o início
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
