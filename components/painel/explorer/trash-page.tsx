"use client"

import { FileTextIcon, FolderIcon, Trash2Icon, Undo2Icon } from "lucide-react"

import { emptyTrash, purgeTrash, restoreTrash } from "@/app/painel/actions"
import { ActionForm } from "@/components/painel/action-form"
import { ConfirmAction } from "@/components/painel/confirm-action"
import { SubmitButton } from "@/components/painel/submit-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { TrashGroup } from "@/lib/painel/trash-data"

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
})

export function TrashPage({ groups }: { groups: TrashGroup[] }) {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="scroll-m-24 text-2xl font-semibold tracking-tight sm:text-3xl">
            Lixeira
          </h1>
          <p className="text-sm text-muted-foreground">
            Restaure pastas e atividades ou exclua definitivamente. Os itens
            ficam aqui até você decidir.
          </p>
        </div>

        {groups.length > 0 && (
          <ConfirmAction
            action={emptyTrash}
            fields={{}}
            title="Esvaziar seus itens?"
            description="Serão excluídos definitivamente os itens da sua lixeira que pertencem a você ou às suas pastas, incluindo códigos, nomes e progresso dos alunos. Itens compartilhados de outros professores continuam na lixeira. Essa ação não pode ser desfeita."
            confirmLabel="Esvaziar meus itens"
            triggerLabel="Esvaziar meus itens"
            trigger={
              <Button variant="outline" type="button">
                <Trash2Icon data-icon="inline-start" />
                Esvaziar meus itens
              </Button>
            }
          />
        )}
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2Icon />A lixeira está vazia
            </CardTitle>
            <CardDescription>
              Quando você mover uma pasta ou atividade para a lixeira, ela
              aparece aqui.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <Card key={group.trashId}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {group.tipo === "pasta" ? (
                        <FolderIcon className="text-primary" />
                      ) : (
                        <FileTextIcon className="text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="truncate">{group.nome}</CardTitle>
                        <Badge variant="secondary">
                          {group.tipo === "pasta" ? "Pasta" : "Atividade"}
                        </Badge>
                      </div>
                      <CardDescription>
                        Original: {group.origem} · Movido em{" "}
                        {dateFormatter.format(new Date(group.deletedAt))}
                        {group.tipo === "pasta" && (
                          <>
                            {" "}
                            · {group.pastaCount} subpasta(s) ·{" "}
                            {group.atividadeCount} atividade(s)
                          </>
                        )}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ActionForm action={restoreTrash}>
                      <input
                        type="hidden"
                        name="trash_id"
                        value={group.trashId}
                      />
                      <SubmitButton
                        variant="outline"
                        size="sm"
                        pendingLabel="Restaurando..."
                      >
                        <Undo2Icon data-icon="inline-start" />
                        Restaurar
                      </SubmitButton>
                    </ActionForm>
                    <ConfirmAction
                      action={purgeTrash}
                      fields={{ trash_id: group.trashId }}
                      title={`Excluir “${group.nome}” definitivamente?`}
                      description="Essa ação não pode ser desfeita. Códigos, nomes e progresso dos alunos serão apagados junto."
                      confirmLabel="Excluir definitivamente"
                      triggerLabel="Excluir definitivamente"
                      trigger={
                        <Button variant="ghost" size="sm" type="button">
                          <Trash2Icon data-icon="inline-start" />
                          Excluir
                        </Button>
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              {group.tipo === "pasta" && group.atividadeCount > 0 && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Restaurar a pasta também restaura as subpastas e as
                    atividades que foram para a lixeira com ela.
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
