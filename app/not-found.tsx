import Link from "next/link"
import { SearchXIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <SearchXIcon className="size-5" />
          </div>
          <CardTitle>Página não encontrada</CardTitle>
          <CardDescription>
            O endereço pode estar errado ou o conteúdo foi removido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/" />}>
            Voltar para o início
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
