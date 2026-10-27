"use client"

import * as React from "react"
import {
  ClipboardCopyIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenuActions,
  DropdownMenuActions,
  type MenuAction,
} from "@/components/painel/explorer/explorer-menu"
import {
  isPasta,
  type ExplorerItem,
} from "@/components/painel/explorer/explorer-types"
import { rotuloAtividade } from "@/lib/dominio/status"
import { cn } from "@/lib/utils"

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
})

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
})

type ExplorerItemProps = {
  item: ExplorerItem
  view: "lista" | "grade"
  selected: boolean
  local?: string
  /** No mobile não existe duplo clique: um toque abre o item. */
  abrirComUmClique?: boolean
  onSelect: (mods?: { ctrl?: boolean; shift?: boolean }) => void
  onOpen: () => void
  onNewFolder: () => void
  onNewActivity: () => void
  onShare: () => void
  onRename: () => void
  onDuplicate: () => void
  onMove: () => void
  onToggleAtiva: () => void
  onCopyCode: (codigo: string) => void
  onTrash: () => void
  onDragStart: (event: React.DragEvent, item: ExplorerItem) => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent, item: ExplorerItem) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent, item: ExplorerItem) => void
  dropActive: boolean
  disabledDrop: boolean
}

export function ExplorerItemView({
  item,
  view,
  selected,
  local,
  abrirComUmClique = false,
  onSelect,
  onOpen,
  onNewFolder,
  onNewActivity,
  onShare,
  onRename,
  onDuplicate,
  onMove,
  onToggleAtiva,
  onCopyCode,
  onTrash,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  dropActive,
  disabledDrop,
}: ExplorerItemProps) {
  const pasta = isPasta(item)
  const nome = pasta ? item.nome : item.titulo
  const descricao = pasta ? null : item.subtitulo
  const publicada = !pasta && item.status === "publicada"
  const codigos = pasta
    ? []
    : item.aplicacoes.map((aplicacao) => aplicacao.codigo)

  const resumo = pasta
    ? `${item.pastaCount} pasta(s) · ${item.atividadeCount} atividade(s)`
    : codigos.length === 1
      ? `Código ${codigos[0]} · ${item.links} link(s)`
      : `${codigos.length} códigos · ${item.links} link(s)`

  // Nos resultados da busca global, acrescenta onde o item está.
  const legenda = [descricao || resumo, local].filter(Boolean).join(" · ")

  const actions: MenuAction[] = [
    {
      kind: "item",
      key: "abrir",
      label: "Abrir",
      icon: <ExternalLinkIcon />,
      shortcut: "Enter",
      onSelect: onOpen,
    },
  ]

  if (pasta) {
    actions.push(
      { kind: "separator", key: "sep-acoes" },
      {
        kind: "item",
        key: "nova-subpasta",
        label: "Nova subpasta",
        icon: <FolderPlusIcon />,
        onSelect: onNewFolder,
      },
      {
        kind: "item",
        key: "nova-atividade",
        label: "Nova atividade aqui",
        icon: <PlusIcon />,
        onSelect: onNewActivity,
      },
      {
        kind: "item",
        key: "compartilhar",
        label: "Compartilhar...",
        icon: <Share2Icon />,
        onSelect: onShare,
      }
    )
  }

  actions.push(
    { kind: "separator", key: "sep-editar" },
    {
      kind: "item",
      key: "renomear",
      label: "Renomear",
      icon: <PencilIcon />,
      shortcut: "F2",
      onSelect: onRename,
    },
    {
      kind: "item",
      key: "duplicar",
      label: "Duplicar",
      icon: <CopyIcon />,
      onSelect: onDuplicate,
    },
    {
      kind: "item",
      key: "mover",
      label: "Mover para...",
      icon: <FolderInputIcon />,
      onSelect: onMove,
    }
  )

  if (!pasta) {
    actions.push({
      kind: "item",
      key: "alternar-ativa",
      label: publicada ? "Encerrar atividade" : "Reabrir atividade",
      icon: publicada ? <EyeOffIcon /> : <EyeIcon />,
      onSelect: onToggleAtiva,
    })

    if (codigos.length === 1) {
      actions.push({
        kind: "item",
        key: "copiar-codigo",
        label: `Copiar código ${codigos[0]}`,
        icon: <ClipboardCopyIcon />,
        onSelect: () => onCopyCode(codigos[0]),
      })
    } else if (codigos.length > 1) {
      actions.push({
        kind: "sub",
        key: "copiar-codigo",
        label: "Copiar código",
        icon: <ClipboardCopyIcon />,
        items: codigos.map((codigo) => ({
          key: codigo,
          label: codigo,
          onSelect: () => onCopyCode(codigo),
        })),
      })
    }
  }

  actions.push(
    { kind: "separator", key: "sep-lixeira" },
    {
      kind: "item",
      key: "lixeira",
      label: "Mover para a lixeira",
      icon: <Trash2Icon />,
      destructive: true,
      onSelect: onTrash,
    }
  )

  function ignorarClique(event: React.MouseEvent) {
    return Boolean((event.target as HTMLElement).closest("[data-ignore-open]"))
  }

  function handleClick(event: React.MouseEvent) {
    if (ignorarClique(event)) return

    if (abrirComUmClique) {
      onOpen()
      return
    }

    onSelect({
      ctrl: event.metaKey || event.ctrlKey,
      shift: event.shiftKey,
    })
  }

  function handleDoubleClick(event: React.MouseEvent) {
    if (ignorarClique(event)) return
    onOpen()
  }

  const icone = pasta ? (
    <FolderIcon
      className={cn(view === "grade" ? "size-9" : "size-4", "text-primary")}
    />
  ) : (
    <FileTextIcon
      className={cn(
        view === "grade" ? "size-9" : "size-4",
        "text-muted-foreground"
      )}
    />
  )

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
          !selected &&
            "hover:border-foreground/25 hover:bg-accent/40 hover:ring-2 hover:ring-foreground/15 hover:ring-inset",
          selected &&
            "border-primary/60 bg-accent text-accent-foreground hover:ring-2 hover:ring-primary/40 hover:ring-inset",
          dropActive && "border-primary ring-2 ring-primary/40",
          disabledDrop && "opacity-60"
        )}
        role="option"
        aria-selected={selected}
        data-selected={selected}
        data-selecionavel
        tabIndex={0}
        aria-label={nome}
        title={nome}
        draggable
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(event) => {
          if (selected || ignorarClique(event)) return
          onSelect({
            ctrl: event.metaKey || event.ctrlKey,
            shift: event.shiftKey,
          })
        }}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("[data-ignore-open]")) {
            return
          }

          if (event.key === "F2") {
            event.preventDefault()
            onRename()
            return
          }

          if (event.key === "Delete") {
            event.preventDefault()
            onTrash()
            return
          }

          if (event.key === "Enter") {
            event.preventDefault()
            onOpen()
            return
          }

          if (event.key === " ") {
            event.preventDefault()
            onSelect({ ctrl: true })
          }
        }}
        onDragStart={(event) => onDragStart(event, item)}
        onDragEnd={onDragEnd}
        onDragOver={(event) => onDragOver(event, item)}
        onDragLeave={onDragLeave}
        onDrop={(event) => onDrop(event, item)}
      >
        {view === "lista" ? (
          <>
            {icone}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {legenda}
              </p>
            </div>
            {!pasta && (
              <Badge
                variant={publicada ? "default" : "secondary"}
                className="hidden shrink-0 sm:inline-flex"
              >
                {rotuloAtividade(item.status)}
              </Badge>
            )}
            <span
              className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums md:block"
              title={`Criado em ${dateTimeFormatter.format(new Date(item.created_at))}`}
            >
              <span className="sr-only">Criado em </span>
              {dateFormatter.format(new Date(item.created_at))}
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
              <p className="line-clamp-2 text-sm font-medium">{nome}</p>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {legenda}
              </p>
            </div>
            {!pasta && (
              <Badge
                variant={publicada ? "default" : "secondary"}
                className="w-fit"
              >
                {rotuloAtividade(item.status)}
              </Badge>
            )}
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

function ItemDropdown({ actions }: { actions: MenuAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Abrir menu de ações"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuActions actions={actions} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
