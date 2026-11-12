"use client"

import { useState } from "react"
import { PencilIcon } from "lucide-react"

import { renameStudent } from "@/app/painel/actions/aluno"
import { ActionForm } from "@/components/painel/action-form"
import { SubmitButton } from "@/components/painel/submit-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NOME_ALUNO_MAX } from "@/lib/dominio/limites"
import { avisarContinuar } from "@/lib/supabase/broadcast"
import { createClient } from "@/lib/supabase/client"

/**
 * Corrige o nome de um aluno na aba Alunos. O nome vive na participação, então
 * a mudança não afeta o progresso nem a conexão; quem estiver na grade de
 * nomes da atividade é avisado por broadcast para atualizar na hora.
 */
export function RenameStudentButton({
  atividadeId,
  participacaoId,
  nome,
  codigo,
}: {
  atividadeId: number
  participacaoId: number
  nome: string
  codigo: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" type="button" />}
        aria-label={`Editar nome de ${nome}`}
        title="Editar nome"
      >
        <PencilIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar nome do aluno</DialogTitle>
          <DialogDescription>
            O novo nome aparece na lista, no painel e na tela do aluno. O
            progresso e a conexão continuam como estão.
          </DialogDescription>
        </DialogHeader>

        <ActionForm
          action={renameStudent}
          className="flex flex-col gap-4"
          onSuccess={() => {
            setOpen(false)
            void avisarContinuar(createClient(), codigo)
          }}
        >
          <input type="hidden" name="atividade_id" value={atividadeId} />
          <input type="hidden" name="participacao_id" value={participacaoId} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`nome-${participacaoId}`}>Nome</FieldLabel>
              <Input
                key={nome}
                id={`nome-${participacaoId}`}
                name="nome"
                type="text"
                autoComplete="off"
                defaultValue={nome}
                maxLength={NOME_ALUNO_MAX}
                autoFocus
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <SubmitButton>Salvar</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
