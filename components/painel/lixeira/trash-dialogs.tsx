"use client"

import { useRouter } from "next/navigation"

import { purgeTrash } from "@/app/painel/actions/lixeira"
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
import type { ItemLixeira } from "@/lib/dominio/lixeira"

/**
 * Confirmação de exclusão definitiva.
 *
 * Fica dirigido por estado (`item` nulo = fechado) porque o menu `⋯` fecha
 * antes de o diálogo abrir; um trigger aninhado no dropdown brigaria com o
 * fechamento do menu.
 */
export function PurgeDialog({
  item,
  onOpenChange,
}: {
  item: ItemLixeira | null
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  return (
    <AlertDialog open={item !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {item
              ? `Excluir “${item.nome}” definitivamente?`
              : "Excluir definitivamente?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {item?.tipo === "pasta" && item.atividadeCount > 0
              ? "Essa ação não pode ser desfeita. As subpastas, as atividades, os códigos, os nomes e o progresso dos alunos serão apagados junto."
              : "Essa ação não pode ser desfeita. Códigos, nomes e progresso dos alunos serão apagados junto."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <ActionForm
            action={purgeTrash}
            className="contents"
            onSuccess={() => {
              onOpenChange(false)
              router.refresh()
            }}
          >
            <input type="hidden" name="trash_id" value={item?.trashId ?? ""} />
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <SubmitButton variant="destructive" pendingLabel="Excluindo...">
              Excluir definitivamente
            </SubmitButton>
          </ActionForm>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
