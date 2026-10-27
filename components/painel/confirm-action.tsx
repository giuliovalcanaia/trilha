"use client"

import { useState, type ReactElement } from "react"
import { Trash2Icon } from "lucide-react"

import type { ActionResult } from "@/lib/actions/result"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type ConfirmActionProps = {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>
  fields: Record<string, string | number>
  title: string
  description: string
  confirmLabel?: string
  triggerLabel?: string
  trigger?: ReactElement
}

export function ConfirmAction({
  action,
  fields,
  title,
  description,
  confirmLabel = "Excluir",
  triggerLabel = "Excluir",
  trigger,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <AlertDialogTrigger render={trigger} />
      ) : (
        <AlertDialogTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label={triggerLabel}
        >
          <Trash2Icon />
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <ActionForm
            action={action}
            className="contents"
            onSuccess={() => setOpen(false)}
          >
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <SubmitButton variant="destructive">{confirmLabel}</SubmitButton>
          </ActionForm>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
