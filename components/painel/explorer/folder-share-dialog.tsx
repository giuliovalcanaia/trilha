"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { UserXIcon } from "lucide-react"

import {
  getFolderShare,
  shareFolder,
  unshareFolder,
} from "@/app/painel/actions/compartilhamento"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { PastaCompartilhamento } from "@/lib/painel/compartilhamento"

/**
 * Diálogo de compartilhamento de uma pasta, aberto pelo menu de contexto.
 * Carrega os acessos ao abrir: o dono gerencia quem entra, quem recebeu o
 * acesso vê de quem é a pasta e não pode compartilhar.
 */
export function FolderShareDialog({
  pastaId,
  nome,
  open,
  onOpenChange,
}: {
  pastaId: number
  nome: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [compartilhamento, setCompartilhamento] =
    useState<PastaCompartilhamento | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [email, setEmail] = useState("")
  const [pending, startTransition] = useTransition()

  const carregar = useCallback(() => {
    setCarregando(true)

    void getFolderShare(pastaId).then((resultado) => {
      setCarregando(false)

      if (resultado.error) {
        toast.add({ type: "error", title: resultado.error })
        return
      }

      setCompartilhamento(resultado.compartilhamento)
    })
  }, [pastaId])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento sob demanda ao abrir o diálogo
    carregar()
  }, [open, carregar])

  function aoMudarAberto(valor: boolean) {
    if (!valor) {
      setEmail("")
      setCompartilhamento(null)
    }
    onOpenChange(valor)
  }

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
      carregar()
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
      carregar()
    })
  }

  const total = compartilhamento?.compartilhamentos.length ?? 0

  return (
    <Dialog open={open} onOpenChange={aoMudarAberto}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar “{nome}”</DialogTitle>
          <DialogDescription>
            {compartilhamento?.isOwner === false
              ? "Esta pasta foi compartilhada com você. Você pode editar e criar itens nela e nas subpastas."
              : "Professores com acesso podem editar e criar itens nesta pasta e nas subpastas. Só o dono pode compartilhar ou remover o acesso."}
          </DialogDescription>
        </DialogHeader>

        {carregando && !compartilhamento ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !compartilhamento ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar o compartilhamento desta pasta.
            </p>
            <Button type="button" variant="outline" onClick={carregar}>
              Tentar de novo
            </Button>
          </div>
        ) : compartilhamento.isOwner ? (
          <>
            <FieldGroup>
              <form onSubmit={compartilhar}>
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
                      Compartilhar
                    </Button>
                  </div>
                </Field>
              </form>
            </FieldGroup>

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
          </>
        ) : (
          <p className="text-sm">
            Compartilhada por{" "}
            <span className="font-medium">
              {compartilhamento.owner.nome || "outro professor"}
            </span>
            .
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
