"use client"

import * as React from "react"
import { useEffect, useRef } from "react"
import { HouseIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  moveAtividade,
  movePasta,
  renameAtividade,
  renamePasta,
  trashAtividade,
  trashPasta,
  trashSelecionados,
  undoTrash,
  createPasta,
  type ActionResult,
} from "@/app/painel/actions"
import { useSelecao } from "@/components/painel/selecao-context"
import { ActionForm } from "@/components/painel/action-form"
import { SubmitButton } from "@/components/painel/submit-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { toast } from "@/components/ui/toast"
import {
  flattenPastas,
  pastaDescendantIds,
  type PastaRow,
} from "@/lib/dominio/pastas"
import type { ExplorerItem } from "@/components/painel/explorer/explorer-types"
import { cn } from "@/lib/utils"

type FormAction = (
  state: ActionResult,
  formData: FormData
) => Promise<ActionResult>

export function NewFolderDialog({
  open,
  onOpenChange,
  parentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentId: number | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pasta</DialogTitle>
          <DialogDescription>
            Crie uma pasta dentro do local atual.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={createPasta}
          resetOnSuccess
          onSuccess={() => onOpenChange(false)}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="parent_id" value={parentId ?? ""} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nova-pasta-nome">Nome da pasta</FieldLabel>
              <Input
                id="nova-pasta-nome"
                name="nome"
                placeholder="Ex.: Aulas de 2026"
                autoComplete="off"
                autoFocus
                required
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <SubmitButton pendingLabel="Criando...">Criar pasta</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

export function RenameDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ExplorerItem
}) {
  const pasta = item.tipo === "pasta"
  const action: FormAction = pasta ? renamePasta : renameAtividade
  const nome = pasta ? item.nome : item.titulo

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear {pasta ? "pasta" : "atividade"}</DialogTitle>
          <DialogDescription>
            O novo nome aparece para você no painel.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={action}
          onSuccess={() => onOpenChange(false)}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={item.id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="renomear-nome">Nome</FieldLabel>
              <Input
                id="renomear-nome"
                name={pasta ? "nome" : "titulo"}
                defaultValue={nome}
                autoComplete="off"
                autoFocus
                required
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <SubmitButton pendingLabel="Salvando...">Salvar</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

export function MoveDialog({
  open,
  onOpenChange,
  item,
  pastas,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ExplorerItem
  pastas: PastaRow[]
}) {
  const pasta = item.tipo === "pasta"
  const action: FormAction = pasta ? movePasta : moveAtividade
  const atual = pasta ? item.parent_id : item.pasta_id
  const destinoName = pasta ? "parent_id" : "pasta_id"
  const bloqueadas = pasta
    ? pastaDescendantIds(pastas, item.id)
    : new Set<number>()
  const opcoes = flattenPastas(pastas).filter(
    (opcao) => !bloqueadas.has(opcao.id)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Mover {pasta ? "pasta" : "atividade"} para...
          </DialogTitle>
          <DialogDescription>
            Escolha o destino. Você também pode arrastar o item no explorador.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={action}
          onSuccess={() => onOpenChange(false)}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={item.id} />
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
                atual === null && "bg-accent"
              )}
            >
              <input
                type="radio"
                name={destinoName}
                value=""
                defaultChecked={atual === null}
                className="accent-primary"
              />
              <HouseIcon className="size-4 text-muted-foreground" />
              Início (raiz)
            </label>
            {opcoes.map((opcao) => (
              <label
                key={opcao.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md py-2 pr-2 text-sm hover:bg-accent",
                  atual === opcao.id && "bg-accent"
                )}
                style={{ paddingLeft: `${8 + opcao.depth * 16}px` }}
              >
                <input
                  type="radio"
                  name={destinoName}
                  value={opcao.id}
                  defaultChecked={atual === opcao.id}
                  className="accent-primary"
                />
                <span className="truncate">{opcao.nome}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <SubmitButton pendingLabel="Movendo...">Mover</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

export function TrashConfirm({
  open,
  onOpenChange,
  tipo,
  id,
  nome,
  redirectTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipo: "pasta" | "atividade"
  id: number
  nome: string
  redirectTo?: string
}) {
  const router = useRouter()
  const { limpar } = useSelecao()
  const action = tipo === "pasta" ? trashPasta : trashAtividade
  const [state, formAction] = React.useActionState(action, { error: null })
  const handled = useRef<ActionResult | null>(null)

  useEffect(() => {
    if (state === handled.current) return
    handled.current = state

    if (state.error) {
      toast.add({ type: "error", title: state.error })
      return
    }

    if (!state.success) return

    limpar()
    toast.add({
      type: "info",
      title: state.success,
      actionProps: state.trashId
        ? {
            children: "Desfazer",
            onClick: () => {
              void (async () => {
                const result = await undoTrash(state.trashId!)
                if (result.error) {
                  toast.add({ type: "error", title: result.error })
                  return
                }
                toast.add({
                  type: "success",
                  title: result.success ?? "Item restaurado.",
                })
                router.refresh()
              })()
            },
          }
        : undefined,
    })

    onOpenChange(false)

    if (redirectTo) {
      router.push(redirectTo)
    } else {
      router.refresh()
    }
  }, [state, onOpenChange, redirectTo, router, limpar])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Mover {tipo === "pasta" ? "a pasta" : "a atividade"} “{nome}” para a
            lixeira?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {tipo === "pasta"
              ? "As subpastas e as atividades dentro dela também vão para a lixeira. Você pode restaurar tudo depois."
              : "O código de entrada, os nomes e o progresso dos alunos continuam guardados e voltam se você restaurar a atividade."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <form action={formAction} className="contents">
            <input type="hidden" name="id" value={id} />
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <SubmitButton variant="destructive" pendingLabel="Movendo...">
              <Trash2Icon data-icon="inline-start" />
              Mover para a lixeira
            </SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function TrashSelecionadosConfirm({
  open,
  onOpenChange,
  chaves,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chaves: string[]
}) {
  const router = useRouter()
  const { limpar } = useSelecao()
  const [state, formAction] = React.useActionState(trashSelecionados, {
    error: null,
  })
  const handled = useRef<ActionResult | null>(null)
  const total = chaves.length

  useEffect(() => {
    if (state === handled.current) return
    handled.current = state

    if (state.error) {
      toast.add({ type: "error", title: state.error })
      return
    }

    if (!state.success) return

    limpar()
    toast.add({
      type: "info",
      title: state.success,
      actionProps: state.trashId
        ? {
            children: "Desfazer",
            onClick: () => {
              void (async () => {
                const result = await undoTrash(state.trashId!)
                if (result.error) {
                  toast.add({ type: "error", title: result.error })
                  return
                }
                toast.add({
                  type: "success",
                  title: result.success ?? "Itens restaurados.",
                })
                router.refresh()
              })()
            },
          }
        : undefined,
    })

    onOpenChange(false)
    router.refresh()
  }, [state, onOpenChange, router, limpar])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Mover {total} {total === 1 ? "item" : "itens"} para a lixeira?
          </AlertDialogTitle>
          <AlertDialogDescription>
            As subpastas e as atividades dentro dos itens selecionados também
            vão para a lixeira. Você pode restaurar tudo depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <form action={formAction} className="contents">
            <input type="hidden" name="itens" value={JSON.stringify(chaves)} />
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <SubmitButton variant="destructive" pendingLabel="Movendo...">
              <Trash2Icon data-icon="inline-start" />
              Mover para a lixeira
            </SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
