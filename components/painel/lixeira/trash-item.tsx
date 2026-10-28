"use client"

import * as React from "react"
import {
  FileTextIcon,
  FolderIcon,
  LoaderCircleIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react"

import { ItemDropdown } from "@/components/painel/item-dropdown"
import {
  ContextMenuActions,
  type MenuAction,
} from "@/components/painel/item-menu"
import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { ItemLixeira } from "@/lib/dominio/lixeira"
import { formatarDataHoraLonga, formatarDataIso } from "@/lib/format"
import { cn } from "@/lib/utils"

type TrashItemProps = {
  item: ItemLixeira
  view: "lista" | "grade"
  /** A restauração está em andamento: mostra spinner e `aria-busy`. */
  restaurando?: boolean
  onRestore: () => void
  onPurge: () => void
}

/**
 * Linha (ou card) da lixeira.
 *
 * Herda as classes do `ExplorerItemView` de propósito: as duas telas precisam
 * parecer a mesma lista. O que muda é só o conteúdo (origem e data de
 * exclusão) e as ações (restaurar/excluir), já que aqui não há seleção nem
 * arraste.
 */
export function TrashItemView({
  item,
  view,
  restaurando = false,
  onRestore,
  onPurge,
}: TrashItemProps) {
  const pasta = item.tipo === "pasta"

  const legenda = pasta
    ? `Origem: ${item.origem} · ${item.pastaCount} pasta(s) · ${item.atividadeCount} atividade(s)`
    : `Origem: ${item.origem}`

  const actions: MenuAction[] = [
    {
      kind: "item",
      key: "restaurar",
      label: "Restaurar",
      icon: <Undo2Icon />,
      shortcut: "Enter",
      onSelect: onRestore,
    },
    { kind: "separator", key: "sep-excluir" },
    {
      kind: "item",
      key: "excluir",
      label: "Excluir definitivamente",
      icon: <Trash2Icon />,
      destructive: true,
      shortcut: "Delete",
      onSelect: onPurge,
    },
  ]

  const tamanhoIcone = view === "grade" ? "size-9" : "size-4"

  const icone = restaurando ? (
    <LoaderCircleIcon
      className={cn(tamanhoIcone, "animate-spin text-muted-foreground")}
      aria-hidden
    />
  ) : pasta ? (
    <FolderIcon className={cn(tamanhoIcone, "text-primary")} />
  ) : (
    <FileTextIcon className={cn(tamanhoIcone, "text-muted-foreground")} />
  )

  function restaurarPeloDuploClique(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest("[data-ignore-open]")) return
    onRestore()
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={cn(
          "group relative rounded-xl border bg-card text-card-foreground outline-none select-none",
          "transition-[background-color,border-color,box-shadow] duration-200 ease-out",
          "focus-visible:ring-2 focus-visible:ring-ring",
          view === "lista"
            ? "flex items-center gap-3 px-3 py-2.5"
            : "flex min-h-32 flex-col gap-3 p-4",
          "hover:border-foreground/25 hover:bg-accent/40 hover:ring-2 hover:ring-foreground/15 hover:ring-inset",
          restaurando && "cursor-progress opacity-80"
        )}
        role="listitem"
        aria-busy={restaurando || undefined}
        tabIndex={0}
        aria-label={`${item.nome} — ${pasta ? "pasta" : "atividade"} na lixeira`}
        title={item.nome}
        onDoubleClick={restaurarPeloDuploClique}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("[data-ignore-open]")) {
            return
          }

          if (event.key === "Enter") {
            event.preventDefault()
            onRestore()
            return
          }

          if (event.key === "Delete") {
            event.preventDefault()
            onPurge()
          }
        }}
      >
        {view === "lista" ? (
          <>
            {icone}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {legenda}
              </p>
            </div>
            <Badge
              variant="secondary"
              className="hidden shrink-0 sm:inline-flex"
            >
              {pasta ? "Pasta" : "Atividade"}
            </Badge>
            <span
              className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums md:block"
              title={`Movido em ${formatarDataHoraLonga(item.deletedAt)}`}
            >
              <span className="sr-only">Movido em </span>
              {formatarDataIso(item.deletedAt)}
            </span>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-12 items-center justify-center rounded-lg bg-muted">
                {icone}
              </span>
              <div
                data-ignore-open
                onClick={(event) => event.stopPropagation()}
              >
                <ItemDropdown actions={actions} />
              </div>
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium">{item.nome}</p>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {legenda}
              </p>
            </div>
            <Badge variant="secondary" className="w-fit">
              {pasta ? "Pasta" : "Atividade"}
            </Badge>
          </>
        )}

        {view === "lista" && (
          <div
            data-ignore-open
            onClick={(event) => event.stopPropagation()}
            className="shrink-0"
          >
            <ItemDropdown actions={actions} />
          </div>
        )}
      </ContextMenuTrigger>

      <ContextMenuContent className="w-60">
        <ContextMenuGroup>
          <ContextMenuActions actions={actions} />
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}
