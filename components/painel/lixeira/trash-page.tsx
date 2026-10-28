"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HouseIcon, SearchIcon, Trash2Icon } from "lucide-react"

import { emptyTrash, undoTrash } from "@/app/painel/actions/lixeira"
import { ConfirmAction } from "@/components/painel/confirm-action"
import { PurgeDialog } from "@/components/painel/lixeira/trash-dialogs"
import { TrashItemView } from "@/components/painel/lixeira/trash-item"
import { TrashToolbar } from "@/components/painel/lixeira/trash-toolbar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "@/components/ui/toast"
import { useStoredPreference } from "@/hooks/use-stored-preference"
import {
  filtrarLixeira,
  ORDENS_LIXEIRA,
  ordenarLixeira,
  type ItemLixeira,
} from "@/lib/dominio/lixeira"
import { cn } from "@/lib/utils"

const VIEWS = ["lista", "grade"] as const

/**
 * Lixeira com o visual do explorador: caminho, busca, visão, ordenação e as
 * mesmas linhas usadas em `/painel`.
 *
 * Restaurar não pede confirmação (dá para mover de novo); excluir
 * definitivamente sempre pede.
 */
export function TrashPage({ groups }: { groups: ItemLixeira[] }) {
  const router = useRouter()
  const [view, setView] = useStoredPreference("lixeira:view", VIEWS, "lista")
  const [ordem, setOrdem] = useStoredPreference(
    "lixeira:ordem",
    ORDENS_LIXEIRA,
    "movido-desc"
  )
  const [query, setQuery] = useState("")
  const [purgando, setPurgando] = useState<ItemLixeira | null>(null)
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const termo = query.trim()

  const visiveis = useMemo(
    () => ordenarLixeira(filtrarLixeira(groups, termo), ordem),
    [groups, termo, ordem]
  )

  const buscando = termo.length > 0

  function restaurar(item: ItemLixeira) {
    if (restaurando) return
    setRestaurando(item.trashId)

    startTransition(async () => {
      const result = await undoTrash(item.trashId)
      setRestaurando(null)

      if (result.error) {
        toast.add({ type: "error", title: result.error })
        return
      }

      toast.add({
        type: "success",
        title: result.success ?? "Item restaurado.",
      })
      router.refresh()
    })
  }

  const esvaziar = (
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
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="sr-only">Lixeira</h1>

      <TrashToolbar
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={setView}
        ordem={ordem}
        onOrdemChange={setOrdem}
        mostrarControles={groups.length > 0}
        acoes={groups.length > 0 ? esvaziar : undefined}
      />

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2Icon className="size-5 text-muted-foreground" />A lixeira
              está vazia
            </CardTitle>
            <CardDescription>
              Quando você mover uma pasta ou atividade para a lixeira, ela
              aparece aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/painel"
              className={buttonVariants({ variant: "outline" })}
            >
              <HouseIcon data-icon="inline-start" />
              Ir para o painel
            </Link>
          </CardContent>
        </Card>
      ) : visiveis.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="size-5 text-muted-foreground" />
              Nenhum resultado
            </CardTitle>
            <CardDescription>
              Não encontramos itens na lixeira com esse nome ou nessa pasta de
              origem.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div
          role="list"
          aria-label="Itens na lixeira"
          className={cn(
            view === "lista"
              ? "flex flex-col gap-2"
              : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {visiveis.map((item) => (
            <TrashItemView
              key={item.trashId}
              item={item}
              view={view}
              restaurando={restaurando === item.trashId}
              onRestore={() => restaurar(item)}
              onPurge={() => setPurgando(item)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {visiveis.length} item(ns)
        {buscando ? ` para “${termo}”` : ""}
      </p>

      <PurgeDialog
        item={purgando}
        onOpenChange={(open) => {
          if (!open) setPurgando(null)
        }}
      />
    </div>
  )
}
