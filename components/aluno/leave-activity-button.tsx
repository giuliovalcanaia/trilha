"use client"

import { useState, useTransition } from "react"
import { LoaderCircleIcon, LogOutIcon } from "lucide-react"

import { sairDaAtividade } from "@/app/atividade/actions"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

/**
 * "Sair" da atividade: some com a conexão na hora e devolve o aluno à grade de
 * nomes, para corrigir um nome escolhido por engano. O progresso do nome
 * anterior fica salvo no banco.
 */
export function LeaveActivityButton({
  aplicacaoId,
  codigo,
  nome,
}: {
  aplicacaoId: number
  codigo: string
  nome: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function sair() {
    startTransition(async () => {
      const resultado = await sairDaAtividade(aplicacaoId, codigo)

      // No caminho feliz o server action redireciona e nada daqui roda.
      if (resultado.error) {
        setOpen(false)
        toast.add({ type: "error", title: resultado.error })
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 shrink-0 text-muted-foreground sm:min-h-0"
          />
        }
      >
        <LogOutIcon />
        Sair
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sair da atividade?</AlertDialogTitle>
          <AlertDialogDescription>
            Você volta para a lista de nomes e o nome{" "}
            <span className="font-medium text-foreground">{nome}</span> fica
            livre para outra pessoa. Seu progresso continua salvo — escolha o
            mesmo nome de novo para retomar de onde parou.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button onClick={sair} disabled={pending}>
            {pending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <LogOutIcon />
            )}
            Sair
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
