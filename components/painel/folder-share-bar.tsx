"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Share2Icon, UserXIcon, UsersIcon } from "lucide-react"

import { shareFolder, unshareFolder } from "@/app/painel/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import type { PastaCompartilhamento } from "@/lib/painel/explorer-data"

/**
 * Barra de compartilhamento da pasta aberta. O dono vê/gerencia os acessos;
 * quem recebeu o acesso vê de quem é a pasta e não pode compartilhar.
 */
export function FolderShareBar({
  pastaId,
  nome,
  compartilhamento,
}: {
  pastaId: number
  nome: string
  compartilhamento: PastaCompartilhamento
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [pending, startTransition] = useTransition()

  const total = compartilhamento.compartilhamentos.length

  function compartilhar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const valor = email.trim()

    if (!valor) {
      toast.add({ type: "warning", title: "Informe o e-mail do professor." })
      return
    }

    startTransition(async () => {
      const resultado = await shareFolder(pastaId, valor)

      if (resultado.error) {
        toast.add({ type: "error", title: resultado.error })
        return
      }

      setEmail("")
      toast.add({ type: "success", title: "Pasta compartilhada." })
      router.refresh()
    })
  }

  function remover(professorId: number) {
    if (pending) return

    startTransition(async () => {
      const resultado = await unshareFolder(pastaId, professorId)

      if (resultado.error) {
        toast.add({ type: "error", title: resultado.error })
        return
      }

      toast.add({ type: "success", title: "Acesso removido." })
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <UsersIcon className="size-4 shrink-0 text-muted-foreground" />
          {compartilhamento.isOwner ? (
            <span>
              {total === 0
                ? "Só você tem acesso a esta pasta."
                : `Compartilhada com ${total} pessoa(s).`}
            </span>
          ) : (
            <span>
              Compartilhada por{" "}
              <span className="font-medium">
                {compartilhamento.owner.nome || "outro professor"}
              </span>
              .
            </span>
          )}
        </div>

        {compartilhamento.isOwner ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Share2Icon data-icon="inline-start" />
            Compartilhar
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Você pode editar e criar itens.
          </span>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar “{nome}”</DialogTitle>
            <DialogDescription>
              Professores com acesso podem editar e criar itens nesta pasta e
              nas subpastas. Só você pode compartilhar ou remover o acesso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={compartilhar} className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="compartilhar-email">
                E-mail do professor
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="compartilhar-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="professor@escola.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={pending}
                />
                <Button type="submit" disabled={pending}>
                  {pending ? "..." : "Compartilhar"}
                </Button>
              </div>
            </Field>
          </form>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Quem tem acesso</p>

            {total > 0 ? (
              <ul className="flex flex-col gap-2">
                {compartilhamento.compartilhamentos.map((professor) => (
                  <li
                    key={professor.professorId}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{professor.nome}</p>
                      {professor.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {professor.email}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover acesso de ${professor.nome}`}
                      onClick={() => remover(professor.professorId)}
                      disabled={pending}
                    >
                      <UserXIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ainda não compartilhada com ninguém.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
